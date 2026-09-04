import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Loads a .env file using Node's built-in process.loadEnvFile (Node 20.6+),
 * so no CLI/MCP/web package needs a dotenv dependency. Tries the current
 * working directory first, then walks up from `startDir` (or this module's
 * own location) looking for a monorepo-root .env — this lets the whole
 * workspace share a single root-level .env for local development.
 */
export function loadEnvFile(startDir?: string): void {
  const candidates = [resolve(process.cwd(), ".env")];
  const walked = findUpward(startDir ?? dirname(new URL(import.meta.url).pathname));
  if (walked) candidates.push(walked);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        (process as unknown as { loadEnvFile: (path?: string) => void }).loadEnvFile(candidate);
        return;
      } catch {
        // Try the next candidate.
      }
    }
  }
}

function findUpward(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}
