import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight, Search, ServerCog, Terminal } from "lucide-react";
import { Header } from "@/components/Header";
import { TypingPhrase } from "@/components/TypingPhrase";

const CLI_COMMANDS = `$ readdit search "your product"
$ readdit ask "what do developers dislike about your product?"
$ readdit compare "your product" "the alternative" --json`;

const MCP_CONFIG = `{
  "mcpServers": {
    "readdit": {
      "command": "node",
      "args": ["/path/to/Readdit/packages/mcp/dist/server.js"],
      "env": { "GEMINI_API_KEY": "..." }
    }
  }
}`;

function Surface({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="border border-border bg-surface p-5">
      <div className="mb-4 flex h-9 w-9 items-center justify-center border border-border bg-canvas">
        <Icon className="h-4 w-4 text-accent" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </article>
  );
}

function CodePanel({ label, code }: { label: string; code: string }) {
  return (
    <div className="border border-border bg-[#111110] text-[#f3f3ee]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-white/60">{label}</span>
        <span className="h-2 w-2 bg-accent" />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-white/85">
        {code}
      </pre>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <section className="shell-grid border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase text-accent">Reddit + read it</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-6xl">
                See what people are saying about <TypingPhrase />
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
                Readdit searches Reddit discussions, ranks the useful threads, and turns the
                evidence into a report you can inspect from the web, CLI, or MCP.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/playground"
                  className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-accent"
                >
                  Open playground
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
                >
                  Read the story
                </Link>
              </div>
            </div>

            <div className="border border-border bg-surface p-3">
              <div className="border border-border bg-canvas p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase text-muted">source mode</p>
                    <p className="mt-1 text-sm font-semibold text-ink">Works without an AI key</p>
                  </div>
                  <Search className="h-4 w-4 text-accent" aria-hidden="true" />
                </div>
                <div className="space-y-3">
                  {[
                    "Plan Reddit-focused queries",
                    "Search Reddit + DuckDuckGo",
                    "Rank and dedupe source links",
                    "Open the evidence yourself",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 border-t border-border pt-3 text-sm">
                      <span className="h-1.5 w-1.5 bg-accent" />
                      <span className="text-ink">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Surface icon={Search} title="Web playground">
              Search sources without a key, then run full AI analysis once Gemini is configured
              and you are signed in.
            </Surface>
            <Surface icon={Terminal} title="CLI">
              Use `readdit search` for retrieval-only work or ask for a cited report from your
              terminal.
            </Surface>
            <Surface icon={ServerCog} title="MCP">
              Give another agent Reddit research tools with structured outputs and real source
              URLs.
            </Surface>
          </div>
        </section>

        <section className="border-y border-border bg-subtle">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <CodePanel label="CLI" code={CLI_COMMANDS} />
            <CodePanel label="MCP config" code={MCP_CONFIG} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase text-accent">No fake certainty</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Reports stay tied to sources.</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Readdit treats Reddit as directional community signal, not a market survey. Search
              results are links to real discussions; AI-generated reports cite the retrieved
              sources and include limitations when the evidence is thin.
            </p>
            <Link
              href="/demo"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              View the example report
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-border px-4 py-8 text-xs text-muted sm:px-6">
          <div className="mx-auto max-w-6xl">
            Readdit reads Reddit. Reddit users are not a statistically representative sample of
            the whole market.
          </div>
        </footer>
      </main>
    </>
  );
}
