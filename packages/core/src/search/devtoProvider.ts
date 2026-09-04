import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface DevtoArticle {
  id: number;
  title: string;
  url: string;
  description?: string;
  tag_list: string[];
  positive_reactions_count: number;
  comments_count: number;
  published_at?: string;
  user: {
    name: string;
  };
}

/**
 * Dev.to article search — no API key required.
 * Fetches by tag (first query word) and by full-text search, then deduplicates.
 */
export class DevtoProvider implements SearchProvider {
  readonly name = "devto";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const firstWord = query.trim().split(/\s+/)[0] ?? query;

      const tagUrl = `https://dev.to/api/articles?tag=${encodeURIComponent(firstWord)}&per_page=10&top=30`;
      const searchUrl = `https://dev.to/api/articles/search?q=${encodeURIComponent(query)}&per_page=15`;

      const [tagRes, searchRes] = await Promise.allSettled([
        fetch(tagUrl, { signal: AbortSignal.timeout(8000) }),
        fetch(searchUrl, { signal: AbortSignal.timeout(8000) }),
      ]);

      const articles: DevtoArticle[] = [];

      if (tagRes.status === "fulfilled" && tagRes.value.ok) {
        const data = (await tagRes.value.json()) as DevtoArticle[];
        articles.push(...(Array.isArray(data) ? data : []));
      } else {
        logger.warn("devto_tag_fetch_failed", { requestId: this.requestId });
      }

      if (searchRes.status === "fulfilled" && searchRes.value.ok) {
        const data = (await searchRes.value.json()) as DevtoArticle[];
        articles.push(...(Array.isArray(data) ? data : []));
      } else {
        logger.warn("devto_search_fetch_failed", { requestId: this.requestId });
      }

      // Deduplicate by id
      const seen = new Set<number>();
      const unique: DevtoArticle[] = [];
      for (const a of articles) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          unique.push(a);
        }
      }

      return unique.map((a) => this.toResult(a, query));
    } catch (err) {
      logger.warn("devto_search_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(a: DevtoArticle, query: string): SearchResult {
    return {
      title: a.title,
      url: a.url,
      snippet: a.description?.slice(0, 400),
      source: "devto",
      author: a.user.name,
      timestamp: a.published_at,
      score: a.positive_reactions_count,
      numComments: a.comments_count,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
