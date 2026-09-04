import { Command } from "commander";
import { StatusReporter, theme, RULE } from "./ui/theme.js";
import { formatCompareReport, formatReport } from "./ui/format.js";
import {
  loadCredentials,
  getIdToken,
  saveCredentials,
  clearCredentials,
  runLoginFlow,
  type Credentials,
} from "./auth.js";
import { cloudStream, cloudSearchRaw } from "./api.js";
import type { RedditReport, CompareReport, NormalizedDiscussion } from "@readdit/core";

const program = new Command();

program
  .name("readdit")
  .description(
    "Readdit reads Reddit so you don't have to. Evidence-backed Reddit research from your terminal.\n" +
      "Run `readdit login` to get started — no API keys required."
  )
  .version("0.2.0")
  .option("--json", "output machine-readable JSON only (no decorative output)")
  .option("--limit <number>", "max discussions to retrieve", parseIntOption)
  .option("--fresh", "bypass the cache and re-research")
  .option("--verbose", "print diagnostic info on failure")
  .option("--quiet", "suppress status lines")
  .option("--no-color", "disable colored output")
  .option("--depth <depth>", "research depth: quick | standard | deep");

function parseIntOption(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("must be a positive number");
  return n;
}

interface GlobalOpts {
  json?: boolean;
  limit?: number;
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

/** Load credentials and get a fresh ID token, or exit with a friendly error. */
async function requireAuth(): Promise<{ idToken: string; creds: Credentials }> {
  const creds = await loadCredentials();
  if (!creds) {
    process.stderr.write(
      `\n${theme.red("Not logged in.")} Run ${theme.cyan("readdit login")} to get started — no API keys required.\n\n`
    );
    process.exitCode = 3;
    throw new Error("unauthenticated");
  }

  const tokens = await getIdToken(creds);
  if (!tokens) {
    process.stderr.write(
      `\n${theme.red("Session expired.")} Run ${theme.cyan("readdit login")} to sign in again.\n\n`
    );
    process.exitCode = 3;
    throw new Error("unauthenticated");
  }

  // Persist updated refresh token (Firebase rotates it on each use)
  const updated: Credentials = { ...creds, refreshToken: tokens.refreshToken };
  await saveCredentials(updated);

  return { idToken: tokens.idToken, creds: updated };
}

async function runAnalyze(
  topic: string,
  intent: "analyze" | "complaints" | "features" | "sentiment",
  opts: GlobalOpts
): Promise<void> {
  const { idToken } = await requireAuth();
  const status = new StatusReporter(!opts.json && !opts.quiet);

  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Reading it...")}\n\n`);
  }

  let report: RedditReport | null = null;

  for await (const evt of cloudStream(
    "analyze",
    {
      query: topic,
      intent,
      limit: opts.limit ?? 25,
      fresh: opts.fresh,
      depth: opts.depth,
    },
    idToken
  )) {
    if (evt.type === "progress" && evt.stage) {
      status.step(evt.detail ?? PROGRESS_MESSAGES[evt.stage] ?? evt.stage);
    } else if (evt.type === "result" && evt.report) {
      report = evt.report as RedditReport;
    } else if (evt.type === "error") {
      throw new Error(evt.error ?? "Something went wrong.");
    }
  }

  if (!report) throw new Error("No report received from server.");

  status.done(
    `Analyzed ${report.sourceCount} discussions across ${report.subreddits.length} subreddits.`
  );
  if (!opts.json && !opts.quiet) process.stdout.write("\n");

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(report) + "\n");
  }
}

