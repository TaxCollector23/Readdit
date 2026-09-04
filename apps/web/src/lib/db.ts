import { getDb } from "@readdit/core";
import { randomUUID } from "node:crypto";

function dbPath(): string {
  return process.env.DATABASE_URL ?? "./data/readdit.db";
}

let migrated = false;

/** Lazily creates the web app's own tables in the shared Readdit SQLite file. */
export function db() {
  const handle = getDb(dbPath());
  if (!migrated) {
    handle.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        intent TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_user ON search_history(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS saved_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_reports(user_id, created_at DESC);
    `);
    migrated = true;
  }
  return handle;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export function findUserByEmail(email: string): User | undefined {
  const row = db()
    .prepare("SELECT id, email, password_hash as passwordHash FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as User | undefined;
  return row;
}

export function createUser(email: string, passwordHash: string): User {
  const id = randomUUID();
  db()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, email.toLowerCase().trim(), passwordHash, Date.now());
  return { id, email: email.toLowerCase().trim(), passwordHash };
}

export function recordSearchHistory(userId: string, query: string, intent: string): void {
  db()
    .prepare(
      "INSERT INTO search_history (id, user_id, query, intent, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(randomUUID(), userId, query, intent, Date.now());
}

export interface HistoryEntry {
  id: string;
  query: string;
  intent: string;
  createdAt: number;
}

export function getSearchHistory(userId: string, limit = 20): HistoryEntry[] {
  return db()
    .prepare(
      "SELECT id, query, intent, created_at as createdAt FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(userId, limit) as unknown as HistoryEntry[];
}
