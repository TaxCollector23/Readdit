import type { HistoryEntry } from "@/lib/db";

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentSearches({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="mt-10 border-t border-border pt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase text-muted">Recent searches</h2>
      <ul className="space-y-1.5">
        {history.map((h) => (
          <li key={h.id} className="flex items-center justify-between text-sm">
            <a
              href={hrefForHistory(h)}
              className="truncate text-ink hover:text-accent"
            >
              {h.query}
            </a>
            <span className="ml-3 shrink-0 text-xs text-muted">
              {h.intent} / {timeAgo(h.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function hrefForHistory(entry: HistoryEntry): string {
  if (entry.intent === "compare" && entry.query.includes(" vs ")) {
    const [topicA, ...rest] = entry.query.split(" vs ");
    const params = new URLSearchParams({
      auto: "1",
      mode: "compare",
      q: topicA,
      b: rest.join(" vs "),
    });
    return `/playground?${params.toString()}`;
  }

  const params = new URLSearchParams({
    auto: "1",
    mode: "analyze",
    q: entry.query,
  });
  return `/playground?${params.toString()}`;
}
