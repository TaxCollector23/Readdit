import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface PullpushComment {
  id: string;
  body?: string;
  permalink?: string;
  subreddit: string;
  author: string;
  created_utc: number;
  score?: number;
  link_id?: string;
  link_permalink?: string;
}

interface PullpushCommentResponse {
  data: PullpushComment[];
}

/**
 * Searches Reddit comments (not posts) via Pullpush.io.
 * Complements the submission search with actual comment content —
 * especially useful for niche topics discussed in comment threads.
 */
export class PullpushCommentProvider implements SearchProvider {
  readonly name = "pullpush-comments";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 15, 20);

    try {
      const params = new URLSearchParams({
        q: query,
        size: String(limit),
        sort: "score",
        sort_type: "score",
      });

      const res = await fetch(
        `https://api.pullpush.io/reddit/search/comment/?${params}`,
        {
          headers: { "User-Agent": "readdit-research-tool/0.1" },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!res.ok) {
        logger.warn("pullpush_comments_failed", { requestId: this.requestId, status: res.status });
        return [];
      }

      const json = (await res.json()) as PullpushCommentResponse;
      return (json.data ?? [])
        .filter((c) => c.body && c.body.length > 20)
        .map((c) => this.toResult(c, query));
    } catch (err) {
      logger.warn("pullpush_comments_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(c: PullpushComment, query: string): SearchResult {
    const postId = c.link_id?.replace("t3_", "") ?? "";
    const url =
      c.link_permalink ??
      (postId
        ? `https://www.reddit.com/r/${c.subreddit}/comments/${postId}/_/${c.id}/`
        : `https://www.reddit.com/r/${c.subreddit}`);

    return {
      title: `Comment in r/${c.subreddit}`,
      url,
      snippet: (c.body ?? "").slice(0, 400),
      text: c.body ?? "",
      source: "pullpush-comments",
      subreddit: c.subreddit,
      author: c.author,
      timestamp: new Date(c.created_utc * 1000).toISOString(),
      score: c.score ?? 0,
      numComments: 0,
      sourceType: "comment",
      matchedQuery: query,
    };
  }
}
