import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface SearXNGResult {
  title: string;
  url: string;
  content?: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
}

const INSTANCES = [
  "https://search.inetol.net",
  "https://searx.be",
];

/**
 * SearXNG search against public instances, filtered to reddit.com URLs.
 * Falls back from the first instance to the second on failure.
 * No API key required.
 */
export class SearXNGProvider implements SearchProvider {
  readonly name = "searxng";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const siteQuery = `site:reddit.com ${query}`;

    for (const base of INSTANCES) {
      try {
        const params = new URLSearchParams({
          q: siteQuery,
          format: "json",
          categories: "general",
        });

        const res = await fetch(`${base}/search?${params}`, {
          signal: AbortSignal.timeout(7000),
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          logger.warn("searxng_instance_failed", {
            requestId: this.requestId,
            base,
            status: res.status,
          });
          continue;
        }

        const json = (await res.json()) as SearXNGResponse;
        const results = (json.results ?? []).filter((r) =>
          r.url.includes("reddit.com")
        );

        return results.map((r) => this.toResult(r, query));
      } catch (err) {
        logger.warn("searxng_instance_error", {
          requestId: this.requestId,
          base,
          error: err instanceof Error ? err.message : String(err),
        });
        // Try next instance
      }
    }

    return [];
  }

  private toResult(r: SearXNGResult, query: string): SearchResult {
    // Extract subreddit from URL if possible
    const subredditMatch = r.url.match(/reddit\.com\/r\/([^/]+)/);
    const subreddit = subredditMatch?.[1];

    return {
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 400),
      source: "searxng",
      subreddit,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
