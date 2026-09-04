"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, GitCompare, Loader2, Search, Sparkles, X } from "lucide-react";
import type { CompareReport, RedditReport } from "@readdit/core";
import { CompareReportView, ReportView } from "./ReportView";
import { SearchResultsView, type SourceSearchResponse } from "./SearchResultsView";
import { useAuth } from "./AuthProvider";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const SOURCE_EXAMPLES = ["Cursor", "Vercel pricing", "Linear", "OpenWebUI"];
const ASK_EXAMPLES = [
  "What does Reddit think about Cursor?",
  "Why are people leaving Vercel?",
  "What do developers like about Claude Code?",
];

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning research",
  searching: "Searching Reddit",
  ranking: "Ranking relevant discussions",
  extracting_evidence: "Extracting evidence",
  synthesizing: "Synthesizing findings",
};

type Mode = "sources" | "ask" | "compare";

interface SearchParamReader {
  get(name: string): string | null;
}

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
          // Ignore malformed partial lines; the next valid event will still render.
        }
      }
    }
  }

  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer) as StreamEvent;
    } catch {
      // Ignore malformed trailing line.
    }
  }
}

function initialMode(params: SearchParamReader): Mode {
  if (params.get("b")) return "compare";
  const mode = params.get("mode");
  if (mode === "analyze") return "ask";
  if (mode === "compare") return "compare";
  return "sources";
}

