import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface UrlCitation {
  url: string;
  title?: string;
  content?: string;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
      annotations?: Array<{ type: string; url_citation?: UrlCitation }>;
    };
  }>;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Uses OpenRouter's web-search plugin as a search backend: the actual HTTP
 * fetching happens on OpenRouter's infrastructure, so this works even from
 * networks where direct scraping of Reddit/search engines is blocked or
 * rate-limited. We only use the returned url_citation annotations (real
 * URLs + titles + excerpts) — never the model's free-text reply — so this
 * cannot inject fabricated sources into the pipeline.
 */
export class OpenRouterSearchProvider implements SearchProvider {
  readonly name = "openrouter-web";

  constructor(
    private apiKey: string,
    private model: string,
    private requestId?: string
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const siteQuery = query.toLowerCase().includes("reddit.com")
      ? query
      : `site:reddit.com ${query}`;
    const maxResults = Math.min(options.limit ?? 12, 20);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/readdit",
          "X-Title": "Readdit",
        },
        body: JSON.stringify({
          model: this.model,
          plugins: [{ id: "web", max_results: maxResults, search_prompt: "Search Reddit discussions." }],
          max_tokens: 120,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: `Search query: ${siteQuery}\n\nJust confirm you searched in under 10 words. Do not summarize results.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        logger.warn("openrouter_web_search_non_200", {
          requestId: this.requestId,
          status: res.status,
          query,
        });
        return [];
      }

      const json = (await res.json()) as OpenRouterChatResponse;
      const annotations = json.choices?.[0]?.message?.annotations ?? [];

      return annotations
        .filter((a) => a.type === "url_citation" && a.url_citation?.url)
        .map((a) => this.toResult(a.url_citation!, query));
    } catch (err) {
      logger.warn("openrouter_web_search_failed", {
        requestId: this.requestId,
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(citation: UrlCitation, query: string): SearchResult {
    const subredditMatch = citation.url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/);
    return {
      title: citation.title ?? "Reddit discussion",
      url: citation.url,
      snippet: (citation.content ?? "").slice(0, 500),
      text: citation.content ?? "",
      source: "openrouter-web",
      subreddit: subredditMatch ? subredditMatch[1] : undefined,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
