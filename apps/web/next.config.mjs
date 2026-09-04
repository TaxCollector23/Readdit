import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Next.js only auto-loads .env files from this app's own directory. Readdit
// keeps one shared .env at the monorepo root (used by the CLI and MCP
// server too), so fall back to it here for local development when this
// app doesn't have its own .env.local.
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
if (existsSync(rootEnv)) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    // ignore — values may already be set in the environment
  }
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@readdit/core"],
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
