import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface PullpushSubmission {
  id: string;
  title: string;
  selftext?: string;
  permalink?: string;
  full_link?: string;
  subreddit: string;
  author: string;
  created_utc: number;
  score?: number;
  num_comments?: number;
  over_18?: boolean;
}

interface PullpushResponse {
  data: PullpushSubmission[];
}

/**
 * Reddit archive search via Pullpush.io — a free Pushshift alternative.
 * Returns real Reddit submissions without requiring a Reddit API key.
 * No signup required. Covers historical Reddit data.
 */
export class PullpushProvider implements SearchProvider {
  readonly name = "pullpush";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 20, 25);

    try {
      const params = new URLSearchParams({
        q: query,
        size: String(limit),
        sort: "score",
        sort_type: "score",
      });

      const res = await fetch(
        `https://api.pullpush.io/reddit/search/submission/?${params}`,
        {
          headers: { "User-Agent": "readdit-research-tool/0.1" },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!res.ok) {
        logger.warn("pullpush_failed", { requestId: this.requestId, status: res.status });
        return [];
      }

      const json = (await res.json()) as PullpushResponse;
      return (json.data ?? [])
        .filter((d) => !d.over_18)
        .map((d) => this.toResult(d, query));
    } catch (err) {
      logger.warn("pullpush_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(d: PullpushSubmission, query: string): SearchResult {
    const url =
      d.full_link ??
      (d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/r/${d.subreddit}`);
    return {
      title: d.title,
      url,
      snippet: (d.selftext ?? "").slice(0, 400),
      text: d.selftext ?? "",
      source: "pullpush",
      subreddit: d.subreddit,
      author: d.author,
      timestamp: new Date(d.created_utc * 1000).toISOString(),
      score: d.score ?? 0,
      numComments: d.num_comments ?? 0,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
