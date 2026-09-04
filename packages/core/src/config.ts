import { ConfigurationError } from "./types.js";

export interface ReadditConfig {
  geminiApiKey?: string;
  geminiModel: string;
  databasePath: string;
  cacheTtlSeconds: number;
  userAgent: string;
}

export interface LoadConfigOptions {
  /** Analysis/synthesis needs Gemini; retrieval-only paths do not. */
  requireAi?: boolean;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Loads Readdit configuration from the environment. Missing required values
 * raise a ConfigurationError with the exact variable name(s) that are missing
 * so CLI/web/MCP callers can surface an actionable message instead of a stack trace.
 */
export function loadConfig(options: LoadConfigOptions = {}): ReadditConfig {
  const requireAi = options.requireAi ?? true;
  const mockMode = readEnv("READDIT_MOCK_PROVIDERS") === "1";
  const missing: string[] = [];

  const geminiApiKey = readEnv("GEMINI_API_KEY") ?? readEnv("GOOGLE_AI_STUDIO_API_KEY");
  if (!geminiApiKey && requireAi && !mockMode) missing.push("GEMINI_API_KEY");

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Readdit is not configured. Missing: ${missing.join(", ")}`
    );
  }

  return {
    geminiApiKey,
    geminiModel: readEnv("GEMINI_MODEL") ?? "gemini-2.5-flash",
    databasePath: readEnv("DATABASE_URL") ?? "./data/readdit.db",
    cacheTtlSeconds: Number(readEnv("READDIT_CACHE_TTL_SECONDS") ?? 21600),
    userAgent:
      readEnv("READDIT_USER_AGENT") ??
      "readdit-research-tool/0.1 (by /u/readdit_bot; +https://github.com)",
  };
}

/** Non-throwing variant used by health checks / diagnostics. */
export function checkConfig(options: LoadConfigOptions = {}): { ok: boolean; missing: string[] } {
  const requireAi = options.requireAi ?? true;
  if (readEnv("READDIT_MOCK_PROVIDERS") === "1") return { ok: true, missing: [] };
  const missing: string[] = [];
  if (requireAi && !readEnv("GEMINI_API_KEY") && !readEnv("GOOGLE_AI_STUDIO_API_KEY")) {
    missing.push("GEMINI_API_KEY");
  }
  return { ok: missing.length === 0, missing };
}
