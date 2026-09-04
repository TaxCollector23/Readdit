import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

/**
 * Scrapes Bing's HTML search for site:reddit.com results.
 * No API key required. Returns Reddit threads Bing has indexed.
 * Falls back gracefully if blocked or rate-limited.
 */
export class BingSearchProvider implements SearchProvider {
  readonly name = "bing";

  constructor(private userAgent: string, private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 20, 20);
    const siteQuery = `site:reddit.com ${query}`;

    try {
      const params = new URLSearchParams({ q: siteQuery, count: String(limit) });
      const res = await fetch(`https://www.bing.com/search?${params}`, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        logger.warn("bing_search_failed", { requestId: this.requestId, status: res.status });
        return [];
      }

      const html = await res.text();
      return this.parse(html, query, limit);
    } catch (err) {
      logger.warn("bing_search_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private parse(html: string, query: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Bing wraps each result in <li class="b_algo">
    const algoPattern = /<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let algoMatch: RegExpExecArray | null;

    while ((algoMatch = algoPattern.exec(html)) !== null && results.length < limit) {
      const block = algoMatch[1];

      // Extract href from first <a> tag
      const hrefMatch = /href="(https?:\/\/[^"]+reddit\.com[^"]+)"/i.exec(block);
      if (!hrefMatch) continue;
      const url = hrefMatch[1];

      // Extract title from <h2>
      const titleMatch = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(block);
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
        : url;

      // Extract snippet from <p> or caption
      const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
      const snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
        : "";

      if (!title || !url.includes("reddit.com")) continue;

      const subreddit = url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/)?.[1];

      results.push({
        title,
        url,
        snippet,
        source: "bing",
        subreddit,
        sourceType: "post",
        matchedQuery: query,
      });
    }

    return results;
  }
}
