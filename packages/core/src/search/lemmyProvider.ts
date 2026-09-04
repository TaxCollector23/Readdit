import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface LemmyPost {
  post: {
    id: number;
    name: string;
    url?: string;
    body?: string;
    ap_id: string;
  };
  counts: {
    score: number;
    comments: number;
  };
  community: {
    name: string;
  };
  creator: {
    name: string;
  };
}

interface LemmySearchResponse {
  posts: LemmyPost[];
}

/**
 * Lemmy search via the public lemmy.world API.
 * Federated Reddit alternative — no auth required.
 */
export class LemmyProvider implements SearchProvider {
  readonly name = "lemmy";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 20, 20);

    try {
      const params = new URLSearchParams({
        q: query,
        type_: "Posts",
        sort: "TopAll",
        limit: String(limit),
      });

      const res = await fetch(
        `https://lemmy.world/api/v3/search?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) {
        logger.warn("lemmy_search_failed", { requestId: this.requestId, status: res.status });
        return [];
      }

      const json = (await res.json()) as LemmySearchResponse;
      return (json.posts ?? []).map((p) => this.toResult(p, query));
    } catch (err) {
      logger.warn("lemmy_search_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(p: LemmyPost, query: string): SearchResult {
    return {
      title: p.post.name,
      url: p.post.url ?? `https://lemmy.world/post/${p.post.id}`,
      snippet: p.post.body?.slice(0, 400),
      source: "lemmy",
      subreddit: p.community.name,
      author: p.creator.name,
      score: p.counts.score,
      numComments: p.counts.comments,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