function modeLabel(mode: Mode): string {
  if (mode === "sources") return "Search sources";
  if (mode === "compare") return "Compare";
  return "Analyze";
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 border px-3 text-sm font-medium ${
        active
          ? "border-ink bg-ink text-canvas"
          : "border-border bg-surface text-muted hover:border-ink hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div className="mt-8 border border-dashed border-border bg-surface px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink">
        {mode === "sources"
          ? "Search a topic to see real Reddit source links."
          : mode === "compare"
            ? "Compare two products to generate a cited report."
            : "Ask a question to generate a cited report."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        Source search runs independently. AI reports need a signed-in session and a Gemini API
        key in the local environment.
      </p>
    </div>
  );
}

export function PlaygroundClient({
  aiConfigured,
}: {
  aiConfigured: boolean;
}) {
  const { user, idToken } = useAuth();
  const isAuthed = Boolean(user);
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => initialMode(searchParams));
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [topicB, setTopicB] = useState(searchParams.get("b") ?? "");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [report, setReport] = useState<RedditReport | null>(null);
  const [compareReport, setCompareReport] = useState<CompareReport | null>(null);
  const [sourceResults, setSourceResults] = useState<SourceSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoSubmitted = useRef(false);

  const run = useCallback(
    async (q: string, b?: string) => {
      const trimmed = q.trim();
      const second = b?.trim();
      if (!trimmed || (mode === "compare" && !second)) return;

      if (mode !== "sources" && !aiConfigured) {
        setError("AI analysis needs GEMINI_API_KEY configured. Source search is available now.");
        setNeedsAuth(false);
        return;
      }

      setLoading(true);
      setError(null);
      setNeedsAuth(false);
      setReport(null);
      setCompareReport(null);
      setSourceResults(null);
      setStage(mode === "sources" ? "searching" : "planning");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (mode === "sources") {
          const res = await fetch(`${BASE}/api/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed, limit: 20 }),
            signal: controller.signal,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error ?? "Search failed.");
            return;
          }
          setSourceResults(data as SourceSearchResponse);
          return;
        }

        const token = await idToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }

        const endpoint = mode === "compare" ? `${BASE}/api/compare` : `${BASE}/api/analyze`;
        const payload =
          mode === "compare"
            ? { topicA: trimmed, topicB: second, limit: 50 }
            : { query: trimmed, intent: "ask", limit: 50 };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (res.status === 401) {
          setNeedsAuth(true);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Something went wrong.");
          return;
        }

        for await (const evt of readNdjson(res)) {
          if (evt.type === "progress" && evt.stage) {
            setStage(evt.stage);
          } else if (evt.type === "result" && evt.report) {
            if (mode === "compare") setCompareReport(evt.report as CompareReport);
            else setReport(evt.report as RedditReport);
          } else if (evt.type === "error") {
            const message =
              evt.code === "configuration_error"
                ? `${evt.error ?? "AI analysis is not configured."} Source search still works without a key.`
                : evt.error ?? "Something went wrong.";
            setError(message);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Connection lost while researching. Try again.");
        }
      } finally {
        setLoading(false);
        setStage(null);
        abortRef.current = null;
      }
    },
    [aiConfigured, idToken, mode]
  );

  useEffect(() => {
    if (autoSubmitted.current) return;
    const q = searchParams.get("q");
    const auto = searchParams.get("auto");
    if (q && auto === "1" && (mode === "sources" || isAuthed)) {
      autoSubmitted.current = true;
      run(q, searchParams.get("b") ?? undefined);
    }
  }, [searchParams, isAuthed, mode, run]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(query, topicB);
  }

  const callbackPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("auto", "1");
    params.set("mode", mode === "compare" ? "compare" : "analyze");
    params.set("q", query);
    if (mode === "compare") params.set("b", topicB);
    return `/playground?${params.toString()}`;
  }, [mode, query, topicB]);

  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
  const examples = mode === "sources" ? SOURCE_EXAMPLES : ASK_EXAMPLES;
  const canSubmit =
    !loading && query.trim().length > 0 && (mode !== "compare" || topicB.trim().length > 0);
  const hasOutput = Boolean(report || compareReport || sourceResults);

  return (
    <div>
      <div className="border border-border bg-surface p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap gap-2">
          <TabButton
            active={mode === "sources"}
            icon={Search}
            label="Sources"
            onClick={() => setMode("sources")}
          />
          <TabButton
            active={mode === "ask"}
            icon={Sparkles}
            label="Analyze"
            onClick={() => setMode("ask")}
          />
          <TabButton
            active={mode === "compare"}
            icon={GitCompare}
            label="Compare"
            onClick={() => setMode("compare")}
          />
        </div>

        {!aiConfigured && mode !== "sources" && (
          <div className="mb-4 border border-neutral/40 bg-neutral/10 px-3 py-2 text-sm text-neutral">
            Add `GEMINI_API_KEY` to `.env.local` to run AI analysis. Source search works without it.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className={mode === "compare" ? "grid gap-3 sm:grid-cols-2" : ""}>
            {mode === "ask" ? (
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What does Reddit think about Cursor?"
                rows={3}
                className="min-h-28 w-full resize-y border border-border bg-canvas px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              />
            ) : (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mode === "compare" ? "First product" : "Search a product, site, or brand"}
                className="h-12 w-full border border-border bg-canvas px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              />
            )}
            {mode === "compare" && (
              <input
                value={topicB}
                onChange={(e) => setTopicB(e.target.value)}
                placeholder="Second product"
                className="h-12 w-full border border-border bg-canvas px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              />
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              {mode !== "compare" &&
                examples.map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => setQuery(example)}
                    className="border border-border bg-canvas px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
                  >
                    {example}
                  </button>
                ))}
              {mode === "compare" && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("Cursor");
                    setTopicB("Claude Code");
                  }}
                  className="border border-border bg-canvas px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  Cursor vs Claude Code
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {loading && (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Cancel request"
                  className="inline-flex h-10 w-10 items-center justify-center border border-border text-muted hover:border-negative hover:text-negative"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-10 items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-canvas hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
                {loading ? "Working" : modeLabel(mode)}
              </button>
            </div>
          </div>
        </form>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-3 border border-border bg-surface px-4 py-3 text-sm text-muted">
          <span className="status-dot h-2 w-2 bg-accent" />
          <span>{stage ? STAGE_LABEL[stage] ?? stage : "Starting"}</span>
        </div>
      )}

      {needsAuth && (
        <div className="mt-4 border border-accent/40 bg-accent/10 px-4 py-4 text-sm">
          <p className="font-medium text-ink">Sign in to run live analysis.</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            The query stays in the URL and runs after sign-in.
          </p>
          <Link
            href={loginHref}
            className="mt-3 inline-flex items-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
          >
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-4 border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      {!loading && !hasOutput && !error && !needsAuth && <EmptyState mode={mode} />}

      {sourceResults && <SearchResultsView data={sourceResults} />}
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
