/**
 * Minimal structured logger. Redacts anything that looks like a secret and
 * never logs full discussion bodies (only counts/ids), keeping logs safe to
 * ship to stdout/observability tools.
 */

const SECRET_PATTERN = /(sk-or-|sk-|Bearer\s+)[A-Za-z0-9\-_.]{10,}/g;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_PATTERN, "[REDACTED]");
  }
  return value;
}

export interface LogFields {
  requestId?: string;
  [key: string]: unknown;
}

// Every log level writes to stderr, never stdout — stdout is reserved
// exclusively for CLI report/JSON output and web API responses. info/debug
// are additionally gated behind READDIT_VERBOSE so a default CLI run stays
// clean; warn/error always print since they indicate real degradation.
function emit(level: "info" | "warn" | "error" | "debug", message: string, fields?: LogFields) {
  const verbose = process.env.READDIT_VERBOSE === "1";
  if ((level === "info" || level === "debug") && !verbose) return;

  const safeFields: LogFields = {};
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      safeFields[k] = redact(v);
    }
  }
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...safeFields,
  };
  console.error(JSON.stringify(line));
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
};

export function newRequestId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
