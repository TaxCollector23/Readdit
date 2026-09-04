import { loadConfig } from "./config.js";
import { SqliteCacheProvider, MemoryCacheProvider } from "./cache/index.js";
import { RedditSearchProvider } from "./search/redditProvider.js";
import { DuckDuckGoSearchProvider } from "./search/duckduckgo.js";
import { OpenRouterSearchProvider } from "./search/openrouterSearchProvider.js";
import { CompositeSearchProvider } from "./search/compositeProvider.js";
import { MockSearchProvider } from "./search/mockProvider.js";
import { OpenRouterAnalysisProvider } from "./analysis/openrouterProvider.js";
import { MockAnalysisProvider } from "./analysis/mockProvider.js";
import { ReadditCore } from "./index.js";
import type { AnalysisProvider, SearchProvider } from "./types.js";

export interface CreateCoreOptions {
  model?: string;
  requestId?: string;
  /** Use in-memory cache instead of SQLite (useful for tests / serverless). */
  memoryCache?: boolean;
}

/**
 * Builds a fully wired ReadditCore from environment configuration. This is
 * the single construction path shared by the CLI, MCP server, and web app —
 * so a fix to provider wiring benefits every interface at once.
 */
export function createCoreFromEnv(opts: CreateCoreOptions = {}): ReadditCore {
  const config = loadConfig();

  const useMock = process.env.READDIT_MOCK_PROVIDERS === "1";

  const searchProvider: SearchProvider = useMock
    ? new MockSearchProvider()
    : new CompositeSearchProvider(
        [
          new RedditSearchProvider(config.userAgent, opts.requestId),
          new DuckDuckGoSearchProvider(config.userAgent, opts.requestId),
          new OpenRouterSearchProvider(
            config.openrouterApiKey,
            config.openrouterModel,
            opts.requestId
          ),
        ],
        opts.requestId
      );

  const analysisProvider: AnalysisProvider = useMock
    ? new MockAnalysisProvider()
    : new OpenRouterAnalysisProvider(config.openrouterApiKey, opts.model ?? config.openrouterModel);

  const cache = opts.memoryCache
    ? new MemoryCacheProvider()
    : new SqliteCacheProvider(config.databasePath);

  return new ReadditCore({
    searchProvider,
    analysisProvider,
    cache,
    cacheTtlSeconds: config.cacheTtlSeconds,
  });
}
