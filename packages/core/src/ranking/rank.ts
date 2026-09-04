import { createHash } from "node:crypto";
import type { NormalizedDiscussion, SearchResult } from "../types.js";

function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let path = u.pathname.replace(/\/$/, "");
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function idFor(url: string): string {
  return createHash("sha1").update(canonicalizeUrl(url)).digest("hex").slice(0, 16);
}

function isRedditUrl(url: string): boolean {
  return /(^|\.)reddit\.com/i.test(url) || url.includes("redd.it");
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function relevanceScore(topic: string, r: SearchResult): number {
  const topicTokens = tokenize(topic);
  if (topicTokens.size === 0) return 0.3;

  const haystack = tokenize(`${r.title} ${r.snippet ?? ""} ${r.text ?? ""}`);
  let overlap = 0;
  for (const tok of topicTokens) {
    if (haystack.has(tok)) overlap++;
  }
  const titleTokens = tokenize(r.title);
  let titleOverlap = 0;
  for (const tok of topicTokens) {
    if (titleTokens.has(tok)) titleOverlap++;
  }

  const overlapRatio = overlap / topicTokens.size;
  const titleRatio = titleOverlap / topicTokens.size;

  return Math.min(1, overlapRatio * 0.6 + titleRatio * 0.4);
}

function qualityScore(r: SearchResult): number {
  const score = r.score ?? 0;
  const comments = r.numComments ?? 0;
  const textLen = (r.text ?? r.snippet ?? "").length;

  const scoreComponent = Math.min(1, Math.log10(Math.max(score, 0) + 1) / 3);
  const commentsComponent = Math.min(1, Math.log10(Math.max(comments, 0) + 1) / 2.5);
  const textComponent = Math.min(1, textLen / 500);
  const redditBonus = isRedditUrl(r.url) ? 0.15 : 0;

  return Math.min(
    1,
    scoreComponent * 0.35 + commentsComponent * 0.25 + textComponent * 0.25 + redditBonus
  );
}

function ageInDays(timestamp?: string): number | undefined {
  if (!timestamp) return undefined;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return undefined;
  return (Date.now() - t) / 86400000;
}

/**
 * Normalizes raw search results, deduplicates near-identical entries (same
 * URL, or same subreddit+title), and computes relevance/quality scores.
 * Does NOT sort or apply diversity balancing — call rankAndDiversify() next.
 */
export function normalizeAndDedupe(
  topic: string,
  raw: SearchResult[]
): NormalizedDiscussion[] {
  const byId = new Map<string, NormalizedDiscussion>();
  const seenTitleSub = new Set<string>();

  for (const r of raw) {
    if (!r.url || !r.title) continue;
    const id = idFor(r.url);
    const titleSubKey = `${(r.subreddit ?? "").toLowerCase()}::${r.title
      .toLowerCase()
      .trim()
      .slice(0, 80)}`;

    if (byId.has(id)) {
      // Merge: prefer the entry with more metadata / longer text.
      const existing = byId.get(id)!;
      if ((r.text?.length ?? 0) > (existing.text?.length ?? 0)) {
        byId.set(id, { ...existing, ...r, id, isReddit: existing.isReddit });
      }
      continue;
    }
    if (seenTitleSub.has(titleSubKey) && titleSubKey !== "::") continue;
    seenTitleSub.add(titleSubKey);

    const discussion: NormalizedDiscussion = {
      ...r,
      id,
      isReddit: isRedditUrl(r.url),
      relevanceScore: relevanceScore(topic, r),
      qualityScore: qualityScore(r),
      ageInDays: ageInDays(r.timestamp),
    };
    byId.set(id, discussion);
  }

  return Array.from(byId.values());
}

/**
 * Ranks discussions by a blended relevance/quality/recency score, then
 * re-orders the top of the list to prevent one subreddit or a handful of
 * threads from dominating (source diversity balancing) — a report should
 * reflect more than one loud thread.
 */
export function rankAndDiversify(
  discussions: NormalizedDiscussion[],
  limit: number
): NormalizedDiscussion[] {
  // Reddit-domain discussions are the actual evidence Readdit promises;
  // non-Reddit sources (e.g. articles found via DuckDuckGo) are supplementary.
  const scored = discussions
    .filter((d) => d.relevanceScore > 0.05)
    .map((d) => {
      const recencyBoost =
        d.ageInDays !== undefined ? Math.max(0, 1 - d.ageInDays / 365) * 0.1 : 0;
      const combined =
        d.relevanceScore * 0.45 +
        d.qualityScore * 0.35 +
        recencyBoost +
        (d.isReddit ? 0.1 : 0);
      return { d, combined };
    })
    .sort((a, b) => b.combined - a.combined);

  // Greedy round-robin by subreddit so the top results aren't monopolized.
  const bySubreddit = new Map<string, typeof scored>();
  for (const item of scored) {
    const key = item.d.subreddit ?? "unknown";
    if (!bySubreddit.has(key)) bySubreddit.set(key, []);
    bySubreddit.get(key)!.push(item);
  }

  const subredditOrder = Array.from(bySubreddit.keys()).sort((a, b) => {
    const aTop = bySubreddit.get(a)![0].combined;
    const bTop = bySubreddit.get(b)![0].combined;
    return bTop - aTop;
  });

  const diversified: NormalizedDiscussion[] = [];
  let cursor = 0;
  const maxPerSubreddit = Math.max(3, Math.ceil(limit / Math.max(subredditOrder.length, 1)) + 2);

  while (diversified.length < limit) {
    let addedThisPass = false;
    for (const sub of subredditOrder) {
      if (diversified.length >= limit) break;
      const bucket = bySubreddit.get(sub)!;
      const takenFromSub = diversified.filter((d) => (d.subreddit ?? "unknown") === sub).length;
      if (takenFromSub >= maxPerSubreddit) continue;
      const next = bucket.shift();
      if (next) {
        diversified.push(next.d);
        addedThisPass = true;
      }
    }
    if (!addedThisPass) break;
    cursor++;
    if (cursor > limit * 2) break;
  }

  return diversified;
}
