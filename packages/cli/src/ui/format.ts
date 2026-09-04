import type { CompareReport, RedditReport } from "@readdit/core";
import { RULE, sentimentColor, theme } from "./theme.js";

function bullet(items: string[]): string {
  if (items.length === 0) return theme.dim("  (none found in the retrieved evidence)");
  return items.map((i) => `  • ${i}`).join("\n");
}

export function formatReport(report: RedditReport): string {
  const lines: string[] = [];

  lines.push(theme.brand("Readdit"));
  lines.push(RULE);
  lines.push("");
  lines.push(theme.bold(report.query));
  lines.push("");

  const scoreText = `${Math.round(report.sentiment.score)}/100`;
  const labelText = report.sentiment.label.replace("_", " ").toUpperCase();
  lines.push(
    `${sentimentColor(report.sentiment.label, `${scoreText}  ${labelText}`)}   ${theme.dim(
      `Confidence: ${report.confidence.level}`
    )}`
  );
  lines.push(
    theme.dim(`${report.sourceCount} discussions · ${report.subreddits.length} subreddits`)
  );
  if (report.cached) lines.push(theme.dim("(from cache — use --fresh to re-research)"));
  lines.push("");

  lines.push(theme.bold("SUMMARY"));
  lines.push(report.summary);
  lines.push("");

  if (report.keyTakeaways.length > 0) {
    lines.push(theme.bold("KEY TAKEAWAYS"));
    lines.push(bullet(report.keyTakeaways));
    lines.push("");
  }

  lines.push(theme.bold("PEOPLE LIKE"));
  lines.push(bullet(report.praise));
  lines.push("");

  lines.push(theme.bold("COMMON COMPLAINTS"));
  lines.push(bullet(report.complaints));
  lines.push("");

  if (report.featureRequests.length > 0) {
    lines.push(theme.bold("FEATURE REQUESTS"));
    lines.push(bullet(report.featureRequests));
    lines.push("");
  }

  if (report.themes.length > 0) {
    lines.push(theme.bold("TOP THEMES"));
    lines.push(
      report.themes
        .slice(0, 6)
        .map((t, i) => `  ${i + 1}. ${t.name} ${theme.dim(`— ${t.description}`)}`)
        .join("\n")
    );
    lines.push("");
  }

  if (report.comparisons.length > 0) {
    lines.push(theme.bold("COMPARISONS"));
    lines.push(bullet(report.comparisons.map((c) => `${c.product} — ${c.context}`)));
    lines.push("");
  }

  if (report.switchingReasons.length > 0) {
    lines.push(theme.bold("SWITCHING"));
    for (const s of report.switchingReasons) {
      const arrow = s.direction === "to" ? "→ To" : "← From";
      lines.push(`  ${arrow} ${s.product}: ${s.reasons.join("; ")}`);
    }
    lines.push("");
  }

  if (report.subreddits.length > 0) {
    lines.push(theme.bold("SUBREDDIT BREAKDOWN"));
    lines.push(
      report.subreddits
        .slice(0, 10)
        .map((s) => `  r/${s.name} ${theme.dim(`(${s.count})`)}`)
        .join("\n")
    );
    lines.push("");
  }

  if (report.evidence.length > 0) {
    lines.push(theme.bold("EVIDENCE"));
    for (const e of report.evidence.slice(0, 8)) {
      lines.push(`  ${theme.cyan(e.claim)}`);
      for (const src of e.sources.slice(0, 3)) {
        const sub = src.subreddit ? `r/${src.subreddit} — ` : "";
        lines.push(theme.dim(`    ${sub}${src.title}`));
        lines.push(theme.dim(`    ${src.url}`));
      }
    }
    lines.push("");
  }

  if (report.limitations.length > 0) {
    lines.push(theme.bold("LIMITATIONS"));
    lines.push(bullet(report.limitations));
    lines.push("");
  }

  lines.push(RULE);
  lines.push(
    theme.dim(`${report.sourceCount} discussions analyzed · model: ${report.model}`)
  );
  lines.push(theme.dim("Readdit. It reads Reddit."));

  return lines.join("\n");
}

export function formatCompareReport(report: CompareReport): string {
  const lines: string[] = [];

  lines.push(theme.brand("Readdit"));
  lines.push(RULE);
  lines.push("");
  lines.push(theme.bold(`${report.productA}  vs  ${report.productB}`));
  lines.push("");

  const a = report.overallSentiment.a;
  const b = report.overallSentiment.b;
  lines.push(
    `${theme.bold(report.productA)}: ${sentimentColor(a.label, `${Math.round(a.score)}/100 ${a.label.replace("_", " ")}`)}`
  );
  lines.push(
    `${theme.bold(report.productB)}: ${sentimentColor(b.label, `${Math.round(b.score)}/100 ${b.label.replace("_", " ")}`)}`
  );
  lines.push(theme.dim(`${report.sourceCount} discussions · ${report.subreddits.length} subreddits`));
  if (report.cached) lines.push(theme.dim("(from cache — use --fresh to re-research)"));
  lines.push("");

  lines.push(theme.bold("SUMMARY"));
  lines.push(report.summary);
  lines.push("");

  lines.push(theme.bold(`WHY CHOOSE ${report.productA.toUpperCase()}`));
  lines.push(bullet(report.strengthsA));
  lines.push("");

  lines.push(theme.bold(`WHY CHOOSE ${report.productB.toUpperCase()}`));
  lines.push(bullet(report.strengthsB));
  lines.push("");

  lines.push(theme.bold(`${report.productA.toUpperCase()} COMPLAINTS`));
  lines.push(bullet(report.complaintsA));
  lines.push("");

  lines.push(theme.bold(`${report.productB.toUpperCase()} COMPLAINTS`));
  lines.push(bullet(report.complaintsB));
  lines.push("");

  if (report.switching.length > 0) {
    lines.push(theme.bold("SWITCHING"));
    for (const s of report.switching) {
      const arrow = s.direction === "to" ? "→ To" : "← From";
      lines.push(`  ${arrow} ${s.product}: ${s.reasons.join("; ")}`);
    }
    lines.push("");
  }

  if (report.commonThemes.length > 0) {
    lines.push(theme.bold("COMMON THEMES"));
    lines.push(
      report.commonThemes.map((t, i) => `  ${i + 1}. ${t.name} ${theme.dim(`— ${t.description}`)}`).join("\n")
    );
    lines.push("");
  }

  if (report.evidence.length > 0) {
    lines.push(theme.bold("EVIDENCE"));
    for (const e of report.evidence.slice(0, 8)) {
      lines.push(`  ${theme.cyan(e.claim)}`);
      for (const src of e.sources.slice(0, 3)) {
        const sub = src.subreddit ? `r/${src.subreddit} — ` : "";
        lines.push(theme.dim(`    ${sub}${src.title}`));
        lines.push(theme.dim(`    ${src.url}`));
      }
    }
    lines.push("");
  }

  if (report.limitations.length > 0) {
    lines.push(theme.bold("LIMITATIONS"));
    lines.push(bullet(report.limitations));
    lines.push("");
  }

  lines.push(RULE);
  lines.push(theme.dim(`${report.sourceCount} discussions analyzed · model: ${report.model}`));
  lines.push(theme.dim("Readdit. It reads Reddit."));

  return lines.join("\n");
}
