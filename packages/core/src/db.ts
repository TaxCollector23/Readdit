import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const instances = new Map<string, DatabaseSync>();

/**
 * Returns a shared SQLite handle for the given path, using Node's built-in
 * node:sqlite module (Node 22.5+) rather than a native addon like
 * better-sqlite3 — no compiler toolchain required at install time. Readdit
 * uses a single local SQLite file for cache, rate limiting, and (in the web
 * app) users/sessions/saved reports — deliberately not a distributed store,
 * per the "do not overengineer" constraint for this MVP.
 */
export function getDb(path: string): DatabaseSync {
  const resolved = path === ":memory:" ? path : resolve(path);
  const existing = instances.get(resolved);
  if (existing) return existing;

  if (resolved !== ":memory:") {
    mkdirSync(dirname(resolved), { recursive: true });
  }
  const db = new DatabaseSync(resolved);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  instances.set(resolved, db);
  return db;
}
