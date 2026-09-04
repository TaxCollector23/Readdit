export interface SourceSearchResult {
  title: string;
  url: string;
  subreddit?: string;
  author?: string;
  timestamp?: string;
  score?: number;
  numComments?: number;
  sourceType?: string;
  source?: string;
  excerpt?: string;
  relevance?: number;
}

export interface SourceSearchResponse {
  query: string;
  queriesUsed: string[];
  resultCount: number;
  subredditCount: number;
  results: SourceSearchResult[];
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Meta({ result }: { result: SourceSearchResult }) {
  const parts = [
    result.subreddit ? `r/${result.subreddit}` : undefined,
    result.author ? `u/${result.author}` : undefined,
    typeof result.score === "number" ? `${result.score} points` : undefined,
    typeof result.numComments === "number" ? `${result.numComments} comments` : undefined,
    formatDate(result.timestamp),
    result.source,
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return <p className="mt-1 text-xs text-muted">{parts.join(" / ")}</p>;
}

export function SearchResultsView({ data }: { data: SourceSearchResponse }) {
  return (
    <section className="mt-8 border border-border bg-canvas p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Sources for {data.query}</h2>
          <p className="mt-1 text-sm text-muted">
            {data.resultCount} result{data.resultCount === 1 ? "" : "s"} from{" "}
            {data.subredditCount} subreddit{data.subredditCount === 1 ? "" : "s"}
          </p>
        </div>
        {data.queriesUsed.length > 0 && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer hover:text-ink">Queries used</summary>
            <div className="mt-2 max-w-xl space-y-1 font-mono">
              {data.queriesUsed.map((query) => (
                <div key={query}>{query}</div>
              ))}
            </div>
          </details>
        )}
      </div>

      {data.results.length === 0 ? (
        <div className="py-10 text-sm text-muted">
          No Reddit sources came back for this query. Try a broader product name or a related
          category.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.results.map((result) => (
            <article key={result.url} className="py-4">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm font-medium text-ink hover:text-accent"
              >
                {result.title}
              </a>
              <Meta result={result} />
              {result.excerpt && (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                  {result.excerpt}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
