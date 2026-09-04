import { getDb } from "./db.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

/**
 * Simple fixed-window rate limiter backed by the same local SQLite file as
 * the cache. Good enough for a single-instance MVP deployment — deliberately
 * not a distributed limiter (Redis, etc.), per the "do not overengineer"
 * constraint.
 */
export class RateLimiter {
  constructor(private dbPath: string) {
    const db = getDb(this.dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        bucket_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start INTEGER NOT NULL
      );
    `);
  }

  check(key: string, maxPerWindow: number, windowSeconds: number): RateLimitResult {
    const db = getDb(this.dbPath);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const row = db
      .prepare("SELECT count, window_start FROM rate_limits WHERE bucket_key = ?")
      .get(key) as { count: number; window_start: number } | undefined;

    if (!row || now - row.window_start >= windowMs) {
      db.prepare(
        "INSERT INTO rate_limits (bucket_key, count, window_start) VALUES (?, 1, ?) " +
          "ON CONFLICT(bucket_key) DO UPDATE SET count = 1, window_start = excluded.window_start"
      ).run(key, now);
      return { allowed: true, remaining: maxPerWindow - 1, retryAfterSeconds: 0, limit: maxPerWindow };
    }

    if (row.count >= maxPerWindow) {
      const retryAfterSeconds = Math.ceil((row.window_start + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds, limit: maxPerWindow };
    }

    db.prepare("UPDATE rate_limits SET count = count + 1 WHERE bucket_key = ?").run(key);
    return {
      allowed: true,
      remaining: maxPerWindow - row.count - 1,
      retryAfterSeconds: 0,
      limit: maxPerWindow,
    };
  }
}
