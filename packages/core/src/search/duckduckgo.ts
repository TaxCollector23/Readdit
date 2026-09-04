import * as cheerio from "cheerio";
import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { fetchWithRetry } from "../http.js";
import { logger } from "../logger.js";

/**
 * Free, key-less search via DuckDuckGo's HTML endpoint, restricted to
 * reddit.com. Used as a supplement to the Reddit search API — it surfaces
 * older/archived threads Reddit's own search sometimes misses, and gives
 * Readdit a second, independent signal for relevance/diversity.
 */
export class DuckDuckGoSearchProvider implements SearchProvider {
  readonly name = "duckduckgo";

  constructor(private userAgent: string, private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const siteQuery = `site:reddit.com ${query}`;
    const params = new URLSearchParams({ q: siteQuery });

    try {
      const res = await fetchWithRetry(`https://html.duckduckgo.com/html/?${params}`, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html",
        },
        requestId: this.requestId,
        timeoutMs: 7000,
        retries: 1,
      });

      if (!res.ok) {
        logger.warn("duckduckgo_non_200", { requestId: this.requestId, status: res.status });
        return [];
      }

      const html = await res.text();
      return this.parse(html, query, options.limit ?? 20);
    } catch (err) {
      logger.warn("duckduckgo_search_failed", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private parse(html: string, query: string, limit: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      if (results.length >= limit) return;
      const anchor = $(el).find("a.result__a").first();
      const title = anchor.text().trim();
      const href = anchor.attr("href");
      const snippet = $(el).find(".result__snippet").text().trim();
      if (!title || !href) return;

      const realUrl = extractRealUrl(href);
      if (!realUrl || !realUrl.includes("reddit.com")) return;

      const subreddit = extractSubreddit(realUrl);

      results.push({
        title,
        url: realUrl,
        snippet,
        source: "duckduckgo",
        subreddit,
        sourceType: "post",
        matchedQuery: query,
      });
    });

    return results;
  }
}

function extractRealUrl(href: string): string | undefined {
  try {
    const url = href.startsWith("//") ? `https:${href}` : href;
    const parsed = new URL(url);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return url;
  } catch {
    return undefined;
  }
}

function extractSubreddit(url: string): string | undefined {
  const match = url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/);
  return match ? match[1] : undefined;
}
