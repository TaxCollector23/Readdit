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
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-semibold text-ink">What should Readdit research?</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Type any product, brand, or tool. Readdit finds real Reddit discussions and turns them into a cited report.
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
