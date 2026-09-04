import {
  createCoreFromEnv,
  checkConfig,
  loadEnvFile,
  ReadditError,
  RateLimitedError,
  ConfigurationError,
  type ReadditOptions,
  type RedditReport,
  type CompareReport,
} from "@readdit/core";
loadEnvFile();

import { Command } from "commander";
import { StatusReporter, theme, RULE } from "./ui/theme.js";
import { formatCompareReport, formatReport } from "./ui/format.js";

const program = new Command();

program
  .name("readdit")
  .description(
    "Readdit reads Reddit so you don't have to. Evidence-backed Reddit research from your terminal."
  )
  .version("0.1.0")
  .option("--json", "output machine-readable JSON only (no decorative output)")
  .option("--limit <number>", "max discussions to retrieve", parseIntOption)
  .option("--model <model>", "OpenRouter model override, e.g. anthropic/claude-sonnet-4.5")
  .option("--fresh", "bypass the cache and re-research")
  .option("--verbose", "print diagnostic info on failure")
  .option("--quiet", "suppress status lines")
  .option("--no-color", "disable colored output")
  .option("--depth <depth>", "research depth: quick | standard | deep");

function parseIntOption(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("must be a positive number");
  }
  return n;
}

interface GlobalOpts {
  json?: boolean;
  limit?: number;
  model?: string;
  fresh?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  color?: boolean;
  depth?: "quick" | "standard" | "deep";
}

const PROGRESS_MESSAGES: Record<string, string> = {
  planning: "Planning research...",
  searching: "Searching Reddit...",
  ranking: "Ranking relevant discussions...",
  extracting_evidence: "Extracting evidence...",
  synthesizing: "Synthesizing Reddit's opinions...",
};

function readditOptionsFrom(opts: GlobalOpts, status?: StatusReporter): ReadditOptions {
  return {
    limit: opts.limit,
    model: opts.model,
    fresh: opts.fresh,
    depth: opts.depth,
    onProgress: status
      ? (stage, detail) => {
          if (stage === "done") return;
          status.step(detail ?? PROGRESS_MESSAGES[stage] ?? stage);
        }
      : undefined,
  };
}

function exitCodeFor(err: unknown): number {
  if (err instanceof ReadditError) {
    switch (err.code) {
      case "invalid_input":
        return 2;
      case "configuration_error":
        return 3;
      case "rate_limited":
        return 5;
      case "no_results":
        return 1;
      default:
        return 1;
    }
  }
  return 1;
}

function printError(err: unknown, opts: GlobalOpts): void {
  const message = err instanceof Error ? err.message : String(err);

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          error: true,
          code: err instanceof ReadditError ? err.code : "unknown_error",
          message,
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  process.stderr.write(`\n${theme.red("Readdit couldn't finish that request.")}\n\n`);
  process.stderr.write(`${message}\n`);

  if (err instanceof ReadditError && err.code === "configuration_error") {
    process.stderr.write(`\nAdd the missing variable(s) to your environment or a .env file.\n`);
  }
  if (err instanceof RateLimitedError && err.retryAfterSeconds) {
    process.stderr.write(`\nRetry in about ${err.retryAfterSeconds}s.\n`);
  }
  if (!opts.verbose) {
    process.stderr.write(`\nRun with --verbose for diagnostics.\n`);
  } else if (err instanceof Error && err.stack) {
    process.stderr.write(`\n${theme.dim(err.stack)}\n`);
  }
}

/**
 * Throws (rather than calling process.exit itself) so this behaves
 * correctly no matter where it's called from — including inside the
 * interactive REPL, where a hard process.exit() would kill the whole
 * session instead of just failing the one query, and would skip the
 * readline cleanup in runInteractive's `finally`. execute() below is what
 * turns this into the right exit code once the process actually ends.
 */
function assertConfigured(): void {
  const { ok, missing } = checkConfig();
  if (ok) return;
  throw new ConfigurationError(`Readdit is not configured. Missing: ${missing.join(", ")}`);
}

