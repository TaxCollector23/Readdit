import { Suspense } from "react";
import { checkConfig } from "@readdit/core";
import { Header } from "@/components/Header";
import { PlaygroundClient } from "@/components/PlaygroundClient";

export const metadata = { title: "Demo - Readdit" };

export default function DemoPage() {
  const aiConfigured = checkConfig({ requireAi: true }).ok;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Live demo</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Try it yourself — search anything
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Results come straight from Reddit. Sign in to get the full AI synthesis.
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
