import type { CacheProvider } from "../types.js";
import { getDb } from "../db.js";
import { createHash } from "node:crypto";

export class SqliteCacheProvider implements CacheProvider {
  constructor(private dbPath: string) {
    const db = getDb(this.dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
    `);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = getDb(this.dbPath);
    const row = db
      .prepare("SELECT value, expires_at FROM cache WHERE key = ?")
      .get(key) as { value: string; expires_at: number } | undefined;
    if (!row) return undefined;
    if (row.expires_at < Date.now()) {
      db.prepare("DELETE FROM cache WHERE key = ?").run(key);
      return undefined;
    }
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const db = getDb(this.dbPath);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    db.prepare(
      "INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at"
    ).run(key, JSON.stringify(value), expiresAt);
  }

  async delete(key: string): Promise<void> {
    const db = getDb(this.dbPath);
    db.prepare("DELETE FROM cache WHERE key = ?").run(key);
  }
}

export class MemoryCacheProvider implements CacheProvider {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/** Deterministic cache key from a research request's meaningful parameters. */
export function cacheKey(parts: Record<string, unknown>): string {
  const normalized = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${JSON.stringify(parts[k])}`)
    .join("&");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
