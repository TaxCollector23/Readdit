import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const instances = new Map<string, DatabaseSync>();

/**
 * A relative DATABASE_URL (the documented default, e.g. "./data/readdit.db")
 * needs to resolve to the SAME absolute file regardless of which package's
 * directory a process happens to be launched from — otherwise the CLI, MCP
 * server, and web app silently end up with three different SQLite files
 * despite sharing one .env. Anchor relative paths to the monorepo root
 * (nearest ancestor of cwd containing pnpm-workspace.yaml) when one can be
 * found; otherwise fall back to plain cwd-relative resolution, so this
 * still behaves sensibly for a standalone (non-monorepo) consumer.
 */
function resolveDataPath(path: string): string {
  if (path === ":memory:" || isAbsolute(path)) return path;

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return resolve(dir, path);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(path);
}

/**
 * Returns a shared SQLite handle for the given path, using Node's built-in
 * node:sqlite module (Node 22.5+) rather than a native addon like
 * better-sqlite3 — no compiler toolchain required at install time. Readdit
 * uses a single local SQLite file for cache, rate limiting, and (in the web
 * app) users/sessions/saved reports — deliberately not a distributed store,
 * per the "do not overengineer" constraint for this MVP.
 */
export function getDb(path: string): DatabaseSync {
  const resolved = resolveDataPath(path);
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
