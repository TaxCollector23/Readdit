import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Loads .env and .env.local without a dotenv dependency. Root .env.local is
 * useful for local secrets shared by the CLI/MCP/web app, while blank values
 * in a checked-out template should behave like "unset" rather than wiping out
 * a real value from .env or the shell.
 */
export function loadEnvFile(startDir?: string): void {
  const loadedByUs = new Set<string>();
  const dirs = unique([
    findConfigDir(process.cwd()),
    findConfigDir(startDir ?? dirname(new URL(import.meta.url).pathname)),
    resolve(process.cwd()),
  ]);

  for (const dir of dirs) {
    loadEnvCandidate(join(dir, ".env"), false, loadedByUs);
    loadEnvCandidate(join(dir, ".env.local"), true, loadedByUs);
  }
}

function findConfigDir(startDir: string): string {
  let dir = startDir;
  let firstEnvDir: string | undefined;
  for (let i = 0; i < 8; i++) {
    if (!firstEnvDir && (existsSync(join(dir, ".env")) || existsSync(join(dir, ".env.local")))) {
      firstEnvDir = dir;
    }
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return firstEnvDir ?? resolve(startDir);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => resolve(value))));
}

function loadEnvCandidate(path: string, override: boolean, loadedByUs: Set<string>): void {
  if (!existsSync(path)) return;

  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const [key, value] of parseEnv(content)) {
    if (value.trim().length === 0) continue;
    const canSet = process.env[key] === undefined || (override && loadedByUs.has(key));
    if (canSet) {
      process.env[key] = value;
      loadedByUs.add(key);
    }
  }
}

function parseEnv(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(" #");
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
    }

    entries.push([match[1], value]);
  }
  return entries;
}