async function runCompare(topicA: string, topicB: string, opts: GlobalOpts): Promise<void> {
  const { idToken } = await requireAuth();
  const status = new StatusReporter(!opts.json && !opts.quiet);

  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Comparing...")}\n\n`);
  }

  let report: CompareReport | null = null;

  for await (const evt of cloudStream(
    "compare",
    {
      topicA,
      topicB,
      limit: opts.limit ?? 25,
      fresh: opts.fresh,
      depth: opts.depth,
    },
    idToken
  )) {
    if (evt.type === "progress" && evt.stage) {
      status.step(evt.detail ?? PROGRESS_MESSAGES[evt.stage] ?? evt.stage);
    } else if (evt.type === "result" && evt.report) {
      report = evt.report as CompareReport;
    } else if (evt.type === "error") {
      throw new Error(evt.error ?? "Something went wrong.");
    }
  }

  if (!report) throw new Error("No comparison received from server.");

  status.done(`Compared using ${report.sourceCount} discussions.`);
  if (!opts.json && !opts.quiet) process.stdout.write("\n");

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatCompareReport(report) + "\n");
  }
}

async function runAsk(question: string, opts: GlobalOpts): Promise<void> {
  const { idToken } = await requireAuth();
  const status = new StatusReporter(!opts.json && !opts.quiet);

  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Reading it...")}\n\n`);
  }

  let report: RedditReport | null = null;

  for await (const evt of cloudStream(
    "analyze",
    {
      query: question,
      intent: "ask",
      limit: opts.limit ?? 25,
      fresh: opts.fresh,
      depth: opts.depth,
    },
    idToken
  )) {
    if (evt.type === "progress" && evt.stage) {
      status.step(evt.detail ?? PROGRESS_MESSAGES[evt.stage] ?? evt.stage);
    } else if (evt.type === "result" && evt.report) {
      report = evt.report as RedditReport;
    } else if (evt.type === "error") {
      throw new Error(evt.error ?? "Something went wrong.");
    }
  }

  if (!report) throw new Error("No report received from server.");

  status.done(`Answered using ${report.sourceCount} discussions.`);
  if (!opts.json && !opts.quiet) process.stdout.write("\n");

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(report) + "\n");
  }
}

async function runSearch(topic: string, opts: GlobalOpts): Promise<void> {
  const status = new StatusReporter(!opts.json && !opts.quiet);

  if (!opts.json && !opts.quiet) {
    process.stdout.write(`${theme.brand("Readdit")}\n${theme.dim("Searching...")}\n\n`);
  }

  status.step("Searching Reddit...");
  const { discussions, queriesUsed } = await cloudSearchRaw(topic, opts.limit ?? 20);
  status.done(`${discussions.length} discussions found.`);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ query: topic, queriesUsed, discussions }, null, 2) + "\n");
    return;
  }

  process.stdout.write(`${theme.bold(topic)}\n${RULE}\n`);
  process.stdout.write(theme.dim(`Queries: ${queriesUsed.join(" | ")}\n\n`));

  for (const d of discussions as NormalizedDiscussion[]) {
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
  --json | --limit <n> | --fresh | --depth <depth> | --verbose | --quiet | --no-color

Examples:`;

// ── Auth commands ───────────────────────────────────────────────────────────

program
  .command("login")
  .description("Sign in with Google — opens your browser, no API key needed")
  .action(async () => {
    process.stdout.write(`${theme.brand("Readdit")}\n`);
    process.stdout.write(`Opening browser to sign in with Google...\n\n`);

    try {
      const creds = await runLoginFlow();
      await saveCredentials(creds);
      process.stdout.write(
        `${theme.green("✓")} Logged in${creds.email ? ` as ${theme.bold(creds.email)}` : ""}.\n\n`
      );
      process.stdout.write(
        `You can now run:\n  ${theme.cyan('readdit "Cursor"')}\n  ${theme.cyan('readdit compare "Linear" "Jira"')}\n`
      );
    } catch (err) {
      process.stderr.write(
        `\n${theme.red("Login failed:")} ${err instanceof Error ? err.message : String(err)}\n`
      );
      process.exitCode = 1;
    }
  });

program
  .command("logout")
  .description("Sign out and remove stored credentials")
  .action(async () => {
    await clearCredentials();
    process.stdout.write(`${theme.green("✓")} Signed out.\n`);
  });

program
  .command("whoami")
  .description("Show the currently signed-in account")
  .action(async () => {
    const creds = await loadCredentials();
    if (!creds) {
      process.stdout.write(`Not signed in. Run ${theme.cyan("readdit login")}.\n`);
      return;
    }
    const tokens = await getIdToken(creds);
    if (!tokens) {
      process.stdout.write(`Session expired. Run ${theme.cyan("readdit login")} again.\n`);
      return;
    }
    process.stdout.write(
      `Signed in${creds.email ? ` as ${theme.bold(creds.email)}` : " (no email stored)"}.\n`
    );
  });

// ── Research commands ───────────────────────────────────────────────────────

program
  .command("analyze <query>")
  .alias("a")
  .description("Full evidence-backed Reddit analysis of a topic")
  .addHelpText(
    "after",
    `${GLOBAL_OPTS_HELP}\n  $ readdit analyze "Cursor"\n  $ readdit analyze "Cursor" --json`
  )
  .action(async (query: string) => {
    await execute(() => runAnalyze(query, "analyze", globalOpts()));
  });

program
  .command("compare <topicA> <topicB>")
  .alias("c")
  .description("Compare how Reddit discusses two products")
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit compare "Cursor" "Claude Code"`)
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
  .description("Recurring feature requests and missing functionality")
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
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit ask "Why are people leaving Cursor?"`)
  .action(async (question: string) => {
    await execute(() => runAsk(question, globalOpts()));
  });

program
  .command("search <query>")
  .alias("se")
  .description("Find Reddit discussions without AI synthesis — fast, no login needed")
  .addHelpText("after", `${GLOBAL_OPTS_HELP}\n  $ readdit search "RTX 5070 Ti" --limit 30`)
  .action(async (query: string) => {
    await execute(() => runSearch(query, globalOpts()));
  });

program.addHelpText(
  "after",
  `
