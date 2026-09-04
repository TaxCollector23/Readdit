import type {
  AnalysisProvider,
  CacheProvider,
  CompareReport,
  NormalizedDiscussion,
  ReadditIntent,
  ReadditOptions,
  RedditReport,
  SearchProvider,
} from "./types.js";
import { InvalidInputError, NoResultsError } from "./types.js";
import { normalizeAndDedupe, rankAndDiversify } from "./ranking/rank.js";
import {
  extractTopicFromQuestion,
  inferIntentFromQuestion,
  planFollowUpQueries,
  planQueries,
} from "./planning/queryPlanner.js";
import { cacheKey } from "./cache/index.js";
import { logger, newRequestId } from "./logger.js";

export * from "./types.js";
export { loadConfig, checkConfig, type ReadditConfig } from "./config.js";
export { SqliteCacheProvider, MemoryCacheProvider, cacheKey } from "./cache/index.js";
export { RedditSearchProvider } from "./search/redditProvider.js";
export { DuckDuckGoSearchProvider } from "./search/duckduckgo.js";
export { OpenRouterSearchProvider } from "./search/openrouterSearchProvider.js";
export { CompositeSearchProvider } from "./search/compositeProvider.js";
export { MockSearchProvider } from "./search/mockProvider.js";
export { OpenRouterAnalysisProvider } from "./analysis/openrouterProvider.js";
export { MockAnalysisProvider } from "./analysis/mockProvider.js";
export { RateLimiter, type RateLimitResult } from "./rateLimit.js";
export { getDb } from "./db.js";
export { loadEnvFile } from "./envFile.js";
export { logger, newRequestId } from "./logger.js";
export {
  extractTopicFromQuestion,
  inferIntentFromQuestion,
  planQueries,
} from "./planning/queryPlanner.js";
export { normalizeAndDedupe, rankAndDiversify } from "./ranking/rank.js";
export { createCoreFromEnv, type CreateCoreOptions } from "./factory.js";

const DEFAULT_LIMIT: Record<"quick" | "standard" | "deep", number> = {
  quick: 25,
  standard: 50,
  deep: 90,
};

const MIN_EVIDENCE_THRESHOLD = 5;
const RESULTS_PER_QUERY: Record<"quick" | "standard" | "deep", number> = {
  quick: 10,
  standard: 15,
  deep: 20,
};

export interface ReadditCoreDeps {
  searchProvider: SearchProvider;
  analysisProvider: AnalysisProvider;
  cache: CacheProvider;
  cacheTtlSeconds?: number;
}

export interface ResearchResult {
  discussions: NormalizedDiscussion[];
  queriesUsed: string[];
  requestId: string;
}

export class ReadditCore {
  private cacheTtlSeconds: number;

  constructor(private deps: ReadditCoreDeps) {
    this.cacheTtlSeconds = deps.cacheTtlSeconds ?? 21600;
  }

  /** Retrieval + normalization + ranking only — no LLM call. Powers `readdit search` / readdit_search. */
  async research(
    topic: string,
    intent: ReadditIntent,
    options: ReadditOptions & { secondaryTopic?: string } = {}
  ): Promise<ResearchResult> {
    const requestId = options.requestId ?? newRequestId();
    if (!topic || topic.trim().length === 0) {
      throw new InvalidInputError("Query must not be empty.");
    }
    if (topic.length > 300) {
      throw new InvalidInputError("Query is too long (max 300 characters).");
    }

    const depth = options.depth ?? "standard";
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT[depth], 150);

    options.onProgress?.("planning", `Planning research for "${topic}"`);
    const plan = planQueries(intent, topic, { secondaryTopic: options.secondaryTopic, depth });
    logger.info("research_plan_created", {
      requestId,
      topic,
      intent,
      queryCount: plan.queries.length,
      queries: plan.queries,
      reasoning: plan.reasoning,
    });

    options.onProgress?.("searching", `Searching Reddit (${plan.queries.length} queries)`);
    const perQueryLimit = RESULTS_PER_QUERY[depth];
    const batches = await Promise.all(
      plan.queries.map((q) =>
        this.deps.searchProvider.search(q, {
          limit: perQueryLimit,
          depth,
          fresh: options.fresh,
        })
      )
    );
    let raw = batches.flat();
    let queriesUsed = [...plan.queries];

    let normalized = normalizeAndDedupe(topic, raw);

    // Adaptive research loop: if coverage looks thin, run a small follow-up
    // round rather than accepting a weak report (standard/deep only, to keep
    // quick mode fast and cheap).
    if (depth !== "quick") {
      const subredditCount = new Set(normalized.map((d) => d.subreddit ?? "unknown")).size;
      const followUps = planFollowUpQueries(intent, topic, subredditCount, normalized.length);
      if (followUps.length > 0) {
        logger.info("adaptive_followup_queries", { requestId, followUps });
        const followBatches = await Promise.all(
          followUps.map((q) => this.deps.searchProvider.search(q, { limit: perQueryLimit, depth }))
        );
        raw = raw.concat(followBatches.flat());
        queriesUsed = queriesUsed.concat(followUps);
        normalized = normalizeAndDedupe(topic, raw);
      }
    }

