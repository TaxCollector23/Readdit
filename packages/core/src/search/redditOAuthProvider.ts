import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface RedditToken {
  accessToken: string;
  expiresAt: number;
}

interface RedditPostData {
  id: string;
  title: string;
  selftext?: string;
  permalink: string;
  subreddit: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  over_18?: boolean;
  url?: string;
}

interface RedditListing<T> {
  data: { children: Array<{ kind: string; data: T }> };
}

/**
 * Reddit search via OAuth client-credentials. Unlike the public JSON endpoint
 * (which blocks server-side IPs with 403), the OAuth API works reliably from
 * any server. Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET.
 */
export class RedditOAuthProvider implements SearchProvider {
  readonly name = "reddit-oauth";
  private token: RedditToken | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private userAgent: string,
    private requestId?: string
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 25, 100);
    const token = await this.getToken();
    if (!token) return [];

    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      sort: "relevance",
      t: "year",
      raw_json: "1",
      type: "link",
    });

    try {
      const res = await fetch(`https://oauth.reddit.com/search?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 401) this.token = null;
        logger.warn("reddit_oauth_search_failed", {
          requestId: this.requestId, status: res.status, query,
        });
        return [];
      }

      const json = (await res.json()) as RedditListing<RedditPostData>;
      return (json?.data?.children ?? [])
        .filter((c) => c.kind === "t3" && !c.data.over_18)
        .map((c) => this.toResult(c.data, query));
    } catch (err) {
      logger.warn("reddit_oauth_search_error", {
        requestId: this.requestId,
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private async getToken(): Promise<string | null> {
    if (this.token && Date.now() < this.token.expiresAt - 30_000) {
      return this.token.accessToken;
    }
    try {
      const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
      const res = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "User-Agent": this.userAgent,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        logger.warn("reddit_oauth_token_failed", { status: res.status, requestId: this.requestId });
        return null;
      }
      const data = (await res.json()) as { access_token: string; expires_in: number };
      this.token = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      return this.token.accessToken;
    } catch (err) {
      logger.warn("reddit_oauth_token_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private toResult(data: RedditPostData, query: string): SearchResult {
    return {
      title: data.title,
      url: `https://www.reddit.com${data.permalink}`,
      snippet: (data.selftext ?? "").slice(0, 400),
      text: data.selftext ?? "",
      source: "reddit-oauth",
      subreddit: data.subreddit,
      author: data.author,
      timestamp: new Date(data.created_utc * 1000).toISOString(),
      score: data.score,
      numComments: data.num_comments,
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
