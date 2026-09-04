import { AnalysisProviderError, RateLimitedError } from "../types.js";
import { logger } from "../logger.js";
import { extractJson } from "./schema.js";

export interface OpenRouterCallOptions {
  model: string;
  system: string;
  user: string;
  requestId?: string;
  temperature?: number;
  maxTokens?: number;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Thin OpenRouter chat-completions client that returns parsed JSON. Retries
 * once on malformed JSON (asking the model to correct itself is overkill for
 * this MVP; a clean retry is cheaper and usually sufficient). Surfaces
 * rate-limit and API errors as typed ReadditError subclasses so callers
 * (CLI/MCP/web) can react appropriately instead of crashing.
 */
export class OpenRouterClient {
  constructor(private apiKey: string) {}

  async callForJson(opts: OpenRouterCallOptions): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.post(opts);
        return extractJson(raw);
      } catch (err) {
        lastError = err;
        logger.warn("openrouter_json_parse_retry", {
          requestId: opts.requestId,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw new AnalysisProviderError(
      `OpenRouter returned unparseable output after retry: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private async post(opts: OpenRouterCallOptions): Promise<string> {
    const body = JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2000,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    });

    let attempt = 0;
    const maxAttempts = 3;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let res: Response;
      try {
        res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/readdit",
            "X-Title": "Readdit",
          },
          body,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt >= maxAttempts) {
          throw new AnalysisProviderError(
            `Could not reach OpenRouter: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        await sleep(1000 * attempt);
        continue;
      }
      clearTimeout(timer);

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 5);
        if (attempt >= maxAttempts) {
          throw new RateLimitedError("OpenRouter rate limit exceeded", retryAfter);
        }
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status >= 500) {
        if (attempt >= maxAttempts) {
          throw new AnalysisProviderError(`OpenRouter server error: ${res.status}`);
        }
        await sleep(1500 * attempt);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AnalysisProviderError(
          `OpenRouter request failed (${res.status}): ${text.slice(0, 300)}`
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new AnalysisProviderError("OpenRouter returned an empty response");
      }
      return content;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
