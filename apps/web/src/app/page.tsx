import Link from "next/link";
import { Header } from "@/components/Header";

const CLI_EXAMPLE = `$ readdit "Cursor"

Readdit
Reading it...

› Searching Reddit...
› Ranking relevant discussions...
› Extracting evidence...
✓ Analyzed 87 discussions across 24 subreddits

74/100  POSITIVE   Confidence: High

SUMMARY
Cursor is generally viewed positively, with agent
capabilities being the biggest recurring strength.
The most common complaints concern pricing and
reliability under heavy use.

PEOPLE LIKE
• Agent workflows and fast code generation
• VS Code-familiar editor integration

COMMON COMPLAINTS
• Pricing at higher usage tiers
• Occasional agent reliability issues

EVIDENCE
r/cursor — "Switched from Copilot, agent mode is..."
https://reddit.com/r/cursor/...`;

const MCP_CONFIG = `{
  "mcpServers": {
    "readdit": {
      "command": "npx",
      "args": ["-y", "@readdit/mcp"],
      "env": { "OPENROUTER_API_KEY": "sk-or-..." }
    }
  }
}`;

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 sm:py-28">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
            Reddit + read it
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Readdit reads Reddit so you don&apos;t have to.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            An evidence-first research engine for what Reddit actually says about products,
            companies, technologies, and AI tools — as a CLI, an MCP server, and a web
            playground, all backed by the same research pipeline.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/playground"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Try the playground
            </Link>
            <Link
              href="/demo"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
            >
              See an example report
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          <Feature title="Evidence-first">
            Every conclusion traces back to real, linked Reddit discussions — not a generic
            model summary. No sources, no claim.
          </Feature>
          <Feature title="Research pipeline">
            Query planning, retrieval, deduplication, relevance ranking, and cross-source
            synthesis — not search-then-summarize.
          </Feature>
          <Feature title="Three interfaces, one core">
            CLI, MCP server, and web playground all call the same research engine, so results
            stay consistent everywhere.
          </Feature>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="mb-2 text-lg font-semibold text-ink">From your terminal</h2>
          <p className="mb-5 text-sm text-muted">
            Install the CLI and research any topic in one command.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-5 font-mono text-xs leading-relaxed text-ink">
            {CLI_EXAMPLE}
          </pre>
          <p className="mt-4 font-mono text-xs text-muted">
            npm install -g readdit-cli &nbsp;·&nbsp; readdit compare &quot;Cursor&quot;
            &quot;Claude Code&quot; &nbsp;·&nbsp; readdit --json
          </p>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="mb-2 text-lg font-semibold text-ink">From an AI agent, via MCP</h2>
          <p className="mb-5 text-sm text-muted">
            Give your coding agent evidence-backed Reddit research as a tool call, not a guess
            from training data.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-5 font-mono text-xs leading-relaxed text-ink">
            {MCP_CONFIG}
          </pre>
          <p className="mt-4 text-sm text-muted">
            Exposes <code className="text-ink">readdit_search</code>,{" "}
            <code className="text-ink">readdit_analyze</code>,{" "}
            <code className="text-ink">readdit_compare</code>,{" "}
            <code className="text-ink">readdit_complaints</code>,{" "}
            <code className="text-ink">readdit_features</code>,{" "}
            <code className="text-ink">readdit_sentiment</code>, and{" "}
            <code className="text-ink">readdit_ask</code>.
          </p>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="mb-2 text-lg font-semibold text-ink">From the playground</h2>
          <p className="mb-5 max-w-2xl text-sm text-muted">
            Ask in plain English. The public demo is a pre-generated example — no login and no
            live API calls required to see what a report looks like. Live research requires a
            free account so we can keep it fast and abuse-free for everyone.
          </p>
          <Link href="/demo" className="text-sm font-medium text-accent hover:underline">
            View the example: &quot;What does Reddit think about Cursor?&quot; →
          </Link>
        </section>

        <footer className="border-t border-border py-10 text-xs text-muted">
          Readdit. It reads Reddit. Reddit users are not a statistically representative sample
          of the entire market — treat findings as directional, not definitive.
        </footer>
      </main>
    </>
  );
}
