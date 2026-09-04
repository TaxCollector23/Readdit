import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface HNHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  author: string;
  points?: number;
  num_comments?: number;
  created_at: string;
  story_text?: string;
  comment_text?: string;
  _tags?: string[];
}

interface HNSearchResponse {
  hits: HNHit[];
}

/**
 * Hacker News search via the public Algolia API.
 * Completely free, no API key, no rate limits for reasonable use.
 * Returns developer/tech community discussions — high signal for product research.
 */
export class HNSearchProvider implements SearchProvider {
  readonly name = "hackernews";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 20, 20);

    try {
      const storyParams = new URLSearchParams({
        query,
        tags: "story",
        hitsPerPage: String(limit),
      });

      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?${storyParams}`,
        { signal: AbortSignal.timeout(6000) }
      );

      if (!res.ok) {
        logger.warn("hn_search_failed", { requestId: this.requestId, status: res.status });
        return [];
      }

      const json = (await res.json()) as HNSearchResponse;
      return (json.hits ?? []).map((h) => this.toResult(h, query));
    } catch (err) {
      logger.warn("hn_search_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(h: HNHit, query: string): SearchResult {
    const id = h.objectID;
    return {
      title: h.title ?? h.story_title ?? "Hacker News discussion",
      url: h.url ?? `https://news.ycombinator.com/item?id=${id}`,
      snippet: (h.story_text ?? h.comment_text ?? "").slice(0, 400),
      text: h.story_text ?? h.comment_text ?? "",
      source: "hackernews",
      subreddit: undefined,
      author: h.author,
      timestamp: h.created_at,
      score: h.points ?? 0,
      numComments: h.num_comments ?? 0,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