async function runAnalyze(
  topic: string,
  method: "analyze" | "complaints" | "features" | "sentiment",
  opts: GlobalOpts
): Promise<void> {
  assertConfigured();
  const status = new StatusReporter(!opts.json && !opts.quiet);
  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Reading it...")}\n\n`);
  }

  const core = createCoreFromEnv({ model: opts.model });
  const report: RedditReport = await core[method](topic, readditOptionsFrom(opts, status));
  status.done(`Analyzed ${report.sourceCount} discussions across ${report.subreddits.length} subreddits.`);
  if (!opts.json && !opts.quiet) process.stdout.write("\n");

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(report) + "\n");
  }
}

async function runCompare(topicA: string, topicB: string, opts: GlobalOpts): Promise<void> {
  assertConfigured();
  const status = new StatusReporter(!opts.json && !opts.quiet);
  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Reading it...")}\n\n`);
  }

  const core = createCoreFromEnv({ model: opts.model });
  const report: CompareReport = await core.compare(
    topicA,
    topicB,
    readditOptionsFrom(opts, status)
  );
  status.done(`Compared using ${report.sourceCount} discussions.`);
  if (!opts.json && !opts.quiet) process.stdout.write("\n");

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatCompareReport(report) + "\n");
  }
}

async function runAsk(question: string, opts: GlobalOpts): Promise<void> {
  assertConfigured();
  const status = new StatusReporter(!opts.json && !opts.quiet);
  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Reading it...")}\n\n`);
  }

  const core = createCoreFromEnv({ model: opts.model });
  const report = await core.ask(question, readditOptionsFrom(opts, status));
  status.done(`Answered using ${report.sourceCount} discussions.`);
  if (!opts.json && !opts.quiet) process.stdout.write("\n");

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(report) + "\n");
  }
}

async function runSearch(topic: string, opts: GlobalOpts): Promise<void> {
  assertConfigured();
  const status = new StatusReporter(!opts.json && !opts.quiet);
  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Searching, no analysis...")}\n\n`);
  }

  const core = createCoreFromEnv({ model: opts.model });
  const { discussions, queriesUsed } = await core.search(topic, readditOptionsFrom(opts, status));

  if (opts.json) {
    process.stdout.write(JSON.stringify({ query: topic, queriesUsed, discussions }, null, 2) + "\n");
    return;
  }

  process.stdout.write(`${theme.bold(topic)}\n${RULE}\n`);
  process.stdout.write(theme.dim(`Queries: ${queriesUsed.join(" | ")}\n\n`));
  for (const d of discussions) {
    process.stdout.write(`${theme.cyan(d.title)}\n`);
    process.stdout.write(
      theme.dim(
        `  r/${d.subreddit ?? "?"} · score ${d.score ?? "?"} · relevance ${d.relevanceScore.toFixed(2)}\n`
      )
    );
    process.stdout.write(theme.dim(`  ${d.url}\n\n`));
  }
  process.stdout.write(theme.dim(`${discussions.length} discussions.\n`));
}

function globalOpts(): GlobalOpts {
  return program.opts<GlobalOpts>();
}

const GLOBAL_OPTS_HELP = `
Global options (pass anywhere, e.g. before the subcommand):
  --json | --limit <n> | --model <model> | --fresh | --depth <depth> | --verbose | --quiet | --no-color

Examples:`;

program
  .command("analyze <query>")
  .alias("a")
  .description("Full evidence-backed Reddit analysis of a topic")
  .addHelpText(
    "after",
    `${GLOBAL_OPTS_HELP}\n  $ readdit analyze "Cursor"\n  $ readdit analyze "Cursor" --json --limit 50`
  )
  .action(async (query: string) => {
    await execute(() => runAnalyze(query, "analyze", globalOpts()));
  });

program
  .command("compare <topicA> <topicB>")
  .alias("c")
  .description("Compare how Reddit discusses two products/topics")
  .addHelpText(
    "after",
    `${GLOBAL_OPTS_HELP}\n  $ readdit compare "Cursor" "Claude Code"`
  )
  .action(async (topicA: string, topicB: string) => {
    await execute(() => runCompare(topicA, topicB, globalOpts()));
  });

program
  .command("complaints <query>")
  .alias("co")
  .description("Strongest recurring complaints about a topic, with evidence")
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit complaints "Vercel"`)
  .action(async (query: string) => {
    await execute(() => runAnalyze(query, "complaints", globalOpts()));
  });

program
  .command("features <query>")
  .alias("f")
  .description("Recurring feature requests / missing functionality")
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit features "OpenWebUI"`)
  .action(async (query: string) => {
    await execute(() => runAnalyze(query, "features", globalOpts()));
  });

