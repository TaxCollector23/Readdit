import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { Header } from "@/components/Header";
import { TypingPhrase } from "@/components/TypingPhrase";

const CLI_COMMANDS = `$ readdit analyze "your product"
$ readdit compare "Cursor" "Claude Code"
$ readdit complaints "Vercel" --json`;

const MCP_CONFIG = `{
  "mcpServers": {
    "readdit": {
      "command": "node",
      "args": [".../packages/mcp/dist/server.js"],
      "env": { "GEMINI_API_KEY": "..." }
    }
  }
}`;

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        {/* ── Hero ── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-32">
            <p className="font-mono text-xs uppercase tracking-widest text-accent">
              Reddit + read it
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.08] text-ink sm:text-7xl">
              See what people are saying about{" "}
              <TypingPhrase />
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted">
              Readdit searches Reddit discussions, ranks the useful threads, and turns the
              evidence into a cited report — from the web, CLI, or MCP.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/playground"
                className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-canvas hover:bg-accent"
              >
                Open playground
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/demo"
                className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
              >
                View an example report
              </Link>
            </div>
          </div>
        </section>

        {/* ── What it does ── */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">How it works</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Search",
                body: "Plans a batch of Reddit-focused queries, searches across subreddits and DuckDuckGo, then deduplicates and ranks results by relevance.",
              },
              {
                step: "02",
                title: "Extract",
                body: "Every discussion is chunked and read for evidence — praise, complaints, feature requests, comparisons, and switching behavior.",
              },
              {
                step: "03",
                title: "Cite",
                body: "Claims are tied back to real Reddit URLs. No fabricated sources. Limitations are flagged when evidence is thin.",
              },
            ].map(({ step, title, body }) => (
              <div key={step}>
                <p className="font-mono text-xs text-muted">{step}</p>
                <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Source mode callout ── */}
        <section className="border-y border-border bg-subtle">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
            <p className="text-sm font-semibold text-ink">
              Source search runs without an AI key.
            </p>
            <p className="mt-2 max-w-lg text-sm leading-7 text-muted">
              Plan queries, search Reddit, and open the evidence yourself — no Gemini key
              required. Sign in and add one to unlock full AI synthesis.
            </p>
            <Link
              href="/playground"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              Try it now <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* ── CLI + MCP ── */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-accent" aria-hidden="true" />
            <p className="font-mono text-xs uppercase tracking-widest text-accent">
              Three interfaces
            </p>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-muted">CLI</p>
              <div className="bg-[#111110] text-[#f3f3ee]">
                <pre className="overflow-x-auto p-5 font-mono text-xs leading-6">{CLI_COMMANDS}</pre>
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-muted">MCP config</p>
              <div className="bg-[#111110] text-[#f3f3ee]">
                <pre className="overflow-x-auto p-5 font-mono text-xs leading-6">{MCP_CONFIG}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-border px-4 py-8 text-xs text-muted sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <span>
              Readdit reads Reddit. Reddit users are not a statistically representative sample.
            </span>
            <div className="flex gap-5">
              <Link href="/about" className="hover:text-ink">About</Link>
              <Link href="/demo" className="hover:text-ink">Demo</Link>
              <a href="https://github.com/TaxCollector23/Readdit" target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
