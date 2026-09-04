import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnv(content) {
  const entries = [];
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

    if (value) entries.push([match[1], value]);
  }
  return entries;
}

function loadEnv(path, override, loadedByUs) {
  if (!existsSync(path)) return;
  try {
    for (const [key, value] of parseEnv(readFileSync(path, "utf8"))) {
      if (process.env[key] === undefined || (override && loadedByUs.has(key))) {
        process.env[key] = value;
        loadedByUs.add(key);
      }
    }
  } catch {
    // ignore — values may already be set in the environment.
  }
}

// Next.js auto-loads env files from apps/web. Readdit also supports one
// root-level .env/.env.local shared by the CLI, MCP server, and web app.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const loadedByUs = new Set();
loadEnv(resolve(repoRoot, ".env"), false, loadedByUs);
loadEnv(resolve(repoRoot, ".env.local"), true, loadedByUs);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@readdit/core"],
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