program
  .command("sentiment <query>")
  .alias("sent")
  .description("Overall Reddit sentiment toward a topic")
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit sentiment "Qwen"`)
  .action(async (query: string) => {
    await execute(() => runAnalyze(query, "sentiment", globalOpts()));
  });

program
  .command("ask <question>")
  .description('Ask a natural-language question, e.g. "Why are people leaving Cursor?"')
  .addHelpText(
    "after",
    `${GLOBAL_OPTS_HELP}\n  $ readdit ask "Why are people leaving Cursor?"`
  )
  .action(async (question: string) => {
    await execute(() => runAsk(question, globalOpts()));
  });

program
  .command("search <query>")
  .alias("se")
  .description("Retrieve and rank Reddit discussions without LLM synthesis (source-only mode)")
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit search "RTX 5070 Ti" --limit 30`)
  .action(async (query: string) => {
    await execute(() => runSearch(query, globalOpts()));
  });

program.addHelpText(
  "after",
  `
Examples:
  $ readdit "Cursor"                                  (shorthand for analyze)
  $ readdit analyze "Cursor" --json
  $ readdit compare "Cursor" "Claude Code"
  $ readdit complaints "Vercel"
  $ readdit ask "Why are people leaving Cursor?"
  $ readdit "Cursor" --fresh --depth deep

Readdit. It reads Reddit.`
);

/**
 * Reads a piped query from stdin, e.g. `echo "Cursor" | readdit`. Bounded by
 * a short timeout: a non-TTY stdin that's simply open and idle (common
 * under a process supervisor that hands the child an unused pipe fd) would
 * otherwise block this for-await loop forever, since there's no EOF and no
 * data. If nothing arrives quickly, treat it as "nothing was piped" rather
 * than hanging.
 */
async function readStdinIfPiped(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;

  const TIMED_OUT = Symbol("timed_out");
  let timer: NodeJS.Timeout;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), 300);
    timer.unref?.();
  });

  const read = (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8").trim();
  })();

  const result = await Promise.race([read, timeout]);
  clearTimeout(timer!);

  if (result === TIMED_OUT) {
    // Detach from the still-pending read so an idle stdin can't keep the
    // process alive waiting for a signal that will never arrive.
    process.stdin.pause();
    return undefined;
  }
  return result.length > 0 ? result : undefined;
}

async function runInteractive(opts: GlobalOpts): Promise<void> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Reading it, interactively.")}\n\n`);
  process.stdout.write(theme.dim('Type a topic or question, or "exit" to quit.\n\n'));

  try {
    while (true) {
      const query = (await rl.question(theme.cyan("readdit> "))).trim();
      if (!query || query === "exit" || query === "quit") break;
      process.stdout.write("\n");
      await execute(() => runAnalyze(query, "analyze", opts));
      process.exitCode = 0; // one failed query in a REPL shouldn't taint the session's exit code
      process.stdout.write("\n");
    }
  } finally {
    rl.close();
  }
}

// Shorthand: `readdit "Cursor"` behaves like `readdit analyze "Cursor"`.
// With no query at all: read a piped stdin query if present, otherwise (on
// a TTY) drop into a small interactive research session.
program
  .argument("[query]", "topic to research (shorthand for `analyze`)")
  .action(async (query: string | undefined) => {
    if (query) {
      await execute(() => runAnalyze(query, "analyze", globalOpts()));
      return;
    }
    const piped = await readStdinIfPiped();
    if (piped) {
      await execute(() => runAnalyze(piped, "analyze", globalOpts()));
      return;
    }
    if (process.stdin.isTTY && process.stdout.isTTY) {
      await runInteractive(globalOpts());
      return;
    }
    program.help();
  });

async function execute(fn: () => Promise<void>): Promise<void> {
  const opts = program.opts<GlobalOpts>();
  if (opts.verbose) process.env.READDIT_VERBOSE = "1";
  try {
    await fn();
  } catch (err) {
    printError(err, opts);
    process.exitCode = exitCodeFor(err);
  }
}

program.parseAsync(process.argv).catch((err) => {
  printError(err, program.opts<GlobalOpts>());
  process.exitCode = 1;
});
