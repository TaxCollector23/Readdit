import { logger } from "./logger.js";

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  requestId?: string;
}

/**
 * fetch() with a hard timeout and bounded exponential backoff retry on
 * transient failures (network errors, 429, 5xx). Never retries on 4xx other
 * than 429 — those are not going to succeed on retry.
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchJsonOptions = {}
): Promise<Response> {
  const { headers = {}, timeoutMs = 8000, retries = 2, requestId } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const backoff = Math.min(2000 * 2 ** attempt, 8000);
          logger.warn("transient_fetch_failure_retrying", {
            requestId,
            url: safeUrl(url),
            status: res.status,
            attempt,
          });
          await sleep(backoff);
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        const backoff = Math.min(1500 * 2 ** attempt, 6000);
        logger.warn("fetch_error_retrying", {
          requestId,
          url: safeUrl(url),
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(backoff);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
