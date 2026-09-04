import { loadConfig } from "./config.js";
import { SqliteCacheProvider, MemoryCacheProvider } from "./cache/index.js";
import { RedditSearchProvider } from "./search/redditProvider.js";
import { RedditOAuthProvider } from "./search/redditOAuthProvider.js";
import { BraveSearchProvider } from "./search/braveSearchProvider.js";
import { PullpushProvider } from "./search/pullpushProvider.js";
import { PullpushCommentProvider } from "./search/pullpushCommentProvider.js";
import { HNSearchProvider } from "./search/hnSearchProvider.js";
import { DuckDuckGoSearchProvider } from "./search/duckduckgo.js";
import { BingSearchProvider } from "./search/bingProvider.js";
import { CompositeSearchProvider } from "./search/compositeProvider.js";
import { MockSearchProvider } from "./search/mockProvider.js";
import { GeminiAnalysisProvider } from "./analysis/geminiProvider.js";
import { MockAnalysisProvider } from "./analysis/mockProvider.js";
import { ReadditCore } from "./index.js";
import type { AnalysisProvider, SearchProvider } from "./types.js";

export interface CreateCoreOptions {
  model?: string;
  requestId?: string;
  memoryCache?: boolean;
}

function buildSearchProvider(requestId?: string): SearchProvider {
  const config = loadConfig({ requireAi: false });
  const useMock = process.env.READDIT_MOCK_PROVIDERS === "1";
  if (useMock) return new MockSearchProvider();

  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const redditClientId = process.env.REDDIT_CLIENT_ID?.trim();
  const redditClientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();

  const providers: SearchProvider[] = [];

  if (braveKey) {
    // Brave Search — most reliable, returns real Reddit results, free 2k/month
    providers.push(new BraveSearchProvider(braveKey, requestId));
  } else if (redditClientId && redditClientSecret) {
    // Reddit OAuth — bypasses IP blocking
    providers.push(new RedditOAuthProvider(redditClientId, redditClientSecret, config.userAgent, requestId));
  } else {
    // No keys needed: Pullpush posts + comments (Reddit archive)
    providers.push(new PullpushProvider(requestId));
    providers.push(new PullpushCommentProvider(requestId));
    providers.push(new RedditSearchProvider(config.userAgent, requestId));
  }

  // Always include HN, DuckDuckGo, and Bing — all free, no keys
  providers.push(new HNSearchProvider(requestId));
  providers.push(new DuckDuckGoSearchProvider(config.userAgent, requestId));
  providers.push(new BingSearchProvider(config.userAgent, requestId));

  return new CompositeSearchProvider(providers, requestId);
}

function buildCache(memoryCache: boolean | undefined) {
  const config = loadConfig({ requireAi: false });
  return memoryCache ? new MemoryCacheProvider() : new SqliteCacheProvider(config.databasePath);
}

export function createCoreFromEnv(opts: CreateCoreOptions = {}): ReadditCore {
  const config = loadConfig({ requireAi: true });
  const useMock = process.env.READDIT_MOCK_PROVIDERS === "1";

  return new ReadditCore({
    searchProvider: buildSearchProvider(opts.requestId),
    analysisProvider: useMock
      ? new MockAnalysisProvider()
      : new GeminiAnalysisProvider(config.geminiApiKey!, opts.model ?? config.geminiModel),
    cache: buildCache(opts.memoryCache),
    cacheTtlSeconds: config.cacheTtlSeconds,
  });
}

export function createSearchCoreFromEnv(opts: CreateCoreOptions = {}): ReadditCore {
  return new ReadditCore({
    searchProvider: buildSearchProvider(opts.requestId),
    analysisProvider: new MockAnalysisProvider(),
    cache: buildCache(opts.memoryCache),
    cacheTtlSeconds: loadConfig({ requireAi: false }).cacheTtlSeconds,
  });
}