Getting started:
  $ readdit login                               Sign in (opens browser, no API key)

Examples:
  $ readdit "Cursor"                            Shorthand for analyze
  $ readdit analyze "Cursor" --json
  $ readdit compare "Cursor" "Claude Code"
  $ readdit complaints "Vercel"
  $ readdit ask "Why are people leaving Cursor?"
  $ readdit search "Linear app"                 No login needed

Readdit. It reads Reddit.`
);

// Shorthand: `readdit "Cursor"` → analyze. No query → interactive or help.
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

async function readStdinIfPiped(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;

  const TIMED_OUT = Symbol("timed_out");
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), 300);
    (timer as unknown as { unref?: () => void }).unref?.();
  });

  const read = (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8").trim();
  })();

  const result = await Promise.race([read, timeout]);
  clearTimeout(timer!);

  if (result === TIMED_OUT) {
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
      process.exitCode = 0;
      process.stdout.write("\n");
    }
  } finally {
    rl.close();
  }
}

function printError(err: unknown, opts: GlobalOpts): void {
  // Auth errors are already printed by requireAuth(); skip double-printing
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "unauthenticated") return;

  if (opts.json) {
    process.stdout.write(
      JSON.stringify({ error: true, message: msg }, null, 2) + "\n"
    );
    return;
  }

  process.stderr.write(`\n${theme.red("Readdit couldn't finish that request.")}\n\n${msg}\n`);
  if (!opts.verbose) process.stderr.write(`\nRun with --verbose for diagnostics.\n`);
  else if (err instanceof Error && err.stack) {
    process.stderr.write(`\n${theme.dim(err.stack)}\n`);
  }
}

async function execute(fn: () => Promise<void>): Promise<void> {
  const opts = program.opts<GlobalOpts>();
  if (opts.verbose) process.env.READDIT_VERBOSE = "1";
  try {
    await fn();
  } catch (err) {
    printError(err, opts);
    if (process.exitCode === undefined || process.exitCode === 0) {
      process.exitCode = 1;
    }
  }
}

program.parseAsync(process.argv).catch((err) => {
  printError(err, program.opts<GlobalOpts>());
  process.exitCode = 1;
});
