import { RateLimiter } from "@readdit/core";

const limiter = new RateLimiter(process.env.DATABASE_URL ?? "./data/readdit.db");

const MAX_PER_HOUR = Number(process.env.READDIT_RATE_LIMIT_PER_HOUR ?? 20);
const WINDOW_SECONDS = 60 * 60;

/** Per-user rate limit for expensive live-analysis endpoints. */
export function checkAnalysisRateLimit(userId: string) {
  return limiter.check(`analyze:${userId}`, MAX_PER_HOUR, WINDOW_SECONDS);
}
