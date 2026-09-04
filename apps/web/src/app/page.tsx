import Link from "next/link";
import { Header } from "@/components/Header";
import { TypingPhrase } from "@/components/TypingPhrase";
import { HeroButton } from "@/components/HeroButton";

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
              <span className="text-ink">Your </span>
              <TypingPhrase />
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted">
              Readdit searches Reddit, finds the real discussions, and turns them into a clear,
              cited report — in seconds.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <HeroButton />
              <Link
                href="/demo"
                className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
              >
                See an example
              </Link>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">How it works</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Type a product or brand",
                body: "Just type what you want to know about — Cursor, Notion, your competitor, anything. Readdit plans the right searches automatically.",
              },
              {
                step: "02",
                title: "It reads Reddit for you",
                body: "Readdit finds the real discussions across subreddits, reads every thread, and pulls out what people actually said — praise, complaints, and comparisons.",
              },
              {
                step: "03",
                title: "Get a cited report",
                body: "Every claim links back to a real Reddit thread. No made-up sources, no hallucinations — just what people said, and where they said it.",
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

        {/* ── Footer ── */}
        <footer className="border-t border-border px-4 py-8 text-xs text-muted sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <span>
              Readdit reads Reddit. Reddit users are not a statistically representative sample.
            </span>
            <div className="flex gap-5">
              <Link href="/about" className="hover:text-ink">About</Link>
              <Link href="/demo" className="hover:text-ink">Demo</Link>
              <Link href="/cli" className="hover:text-ink">CLI</Link>
              <Link href="/mcp" className="hover:text-ink">MCP</Link>
              <a href="https://github.com/TaxCollector23/Readdit" target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
