import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { fetchWithRetry } from "../http.js";
import { logger } from "../logger.js";

interface RedditListingChild<T> {
  kind: string;
  data: T;
}

interface RedditListing<T> {
  data: {
    children: RedditListingChild<T>[];
  };
}

interface RedditPostData {
  id: string;
  title: string;
  selftext?: string;
  url?: string;
  permalink: string;
  subreddit: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  over_18?: boolean;
}

interface RedditCommentData {
  id: string;
  body?: string;
  link_title?: string;
  link_permalink?: string;
  permalink?: string;
  subreddit: string;
  author: string;
  created_utc: number;
  score: number;
}

/**
 * Searches Reddit's own public, unauthenticated JSON search endpoints
 * (reddit.com/search.json). This is the primary source of real Reddit
 * evidence: it returns actual posts and comments with subreddit, author,
 * score, and timestamp metadata, not just links to Reddit found elsewhere.
 */
export class RedditSearchProvider implements SearchProvider {
  readonly name = "reddit";

  constructor(private userAgent: string, private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 25, 100);
    const results: SearchResult[] = [];

    const postResults = await this.searchPosts(query, limit, options.subreddits);
    results.push(...postResults);

    if (options.depth === "standard" || options.depth === "deep") {
      try {
        const commentResults = await this.searchComments(query, Math.min(limit, 25));
        results.push(...commentResults);
      } catch (err) {
        logger.warn("reddit_comment_search_failed", {
          requestId: this.requestId,
          query,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  private async searchPosts(
    query: string,
    limit: number,
    subreddits?: string[]
  ): Promise<SearchResult[]> {
    const base = subreddits && subreddits.length === 1
      ? `https://www.reddit.com/r/${encodeURIComponent(subreddits[0])}/search.json`
      : "https://www.reddit.com/search.json";
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      sort: "relevance",
      t: "year",
      raw_json: "1",
    });
    if (subreddits && subreddits.length === 1) {
      params.set("restrict_sr", "1");
    }

    const res = await fetchWithRetry(`${base}?${params.toString()}`, {
      headers: { "User-Agent": this.userAgent },
      requestId: this.requestId,
      timeoutMs: 8000,
      retries: 1,
    });

    if (!res.ok) {
      logger.warn("reddit_search_non_200", {
        requestId: this.requestId,
        status: res.status,
        query,
      });
      return [];
    }

    const json = (await res.json()) as RedditListing<RedditPostData>;
    const children = json?.data?.children ?? [];

    return children
      .filter((c) => c.kind === "t3" && !c.data.over_18)
      .map((c) => this.postToResult(c.data, query));
  }

  private async searchComments(query: string, limit: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      sort: "relevance",
      type: "comment",
      raw_json: "1",
    });
    const res = await fetchWithRetry(
      `https://www.reddit.com/search.json?${params.toString()}`,
      {
        headers: { "User-Agent": this.userAgent },
        requestId: this.requestId,
        timeoutMs: 8000,
        retries: 1,
      }
    );
    if (!res.ok) return [];

    const json = (await res.json()) as RedditListing<RedditCommentData>;
    const children = json?.data?.children ?? [];

    return children
      .filter((c) => c.kind === "t1" && c.data.body && c.data.body.length > 40)
      .map((c) => this.commentToResult(c.data, query));
  }

  private postToResult(data: RedditPostData, query: string): SearchResult {
    return {
      title: data.title,
      url: `https://www.reddit.com${data.permalink}`,
      snippet: (data.selftext ?? "").slice(0, 400),
      text: data.selftext ?? "",
      source: "reddit",
      subreddit: data.subreddit,
      author: data.author,
      timestamp: new Date(data.created_utc * 1000).toISOString(),
      score: data.score,
      numComments: data.num_comments,
      sourceType: "post",
      matchedQuery: query,
    };
  }

  private commentToResult(data: RedditCommentData, query: string): SearchResult {
    return {
      title: data.link_title ?? "Comment",
      url: data.permalink
        ? `https://www.reddit.com${data.permalink}`
        : (data.link_permalink ?? ""),
      snippet: (data.body ?? "").slice(0, 400),
      text: data.body ?? "",
      source: "reddit",
      subreddit: data.subreddit,
      author: data.author,
      timestamp: new Date(data.created_utc * 1000).toISOString(),
      score: data.score,
      sourceType: "comment",
      matchedQuery: query,
    };
  }
}
