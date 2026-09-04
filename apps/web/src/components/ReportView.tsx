import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import type { CompareReport, RedditReport } from "@readdit/core";
import { SentimentBadge } from "./SentimentBadge";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{title}</h3>
      {children}
    </section>
  );
}

function labelize(s: string): string {
  const text = s.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{empty ?? "No distinct items found in the evidence."}</p>;
  }
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-ink">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 bg-muted" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SourceLinks({
  evidence,
}: {
  evidence: Array<{ claim: string; sources: Array<{ url: string; title: string; subreddit?: string }> }>;
}) {
  if (evidence.length === 0) {
    return <p className="text-sm text-muted">No cited evidence claims were returned.</p>;
  }

  return (
    <div className="space-y-3">
      {evidence.map((item, i) => (
        <article key={`${item.claim}-${i}`} className="border border-border bg-canvas p-3">
          <p className="text-sm font-medium leading-6 text-ink">{item.claim}</p>
          <div className="mt-2 space-y-1.5">
            {item.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-start gap-2 text-xs leading-5 text-muted hover:text-accent"
              >
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  {source.subreddit ? `r/${source.subreddit} - ` : ""}
                  {source.title}
                </span>
              </a>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function CorpusMeta({
  sourceCount,
  subredditCount,
  model,
  cached,
}: {
  sourceCount: number;
  subredditCount: number;
  model?: string;
  cached?: boolean;
}) {
  return (
    <p className="text-xs text-muted">
      {sourceCount} discussion{sourceCount === 1 ? "" : "s"} / {subredditCount} subreddit
      {subredditCount === 1 ? "" : "s"}
      {model ? ` / model: ${model}` : ""}
      {cached ? " / served from cache" : ""}
    </p>
  );
}

export function ReportView({ report }: { report: RedditReport }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Readdit report</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">{report.query}</h2>
          <CorpusMeta
            sourceCount={report.sourceCount}
            subredditCount={report.subreddits.length}
            model={report.model}
            cached={report.cached}
          />
        </div>
        <div className="space-y-2">
          <SentimentBadge sentiment={report.sentiment} />
          <p className="text-xs text-muted">Confidence: {labelize(report.confidence.level)}</p>
        </div>
      </div>

      <Section title="Summary">
        <p className="text-sm leading-7 text-ink">{report.summary}</p>
      </Section>

      <Section title="Key Takeaways">
        <BulletList items={report.keyTakeaways} />
      </Section>

      <div className="grid gap-6 border-t border-border py-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase text-positive">People like</h3>
          <BulletList items={report.praise} />
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase text-negative">People dislike</h3>
          <BulletList items={report.complaints} />
        </div>
      </div>

      <Section title="Feature Requests">
        <BulletList items={report.featureRequests} empty="No feature requests stood out." />
      </Section>

      <Section title="Top Themes">
        {report.themes.length === 0 ? (
          <p className="text-sm text-muted">No recurring themes were extracted.</p>
        ) : (
          <ol className="space-y-3 text-sm text-ink">
            {report.themes.slice(0, 6).map((theme, i) => (
              <li key={theme.name} className="grid grid-cols-[2rem_1fr] gap-2">
                <span className="font-mono text-muted">{i + 1}.</span>
                <span>
                  <span className="font-medium">{theme.name}</span>{" "}
                  <span className="text-muted">- {theme.description}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {report.comparisons.length > 0 && (
        <Section title="Comparisons">
          <BulletList items={report.comparisons.map((item) => `${item.product} - ${item.context}`)} />
        </Section>
      )}

      {report.switchingReasons.length > 0 && (
        <Section title="Switching">
          <ul className="space-y-2 text-sm text-ink">
            {report.switchingReasons.map((item, i) => (
              <li key={i}>
                <span className={item.direction === "to" ? "text-positive" : "text-negative"}>
                  {item.direction === "to" ? "To" : "From"} {item.product}
                </span>
                : {item.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Subreddits">
        {report.subreddits.length === 0 ? (
          <p className="text-sm text-muted">No subreddit breakdown was returned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {report.subreddits.slice(0, 12).map((subreddit) => (
              <span
                key={subreddit.name}
                className="border border-border bg-canvas px-2 py-1 font-mono text-xs text-muted"
              >
                r/{subreddit.name} <span className="text-ink">{subreddit.count}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Evidence">
        <SourceLinks evidence={report.evidence} />
      </Section>

      <Section title="Limitations">
        <BulletList items={report.limitations} empty="No limitations were returned." />
      </Section>
    </div>
  );
}

export function CompareReportView({ report }: { report: CompareReport }) {
  return (
    <div>
      <div className="pb-6">
        <p className="text-xs font-semibold uppercase text-muted">Readdit comparison</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">
          {report.productA} <span className="text-muted">vs</span> {report.productB}
        </h2>
        <CorpusMeta sourceCount={report.sourceCount} subredditCount={report.subreddits.length} />
        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <p className="mb-1 text-xs text-muted">{report.productA}</p>
            <SentimentBadge sentiment={report.overallSentiment.a} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">{report.productB}</p>
            <SentimentBadge sentiment={report.overallSentiment.b} />
          </div>
        </div>
      </div>

      <Section title="Summary">
        <p className="text-sm leading-7 text-ink">{report.summary}</p>
      </Section>

      <div className="grid gap-6 border-t border-border py-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase text-ink">
            Why choose {report.productA}
          </h3>
          <BulletList items={report.strengthsA} />
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase text-ink">
            Why choose {report.productB}
          </h3>
          <BulletList items={report.strengthsB} />
        </div>
      </div>

      <div className="grid gap-6 border-t border-border py-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase text-negative">
            {report.productA} complaints
          </h3>
          <BulletList items={report.complaintsA} />
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase text-negative">
            {report.productB} complaints
          </h3>
          <BulletList items={report.complaintsB} />
        </div>
      </div>

      {report.commonThemes.length > 0 && (
        <Section title="Common Themes">
          <BulletList
            items={report.commonThemes.map((theme) => `${theme.name} - ${theme.description}`)}
          />
        </Section>
      )}

      {report.switching.length > 0 && (
        <Section title="Switching">
          <ul className="space-y-2 text-sm text-ink">
            {report.switching.map((item, i) => (
              <li key={i}>
                <span className={item.direction === "to" ? "text-positive" : "text-negative"}>
                  {item.direction === "to" ? "To" : "From"} {item.product}
                </span>
                : {item.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Evidence">
        <SourceLinks evidence={report.evidence} />
      </Section>

      <Section title="Limitations">
        <BulletList items={report.limitations} empty="No limitations were returned." />
      </Section>
    </div>
  );
}
