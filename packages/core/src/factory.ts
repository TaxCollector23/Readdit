import { loadConfig } from "./config.js";
import { SqliteCacheProvider, MemoryCacheProvider } from "./cache/index.js";
import { RedditSearchProvider } from "./search/redditProvider.js";
import { RedditOAuthProvider } from "./search/redditOAuthProvider.js";
import { DuckDuckGoSearchProvider } from "./search/duckduckgo.js";
import { CompositeSearchProvider } from "./search/compositeProvider.js";
import { MockSearchProvider } from "./search/mockProvider.js";
import { GeminiAnalysisProvider } from "./analysis/geminiProvider.js";
import { MockAnalysisProvider } from "./analysis/mockProvider.js";
import { ReadditCore } from "./index.js";
import type { AnalysisProvider, SearchProvider } from "./types.js";

export interface CreateCoreOptions {
  model?: string;
  requestId?: string;
  /** Use in-memory cache instead of SQLite (useful for tests / serverless). */
  memoryCache?: boolean;
}

function buildSearchProvider(requestId?: string): SearchProvider {
  const config = loadConfig({ requireAi: false });
  const useMock = process.env.READDIT_MOCK_PROVIDERS === "1";
  if (useMock) return new MockSearchProvider();

  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();

  const providers: SearchProvider[] = [];

  if (clientId && clientSecret) {
    // OAuth provider — works from any server IP
    providers.push(new RedditOAuthProvider(clientId, clientSecret, config.userAgent, requestId));
  } else {
    // Fall back to public JSON API (may 403 on some server IPs)
    providers.push(new RedditSearchProvider(config.userAgent, requestId));
  }

  providers.push(new DuckDuckGoSearchProvider(config.userAgent, requestId));

  return new CompositeSearchProvider(providers, requestId);
}

function buildCache(memoryCache: boolean | undefined) {
  const config = loadConfig({ requireAi: false });
  return memoryCache ? new MemoryCacheProvider() : new SqliteCacheProvider(config.databasePath);
}

/**
 * Builds a fully wired ReadditCore from environment configuration. This is
 * the single construction path shared by the CLI, MCP server, and web app.
 */
export function createCoreFromEnv(opts: CreateCoreOptions = {}): ReadditCore {
  const config = loadConfig({ requireAi: true });
  const useMock = process.env.READDIT_MOCK_PROVIDERS === "1";

  const searchProvider = buildSearchProvider(opts.requestId);
  const analysisProvider: AnalysisProvider = useMock
    ? new MockAnalysisProvider()
    : new GeminiAnalysisProvider(config.geminiApiKey!, opts.model ?? config.geminiModel);

  const cache = buildCache(opts.memoryCache);

  return new ReadditCore({ searchProvider, analysisProvider, cache, cacheTtlSeconds: config.cacheTtlSeconds });
}

/** Builds a core instance suitable for retrieval-only APIs; no Gemini key required. */
export function createSearchCoreFromEnv(opts: CreateCoreOptions = {}): ReadditCore {
  return new ReadditCore({
    searchProvider: buildSearchProvider(opts.requestId),
    analysisProvider: new MockAnalysisProvider(),
    cache: buildCache(opts.memoryCache),
    cacheTtlSeconds: loadConfig({ requireAi: false }).cacheTtlSeconds,
  });
}
