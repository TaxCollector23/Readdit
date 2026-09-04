import { ConfigurationError } from "./types.js";

export interface ReadditConfig {
  openrouterApiKey: string;
  openrouterModel: string;
  databasePath: string;
  cacheTtlSeconds: number;
  userAgent: string;
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
export function loadConfig(): ReadditConfig {
  const mockMode = readEnv("READDIT_MOCK_PROVIDERS") === "1";
  const missing: string[] = [];

  const openrouterApiKey = readEnv("OPENROUTER_API_KEY");
  if (!openrouterApiKey && !mockMode) missing.push("OPENROUTER_API_KEY");

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Readdit is not configured. Missing: ${missing.join(", ")}`
    );
  }

  return {
    openrouterApiKey: openrouterApiKey ?? "mock-key",
    openrouterModel: readEnv("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini",
    databasePath: readEnv("DATABASE_URL") ?? "./data/readdit.db",
    cacheTtlSeconds: Number(readEnv("READDIT_CACHE_TTL_SECONDS") ?? 21600),
    userAgent:
      readEnv("READDIT_USER_AGENT") ??
      "readdit-research-tool/0.1 (by /u/readdit_bot; +https://github.com)",
  };
}

/** Non-throwing variant used by health checks / diagnostics. */
export function checkConfig(): { ok: boolean; missing: string[] } {
  if (readEnv("READDIT_MOCK_PROVIDERS") === "1") return { ok: true, missing: [] };
  const missing: string[] = [];
  if (!readEnv("OPENROUTER_API_KEY")) missing.push("OPENROUTER_API_KEY");
  return { ok: missing.length === 0, missing };
}
