import { Suspense } from "react";
import { checkConfig } from "@readdit/core";
import { Header } from "@/components/Header";
import { PlaygroundClient } from "@/components/PlaygroundClient";

export const metadata = { title: "Playground - Readdit" };

export default function PlaygroundPage() {
  const aiConfigured = checkConfig({ requireAi: true }).ok;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="font-mono text-xs uppercase text-accent">Playground</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">What should Readdit read?</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Source search is public. Sign in to unlock live AI analysis and comparisons.
        </p>

        <div className="mt-8">
          <Suspense>
            <PlaygroundClient aiConfigured={aiConfigured} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
