import Link from "next/link";
import { Header } from "@/components/Header";
import { ReportView } from "@/components/ReportView";
import demoReport from "@/data/demo-cursor.json";
import type { RedditReport } from "@readdit/core";

export const metadata = {
  title: "Example report — Readdit",
};

export default function DemoPage() {
  const report = demoReport as unknown as RedditReport;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">
              Example report
            </p>
            <h1 className="mt-1 text-xl font-semibold text-ink">
              What does Reddit think about Cursor?
            </h1>
          </div>
          <Link
            href="/playground"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Run your own →
          </Link>
        </div>
        <p className="mb-8 rounded-md border border-border bg-surface px-4 py-3 text-xs text-muted">
          This is a static, pre-generated example — it doesn&apos;t call any live search or AI
          APIs, so anyone can view it without an account. Real queries in the playground run the
          full research pipeline live.
        </p>

        <div className="rounded-lg border border-border bg-canvas p-6">
          <ReportView report={report} />
        </div>
      </main>
    </>
  );
}
