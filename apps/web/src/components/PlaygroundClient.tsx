"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, X } from "lucide-react";
import type { CompareReport, RedditReport } from "@readdit/core";
import { CompareReportView, ReportView } from "./ReportView";
import { useAuth } from "./AuthProvider";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const EXAMPLES = ["Cursor", "Vercel", "Linear", "Notion", "Claude Code", "Raycast"];

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning research…",
  searching: "Searching Reddit…",
  ranking: "Ranking discussions…",
  extracting_evidence: "Reading threads…",
  synthesizing: "Writing report…",
};

interface StreamEvent {
  type: "progress" | "result" | "error";
  stage?: string;
  report?: RedditReport | CompareReport;
  error?: string;
  code?: string;
}

async function* readNdjson(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) { buffer += decoder.decode(); break; }
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) {
        try { yield JSON.parse(line) as StreamEvent; } catch { /* ignore */ }
      }
    }
  }
  if (buffer.trim()) {
    try { yield JSON.parse(buffer) as StreamEvent; } catch { /* ignore */ }
  }
}

export function PlaygroundClient({ aiConfigured }: { aiConfigured: boolean }) {
  const { user, loading: authLoading, idToken } = useAuth();
  const isAuthed = Boolean(user);
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [report, setReport] = useState<RedditReport | null>(null);
  const [compareReport, setCompareReport] = useState<CompareReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoSubmitted = useRef(false);

  const run = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed || !isAuthed) return;

      setLoading(true);
      setError(null);
      setNeedsAuth(false);
      setReport(null);
      setCompareReport(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setStage("planning");
        const token = await idToken();
        if (!token) { setNeedsAuth(true); return; }

        const res = await fetch(`${BASE}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: trimmed, intent: "ask", limit: 25 }),
          signal: controller.signal,
        });

        if (res.status === 401) { setNeedsAuth(true); return; }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Something went wrong.");
          return;
        }

        for await (const evt of readNdjson(res)) {
          if (evt.type === "progress" && evt.stage) setStage(evt.stage);
          else if (evt.type === "result" && evt.report) setReport(evt.report as RedditReport);
          else if (evt.type === "error") setError(evt.error ?? "Something went wrong.");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Connection lost. Try again.");
      } finally {
        setLoading(false);
        setStage(null);
        abortRef.current = null;
      }
    },
    [aiConfigured, idToken, isAuthed]
  );

  useEffect(() => {
    if (autoSubmitted.current) return;
    const q = searchParams.get("q");
    const auto = searchParams.get("auto");
    if (q && auto === "1") {
      autoSubmitted.current = true;
      run(q);
    }
  }, [searchParams, run]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(query);
  }

  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/playground?q=${encodeURIComponent(query)}&auto=1`)}`;
  const hasOutput = Boolean(report || compareReport);

  // Show loading spinner while Firebase resolves auth state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  // Full sign-in wall — nothing is visible or interactive until logged in
  if (!isAuthed) {
    return (
      <div className="border border-dashed border-border bg-surface px-5 py-14 text-center">
        <p className="text-base font-semibold text-ink">Sign in to use the playground</p>
        <p className="mt-2 text-sm text-muted">
          Create a free account to search Reddit and get cited AI reports.
        </p>
        <Link
          href={loginHref}
          className="mt-6 inline-flex items-center gap-2 bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-ink"
        >
          Sign in with Google
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cursor, Vercel, your competitor…"
            className="h-12 flex-1 border border-border bg-canvas px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
            autoFocus
          />
          {loading ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="inline-flex h-12 w-12 items-center justify-center border border-border text-muted hover:border-negative hover:text-negative"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!query.trim()}
              className="inline-flex h-12 items-center gap-2 bg-ink px-5 text-sm font-semibold text-canvas hover:bg-accent disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" />
              Research it
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setQuery(ex); run(ex); }}
              className="border border-border bg-canvas px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <div className="mt-6 flex items-center gap-3 border border-border bg-surface px-4 py-3 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>{stage ? STAGE_LABEL[stage] ?? stage : "Starting…"}</span>
        </div>
      )}

      {!loading && !hasOutput && !error && query.length === 0 && (
        <div className="mt-8 border border-dashed border-border bg-surface px-5 py-10 text-center">
          <p className="text-sm font-medium text-ink">Type a product or brand above.</p>
          <p className="mt-2 text-sm text-muted">
            Readdit will search Reddit and generate a cited AI report.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      {report && (
        <div className="mt-8 border border-border bg-surface p-4 sm:p-6">
          <ReportView report={report} />
        </div>
      )}
      {compareReport && (
        <div className="mt-8 border border-border bg-surface p-4 sm:p-6">
          <CompareReportView report={compareReport} />
        </div>
      )}
    </div>
  );
}
