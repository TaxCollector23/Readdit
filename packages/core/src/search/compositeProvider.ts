import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";
import { logger } from "../logger.js";

/**
 * Fans a single query out to every configured provider in parallel and
 * merges the results. If one provider fails, the others' results are still
 * returned (partial-result handling) rather than failing the whole search.
 */
export class CompositeSearchProvider implements SearchProvider {
  readonly name = "composite";

  constructor(private providers: SearchProvider[], private requestId?: string) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const settled = await Promise.allSettled(
      this.providers.map((p) => p.search(query, options))
    );

    const results: SearchResult[] = [];
    let failures = 0;
    settled.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") {
        results.push(...outcome.value);
      } else {
        failures++;
        logger.warn("search_provider_failed", {
          requestId: this.requestId,
          provider: this.providers[i]?.name,
          query,
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    });

    if (failures === this.providers.length && this.providers.length > 0) {
      logger.error("all_search_providers_failed", { requestId: this.requestId, query });
    }

    return results;
  }
}
