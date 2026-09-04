#!/usr/bin/env node
// --no-color must be set before picocolors (imported by main.ts) detects
// color support, so this bootstrap sets it and only then dynamically
// imports the rest of the CLI — dynamic import() runs in program order,
// unlike static imports, which are hoisted above this check.
if (process.argv.includes("--no-color") || process.env.NO_COLOR) {
  process.env.NO_COLOR = "1";
}

await import("./main.js");
