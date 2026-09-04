import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  page_age?: string;
  meta_url?: { hostname?: string };
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

/**
 * Search via Brave Search API (free tier: 2000/month).
 * Queries site:reddit.com to return real Reddit threads.
 * Requires BRAVE_SEARCH_API_KEY.
 */
export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave";

  constructor(private apiKey: string, private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 20, 20);
    const siteQuery = `site:reddit.com ${query}`;

    try {
      const params = new URLSearchParams({
        q: siteQuery,
        count: String(limit),
        result_filter: "web",
        freshness: "py", // past year
      });

      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        logger.warn("brave_search_failed", {
          requestId: this.requestId,
          status: res.status,
          query,
        });
        return [];
      }

      const json = (await res.json()) as BraveSearchResponse;
      const results = json?.web?.results ?? [];

      return results
        .filter((r) => r.url.includes("reddit.com"))
        .map((r) => this.toResult(r, query));
    } catch (err) {
      logger.warn("brave_search_error", {
        requestId: this.requestId,
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(r: BraveWebResult, query: string): SearchResult {
    const subreddit = r.url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/)?.[1];
    return {
      title: r.title,
      url: r.url,
      snippet: r.description ?? "",
      source: "brave",
      subreddit,
      sourceType: "post",
      matchedQuery: query,
      timestamp: r.page_age ? new Date(r.page_age).toISOString() : undefined,
    };
  }
}
