import { AnalysisProviderError, RateLimitedError } from "../types.js";
import { logger } from "../logger.js";
import { extractJson } from "./schema.js";
import type { JsonModelCallOptions, JsonModelClient } from "./jsonClient.js";

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Minimal Gemini REST client for JSON-producing analysis calls. The rest of
 * Readdit already performs schema validation and source-index checks, so the
 * client's job is intentionally narrow: ask Gemini for JSON, extract the text
 * response, and surface typed errors to CLI/MCP/web callers.
 */
export class GeminiClient implements JsonModelClient {
  constructor(private apiKey: string) {}

  async callForJson(opts: JsonModelCallOptions): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.post(opts);
        return extractJson(raw);
      } catch (err) {
        lastError = err;
        logger.warn("gemini_json_parse_retry", {
          requestId: opts.requestId,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw new AnalysisProviderError(
      `Gemini returned unparseable output after retry: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private async post(opts: JsonModelCallOptions): Promise<string> {
    const model = opts.model.replace(/^models\//, "");
    const body = JSON.stringify({
      systemInstruction: {
        parts: [{ text: opts.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: opts.user }],
        },
      ],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxTokens ?? 2000,
        responseMimeType: "application/json",
      },
    });

    let attempt = 0;
    const maxAttempts = 3;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let res: Response;

      try {
        res = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "x-goog-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          body,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt >= maxAttempts) {
          throw new AnalysisProviderError(
            `Could not reach Gemini: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        await sleep(1000 * attempt);
        continue;
      }
      clearTimeout(timer);

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 5);
        if (attempt >= maxAttempts) {
          throw new RateLimitedError("Gemini rate limit exceeded", retryAfter);
        }
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status >= 500) {
        if (attempt >= maxAttempts) {
          throw new AnalysisProviderError(`Gemini server error: ${res.status}`);
        }
        await sleep(1500 * attempt);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let upstreamMessage = "";
        try {
          upstreamMessage = (JSON.parse(text) as GeminiResponse).error?.message ?? "";
        } catch {
          upstreamMessage = "";
        }

        logger.error("gemini_request_failed", {
          requestId: opts.requestId,
          status: res.status,
          body: text.slice(0, 500),
        });

        const hint =
          res.status === 400 || res.status === 401 || res.status === 403
            ? " Check GEMINI_API_KEY and GEMINI_MODEL."
            : "";
        const detail = upstreamMessage ? ` ${upstreamMessage}` : "";
        throw new AnalysisProviderError(`Gemini request failed (${res.status}).${hint}${detail}`);
      }

      const json = (await res.json()) as GeminiResponse;
      const text = json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        const finishReason = json.candidates?.[0]?.finishReason;
        throw new AnalysisProviderError(
          `Gemini returned an empty response${finishReason ? ` (${finishReason})` : ""}`
        );
      }

      return text;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