    options.onProgress?.("ranking", `Ranking ${normalized.length} candidate discussions`);
    const ranked = rankAndDiversify(normalized, limit);

    logger.info("research_complete", {
      requestId,
      topic,
      candidates: raw.length,
      afterDedup: normalized.length,
      final: ranked.length,
    });

    return { discussions: ranked, queriesUsed, requestId };
  }

  async analyze(topic: string, options: ReadditOptions = {}): Promise<RedditReport> {
    return this.runAnalysis(topic, "analyze", options);
  }

  async complaints(topic: string, options: ReadditOptions = {}): Promise<RedditReport> {
    return this.runAnalysis(topic, "complaints", options);
  }

  async features(topic: string, options: ReadditOptions = {}): Promise<RedditReport> {
    return this.runAnalysis(topic, "features", options);
  }

  async sentiment(topic: string, options: ReadditOptions = {}): Promise<RedditReport> {
    return this.runAnalysis(topic, "sentiment", options);
  }

  async ask(question: string, options: ReadditOptions = {}): Promise<RedditReport> {
    if (!question || question.trim().length === 0) {
      throw new InvalidInputError("Question must not be empty.");
    }
    const intent = inferIntentFromQuestion(question);
    const topic = extractTopicFromQuestion(question);
    const effectiveIntent = intent === "compare" ? "ask" : intent;
    const report = await this.runAnalysis(topic, effectiveIntent, options);
    return { ...report, query: question };
  }

  async search(
    topic: string,
    options: ReadditOptions = {}
  ): Promise<{ discussions: NormalizedDiscussion[]; queriesUsed: string[] }> {
    const key = cacheKey({ fn: "search", topic, limit: options.limit, depth: options.depth });
    if (!options.fresh) {
      const cached = await this.deps.cache.get<{
        discussions: NormalizedDiscussion[];
        queriesUsed: string[];
      }>(key);
      if (cached) return cached;
    }
    const { discussions, queriesUsed } = await this.research(topic, "search", options);
    const result = { discussions, queriesUsed };
    await this.deps.cache.set(key, result, this.cacheTtlSeconds);
    return result;
  }

  async compare(
    topicA: string,
    topicB: string,
    options: ReadditOptions = {}
  ): Promise<CompareReport> {
    if (!topicA?.trim() || !topicB?.trim()) {
      throw new InvalidInputError("Both products to compare must be provided.");
    }

    const key = cacheKey({
      fn: "compare",
      topicA: topicA.toLowerCase(),
      topicB: topicB.toLowerCase(),
      limit: options.limit,
      model: options.model,
      depth: options.depth,
    });
    if (!options.fresh) {
      const cached = await this.deps.cache.get<CompareReport>(key);
      if (cached) return { ...cached, cached: true };
    }

    const requestId = options.requestId ?? newRequestId();
    const [resultA, resultB] = await Promise.all([
      this.research(topicA, "compare", { ...options, requestId, secondaryTopic: topicB }),
      this.research(topicB, "compare", { ...options, requestId, secondaryTopic: topicA }),
    ]);

    if (resultA.discussions.length < 3 && resultB.discussions.length < 3) {
      throw new NoResultsError(
        `Couldn't find enough relevant Reddit discussions about "${topicA}" or "${topicB}" to produce a reliable comparison.`
      );
    }

    options.onProgress?.("extracting_evidence", "Extracting evidence for both products");
    const report = await this.deps.analysisProvider.compare({
      query: topicA,
      intent: "compare",
      discussions: resultA.discussions,
      discussionsB: resultB.discussions,
      secondaryTopic: topicB,
      onProgress: options.onProgress,
    });

    options.onProgress?.("done", "Comparison complete");
    await this.deps.cache.set(key, report, this.cacheTtlSeconds);
    return report;
  }

  private async runAnalysis(
    topic: string,
    intent: ReadditIntent,
    options: ReadditOptions
  ): Promise<RedditReport> {
    const key = cacheKey({
      fn: "analyze",
      topic: topic.toLowerCase(),
      intent,
      limit: options.limit,
      model: options.model,
      depth: options.depth,
    });

    if (!options.fresh) {
      const cached = await this.deps.cache.get<RedditReport>(key);
      if (cached) return { ...cached, cached: true };
    }

    const requestId = options.requestId ?? newRequestId();
    const { discussions } = await this.research(topic, intent, { ...options, requestId });

    if (discussions.length < MIN_EVIDENCE_THRESHOLD) {
      throw new NoResultsError(
        `We couldn't find enough relevant Reddit discussions about "${topic}" to produce a reliable analysis. Try a broader query, the product's full name, or a related category.`
      );
    }

    options.onProgress?.("extracting_evidence", `Extracting evidence from ${discussions.length} discussions`);
    const report = await this.deps.analysisProvider.analyze({
      query: topic,
      intent,
      discussions,
      onProgress: options.onProgress,
    });

    options.onProgress?.("done", "Report ready");
    await this.deps.cache.set(key, report, this.cacheTtlSeconds);
    return report;
  }
}
