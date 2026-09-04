import type { CompareReport, RedditReport } from "@readdit/core";
import { SentimentBadge } from "./SentimentBadge";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Nothing distinct found in the retrieved evidence.</p>;
  }
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-ink">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReportView({ report }: { report: RedditReport }) {
  return (
    <div className="prose-report">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Readdit report</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">{report.query}</h2>
        </div>
        <div className="flex items-center gap-3">
          <SentimentBadge sentiment={report.sentiment} />
          <div className="text-xs text-muted">
            <div>Confidence: {report.confidence.level}</div>
            <div>
              {report.sourceCount} discussions · {report.subreddits.length} subreddits
            </div>
          </div>
        </div>
      </div>

      <Section title="Summary">
        <p className="text-sm leading-relaxed text-ink">{report.summary}</p>
      </Section>

      {report.keyTakeaways.length > 0 && (
        <Section title="Key takeaways">
          <BulletList items={report.keyTakeaways} />
        </Section>
      )}

      <div className="grid gap-6 border-t border-border py-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-positive">
            People like
          </h3>
          <BulletList items={report.praise} />
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-negative">
            People dislike
          </h3>
          <BulletList items={report.complaints} />
        </div>
      </div>

      {report.featureRequests.length > 0 && (
        <Section title="Feature requests">
          <BulletList items={report.featureRequests} />
        </Section>
      )}

      {report.themes.length > 0 && (
        <Section title="Top themes">
          <ol className="space-y-2 text-sm text-ink">
            {report.themes.slice(0, 6).map((t, i) => (
              <li key={t.name} className="flex gap-3">
                <span className="font-mono text-muted">{i + 1}.</span>
                <span>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-muted">— {t.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {report.comparisons.length > 0 && (
        <Section title="Comparisons & alternatives">
          <BulletList items={report.comparisons.map((c) => `${c.product} — ${c.context}`)} />
        </Section>
      )}

      {report.switchingReasons.length > 0 && (
        <Section title="Switching behavior">
          <ul className="space-y-2 text-sm text-ink">
            {report.switchingReasons.map((s, i) => (
              <li key={i}>
                <span className={s.direction === "to" ? "text-positive" : "text-negative"}>
                  {s.direction === "to" ? "→ To" : "← From"} {s.product}
                </span>
                : {s.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.subreddits.length > 0 && (
        <Section title="Subreddit breakdown">
          <div className="flex flex-wrap gap-2">
            {report.subreddits.slice(0, 12).map((s) => (
              <span
                key={s.name}
                className="rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-muted"
              >
                r/{s.name} <span className="text-ink">{s.count}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {report.evidence.length > 0 && (
        <Section title="Evidence">
          <div className="space-y-4">
            {report.evidence.map((e, i) => (
              <div key={i} className="rounded-md border border-border bg-surface p-3">
                <p className="mb-2 text-sm font-medium text-ink">{e.claim}</p>
                <div className="space-y-1.5">
                  {e.sources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block text-xs text-muted hover:text-accent"
                    >
                      {s.subreddit ? `r/${s.subreddit} — ` : ""}
                      {s.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.limitations.length > 0 && (
        <Section title="Limitations">
          <BulletList items={report.limitations} />
        </Section>
      )}

      <div className="mt-6 border-t border-border pt-4 text-xs text-muted">
        {report.sourceCount} discussions analyzed · model: {report.model}
        {report.cached && " · served from cache"}
      </div>
    </div>
  );
}

export function CompareReportView({ report }: { report: CompareReport }) {
  return (
    <div className="prose-report">
      <div className="pb-6">
        <p className="text-xs uppercase tracking-widest text-muted">Readdit comparison</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">
          {report.productA} <span className="text-muted">vs</span> {report.productB}
        </h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <div className="mb-1 text-xs text-muted">{report.productA}</div>
            <SentimentBadge sentiment={report.overallSentiment.a} />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">{report.productB}</div>
            <SentimentBadge sentiment={report.overallSentiment.b} />
          </div>
        </div>
        <div className="mt-3 text-xs text-muted">
          {report.sourceCount} discussions · {report.subreddits.length} subreddits
        </div>
      </div>

      <Section title="Summary">
        <p className="text-sm leading-relaxed text-ink">{report.summary}</p>
      </Section>

      <div className="grid gap-6 border-t border-border py-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink">
            Why choose {report.productA}
          </h3>
          <BulletList items={report.strengthsA} />
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink">
            Why choose {report.productB}
          </h3>
          <BulletList items={report.strengthsB} />
        </div>
      </div>

      <div className="grid gap-6 border-t border-border py-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-negative">
            {report.productA} complaints
          </h3>
          <BulletList items={report.complaintsA} />
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-negative">
            {report.productB} complaints
          </h3>
          <BulletList items={report.complaintsB} />
        </div>
      </div>

      {report.switching.length > 0 && (
        <Section title="Switching behavior">
          <ul className="space-y-2 text-sm text-ink">
            {report.switching.map((s, i) => (
              <li key={i}>
                <span className={s.direction === "to" ? "text-positive" : "text-negative"}>
                  {s.direction === "to" ? "→ To" : "← From"} {s.product}
                </span>
                : {s.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.evidence.length > 0 && (
        <Section title="Evidence">
          <div className="space-y-4">
            {report.evidence.map((e, i) => (
              <div key={i} className="rounded-md border border-border bg-surface p-3">
                <p className="mb-2 text-sm font-medium text-ink">{e.claim}</p>
                <div className="space-y-1.5">
                  {e.sources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block text-xs text-muted hover:text-accent"
                    >
                      {s.subreddit ? `r/${s.subreddit} — ` : ""}
                      {s.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.limitations.length > 0 && (
        <Section title="Limitations">
          <BulletList items={report.limitations} />
        </Section>
      )}
    </div>
  );
}
