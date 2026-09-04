/**
 * Core data structures shared by every Readdit interface (CLI, MCP, web).
 */

export type SourceType = "post" | "comment" | "article";

export interface SearchOptions {
  limit?: number;
  fresh?: boolean;
  subreddits?: string[];
  /** Research depth budget: bounds query fan-out and result volume. */
  depth?: "quick" | "standard" | "deep";
}

/** A single raw candidate returned by a SearchProvider, before normalization. */
export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  source: string;
  subreddit?: string;
  author?: string;
  timestamp?: string;
  score?: number;
  numComments?: number;
  text?: string;
  sourceType?: SourceType;
  /** The research query that surfaced this result. */
  matchedQuery?: string;
}

/** A SearchResult after normalization, deduplication, and ranking. */
export interface NormalizedDiscussion extends SearchResult {
  id: string;
  isReddit: boolean;
  relevanceScore: number;
  qualityScore: number;
  ageInDays?: number;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

export interface EvidenceSource {
  title: string;
  url: string;
  subreddit?: string;
  author?: string;
  timestamp?: string;
  score?: number;
}

export interface Evidence {
  claim: string;
  sources: EvidenceSource[];
}

export type SentimentLabel =
  | "very_negative"
  | "negative"
  | "mixed"
  | "positive"
  | "very_positive";

export interface Sentiment {
  score: number; // 0-100
  label: SentimentLabel;
  confidence: number; // 0-1
}

export interface Theme {
  name: string;
  description: string;
  frequency: number; // count of discussions touching this theme
  sentiment?: SentimentLabel;
}

export interface Comparison {
  product: string;
  context: string;
}

export interface SwitchingReason {
  direction: "to" | "from";
  product: string;
  reasons: string[];
}

export interface SubredditBreakdown {
  name: string;
  count: number;
}

export interface ConfidenceInfo {
  level: "low" | "medium" | "high";
  sourceCount: number;
  subredditCount: number;
  reasoning: string;
}

export interface RedditReport {
  query: string;
  intent: ReadditIntent;
  summary: string;
  keyTakeaways: string[];

  sentiment: Sentiment;

  praise: string[];
  complaints: string[];
  featureRequests: string[];

  themes: Theme[];
  comparisons: Comparison[];
  switchingReasons: SwitchingReason[];

  evidence: Evidence[];

  sourceCount: number;
  subreddits: SubredditBreakdown[];

  confidence: ConfidenceInfo;
  limitations: string[];

  generatedAt: string;
  model: string;
  cached: boolean;
}

export type ReadditIntent =
  | "analyze"
  | "compare"
  | "complaints"
  | "features"
  | "sentiment"
  | "ask"
  | "search";

export interface CompareReport {
  query: string;
  productA: string;
  productB: string;
  summary: string;
  overallSentiment: {
    a: Sentiment;
    b: Sentiment;
  };
  strengthsA: string[];
  strengthsB: string[];
  complaintsA: string[];
  complaintsB: string[];
  commonThemes: Theme[];
  switching: SwitchingReason[];
  evidence: Evidence[];
  sourceCount: number;
  subreddits: SubredditBreakdown[];
  limitations: string[];
  generatedAt: string;
  model: string;
  cached: boolean;
}

export interface ResearchPlan {
  intent: ReadditIntent;
  primaryTopic: string;
  secondaryTopic?: string;
  queries: string[];
  reasoning: string;
}

export interface AnalysisInput {
  query: string;
  intent: ReadditIntent;
  discussions: NormalizedDiscussion[];
  secondaryTopic?: string;
  onProgress?: ProgressCallback;
}

export interface AnalysisProvider {
  readonly name: string;
  readonly model: string;
  analyze(input: AnalysisInput): Promise<RedditReport>;
  compare(
    input: AnalysisInput & { discussionsB: NormalizedDiscussion[] }
  ): Promise<CompareReport>;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export type ProgressStage =
  | "planning"
  | "searching"
  | "ranking"
  | "extracting_evidence"
  | "synthesizing"
  | "done";

export type ProgressCallback = (stage: ProgressStage, detail?: string) => void;

export interface ReadditOptions {
  limit?: number;
  fresh?: boolean;
  model?: string;
  depth?: "quick" | "standard" | "deep";
  requestId?: string;
  /** Real-time stage callback — only fired when that stage actually runs, never a fake percentage. */
  onProgress?: ProgressCallback;
}

export class ReadditError extends Error {
  code: string;
  httpStatus: number;
  constructor(message: string, code: string, httpStatus = 500) {
    super(message);
    this.name = "ReadditError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class ConfigurationError extends ReadditError {
  constructor(message: string) {
    super(message, "configuration_error", 500);
  }
}

export class NoResultsError extends ReadditError {
  constructor(message: string) {
    super(message, "no_results", 200);
  }
}

export class SearchProviderError extends ReadditError {
  constructor(message: string) {
    super(message, "search_failed", 502);
  }
}

export class AnalysisProviderError extends ReadditError {
  constructor(message: string) {
    super(message, "analysis_failed", 502);
  }
}

export class InvalidInputError extends ReadditError {
  constructor(message: string) {
    super(message, "invalid_input", 400);
  }
}

export class RateLimitedError extends ReadditError {
  retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number) {
    super(message, "rate_limited", 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
