import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

interface StackItem {
  question_id: number;
  title: string;
  link: string;
  body?: string;
  score: number;
  answer_count: number;
  tags: string[];
  creation_date: number;
}

interface StackResponse {
  items: StackItem[];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

/**
 * StackOverflow search via the Stack Exchange API v2.3.
 * No API key required for read access (though rate-limited without one).
 */
export class StackExchangeProvider implements SearchProvider {
  readonly name = "stackoverflow";

  constructor(private requestId?: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        order: "desc",
        sort: "votes",
        q: query,
        site: "stackoverflow",
        filter: "withbody",
        pagesize: "15",
      });

      const res = await fetch(
        `https://api.stackexchange.com/2.3/search/advanced?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) {
        logger.warn("stackoverflow_search_failed", {
          requestId: this.requestId,
          status: res.status,
        });
        return [];
      }

      const json = (await res.json()) as StackResponse;
      return (json.items ?? []).map((item) => this.toResult(item, query));
    } catch (err) {
      logger.warn("stackoverflow_search_error", {
        requestId: this.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private toResult(item: StackItem, query: string): SearchResult {
    const rawSnippet = item.body ? decodeHtmlEntities(item.body) : "";
    // Strip HTML tags for a cleaner snippet
    const plainSnippet = rawSnippet.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    return {
      title: decodeHtmlEntities(item.title),
      url: item.link,
      snippet: plainSnippet.slice(0, 400),
      source: "stackoverflow",
      score: item.score,
      numComments: item.answer_count,
      timestamp: new Date(item.creation_date * 1000).toISOString(),
      sourceType: "post",
      matchedQuery: query,
    };
  }
}
