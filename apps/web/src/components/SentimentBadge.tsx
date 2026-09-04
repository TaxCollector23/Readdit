import type { Sentiment } from "@readdit/core";

const LABEL_STYLES: Record<string, string> = {
  very_positive: "text-positive border-positive/40 bg-positive/10",
  positive: "text-positive border-positive/40 bg-positive/10",
  mixed: "text-neutral border-neutral/40 bg-neutral/10",
  negative: "text-negative border-negative/40 bg-negative/10",
  very_negative: "text-negative border-negative/40 bg-negative/10",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const style = LABEL_STYLES[sentiment.label] ?? LABEL_STYLES.mixed;
  return (
    <div className={`inline-flex items-baseline gap-2 rounded-md border px-3 py-1.5 font-mono ${style}`}>
      <span className="text-xl font-bold">{Math.round(sentiment.score)}</span>
      <span className="text-xs opacity-70">/100</span>
      <span className="ml-1 text-xs font-semibold uppercase tracking-wide">
        {sentiment.label.replace("_", " ")}
      </span>
    </div>
  );
}
