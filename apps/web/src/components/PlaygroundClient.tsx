"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CompareReport, RedditReport } from "@readdit/core";
import { ReportView, CompareReportView } from "./ReportView";

const EXAMPLES = [
  "What does Reddit think about Cursor?",
  "Why are people leaving Vercel?",
  "What do developers like about Claude Code?",
  "OpenWebUI complaints",
];

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning research...",
  searching: "Searching Reddit...",
  ranking: "Ranking relevant discussions...",
  extracting_evidence: "Extracting evidence...",
  synthesizing: "Synthesizing Reddit's opinions...",
};

type Mode = "ask" | "compare";

interface StreamEvent {
  type: "progress" | "result" | "error";
  stage?: string;
  detail?: string;
  report?: RedditReport | CompareReport;
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
}

async function* readNdjson(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // Flush any pending multi-byte sequence and process a final line that
      // might not end in a newline (defensive — today's server always
      // terminates every event with \n, but don't rely on that here).
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) {
        try {
          yield JSON.parse(line) as StreamEvent;
        } catch {
          // ignore malformed line
        }
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer) as StreamEvent;
    } catch {
      // ignore malformed trailing line
    }
  }
}

export function PlaygroundClient({ isAuthed }: { isAuthed: boolean }) {
  const searchParams = useSearchParams();
  // If the URL carries a `b` param, this is a return-from-login redirect for
  // a Compare submission (see loginHref below) — restore Compare mode too,
  // not just the query text, or the auto-submit would silently re-run it as
  // an Ask against the wrong endpoint.
  const [mode, setMode] = useState<Mode>(searchParams.get("b") ? "compare" : "ask");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [topicB, setTopicB] = useState(searchParams.get("b") ?? "");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [report, setReport] = useState<RedditReport | null>(null);
  const [compareReport, setCompareReport] = useState<CompareReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const autoSubmitted = useRef(false);
  const run = useCallback(
    async (q: string, b?: string) => {
      if (!q.trim()) return;
      setLoading(true);
      setError(null);
      setNeedsAuth(false);
      setReport(null);
      setCompareReport(null);
      setStage("planning");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const endpoint = mode === "compare" ? "/api/compare" : "/api/analyze";
        const payload =
          mode === "compare"
            ? { topicA: q, topicB: b, limit: 50 }
            : { query: q, intent: "ask", limit: 50 };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (res.status === 401) {
          setNeedsAuth(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Something went wrong.");
          setLoading(false);
          return;
        }

        for await (const evt of readNdjson(res)) {
          if (evt.type === "progress" && evt.stage) {
            setStage(evt.stage);
          } else if (evt.type === "result" && evt.report) {
            if (mode === "compare") setCompareReport(evt.report as CompareReport);
            else setReport(evt.report as RedditReport);
          } else if (evt.type === "error") {
            setError(evt.error ?? "Something went wrong.");
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Connection lost while researching. Try again.");
        }
      } finally {
        setLoading(false);
        setStage(null);
      }
    },
    [mode]
  );

  useEffect(() => {
    if (autoSubmitted.current) return;
    const q = searchParams.get("q");
    const auto = searchParams.get("auto");
    if (q && auto === "1" && isAuthed) {
      autoSubmitted.current = true;
      run(q, searchParams.get("b") ?? undefined);
    }
  }, [searchParams, isAuthed, run]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(query, topicB);
  }

  const loginHref = `/login?callbackUrl=${encodeURIComponent(
    `/playground?auto=1&q=${encodeURIComponent(query)}${mode === "compare" ? `&b=${encodeURIComponent(topicB)}` : ""}`
  )}`;

  return (
    <div>
      <div className="mb-4 flex gap-2 text-xs">
        <button
          onClick={() => setMode("ask")}
          className={`rounded-md border px-3 py-1.5 ${
            mode === "ask" ? "border-accent text-accent" : "border-border text-muted"
          }`}
        >
          Ask
        </button>
        <button
          onClick={() => setMode("compare")}
          className={`rounded-md border px-3 py-1.5 ${
            mode === "compare" ? "border-accent text-accent" : "border-border text-muted"
          }`}
        >
          Compare
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "compare" ? "First product, e.g. Cursor" : "What does Reddit think about Cursor?"
          }
          rows={mode === "compare" ? 1 : 2}
          className="w-full resize-none rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        {mode === "compare" && (
          <input
            value={topicB}
            onChange={(e) => setTopicB(e.target.value)}
            placeholder="Second product, e.g. Claude Code"
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />
        )}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {mode === "ask" &&
              EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  {ex}
                </button>
              ))}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim() || (mode === "compare" && !topicB.trim())}
            className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Researching..." : "Analyze"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-6 flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
          <span className="status-dot h-2 w-2 rounded-full bg-accent" />
          {stage ? STAGE_LABEL[stage] ?? stage : "Starting..."}
        </div>
      )}

      {needsAuth && (
        <div className="mt-6 rounded-md border border-accent/40 bg-accent/10 px-4 py-4 text-sm">
          <p className="mb-2 text-ink">Sign in to run live Reddit research.</p>
          <p className="mb-3 text-xs text-muted">
            Your query is saved — you&apos;ll come right back to it after signing in.
          </p>
          <Link
            href={loginHref}
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Sign in to continue
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-md border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      {report && (
        <div className="mt-8 rounded-lg border border-border bg-canvas p-6">
          <ReportView report={report} />
        </div>
      )}
      {compareReport && (
        <div className="mt-8 rounded-lg border border-border bg-canvas p-6">
          <CompareReportView report={compareReport} />
        </div>
      )}
    </div>
  );
}
