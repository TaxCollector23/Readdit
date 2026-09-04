import type {
  CompareReport,
  ConfidenceInfo,
  Evidence,
  EvidenceSource,
  NormalizedDiscussion,
  ReadditIntent,
  RedditReport,
  Sentiment,
  SubredditBreakdown,
} from "../types.js";
import { OpenRouterClient } from "../analysis/openrouterClient.js";
import {
  chunkAnalysisSystemPrompt,
  chunkAnalysisUserPrompt,
  comparePrompt,
  synthesisSystemPrompt,
  synthesisUserPrompt,
} from "../analysis/prompts.js";
import {
  ChunkAnalysisSchema,
  CompareSynthesisSchema,
  SynthesisSchema,
  type CompareSynthesisOutput,
  type Observation,
  type SynthesisOutput,
} from "../analysis/schema.js";
import { AnalysisProviderError } from "../types.js";
import { logger } from "../logger.js";

const CHUNK_SIZE = 15;

export interface IndexedDiscussion {
  index: number;
  discussion: NormalizedDiscussion;
}

export function indexDiscussions(discussions: NormalizedDiscussion[]): IndexedDiscussion[] {
  return discussions.map((discussion, i) => ({ index: i + 1, discussion }));
}

export function chunkIndexed(
  indexed: IndexedDiscussion[],
  chunkSize = CHUNK_SIZE
): IndexedDiscussion[][] {
  const chunks: IndexedDiscussion[][] = [];
  for (let i = 0; i < indexed.length; i += chunkSize) {
    chunks.push(indexed.slice(i, i + chunkSize));
  }
  return chunks;
}

interface MergedObservation extends Observation {
  frequency: number;
}

/**
 * Runs chunk-level extraction across a batch of indexed discussions in
 * parallel, validates each response, and discards anything that cites a
 * source index outside the batch (a cheap but effective hallucination
 * guard: the model literally cannot reference a source that doesn't exist).
 */
export async function analyzeChunks(
  client: OpenRouterClient,
  model: string,
  topic: string,
  intent: ReadditIntent,
  chunks: IndexedDiscussion[][],
  requestId?: string
): Promise<{ observations: Observation[]; sentimentLeans: string[] }> {
  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const validIndices = new Set(chunk.map((c) => c.index));
      const raw = await client.callForJson({
        model,
        system: chunkAnalysisSystemPrompt(),
        user: chunkAnalysisUserPrompt(topic, intent, chunk),
        requestId,
        temperature: 0.15,
        maxTokens: 1800,
      });
      const parsed = ChunkAnalysisSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn("chunk_analysis_schema_invalid", {
          requestId,
          issues: parsed.error.issues.slice(0, 3).map((i) => i.message),
        });
        return { observations: [] as Observation[], sentimentLean: "mixed" };
      }
      const filtered = parsed.data.observations
        .map((o) => ({
          ...o,
          sourceIndices: o.sourceIndices.filter((i) => validIndices.has(i)),
        }))
        .filter((o) => o.sourceIndices.length > 0);
      return { observations: filtered, sentimentLean: parsed.data.sentimentLean };
    })
  );

  const observations: Observation[] = [];
  const sentimentLeans: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      observations.push(...r.value.observations);
      sentimentLeans.push(r.value.sentimentLean);
    } else {
      logger.warn("chunk_analysis_failed", {
        requestId,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }
  return { observations, sentimentLeans };
}

function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Merges near-duplicate observations of the same type (e.g. two chunks both flagging "pricing"). */
export function mergeObservations(observations: Observation[]): MergedObservation[] {
  const merged: MergedObservation[] = [];

  for (const obs of observations) {
    const obsTokens = tokenSet(obs.text);
    const match = merged.find(
      (m) => m.type === obs.type && jaccard(tokenSet(m.text), obsTokens) > 0.45
    );
    if (match) {
      match.frequency++;
      match.sourceIndices = Array.from(new Set([...match.sourceIndices, ...obs.sourceIndices]));
    } else {
      merged.push({ ...obs, frequency: 1 });
    }
  }

  return merged.sort((a, b) => b.frequency - a.frequency || b.sourceIndices.length - a.sourceIndices.length);
}

export function summarizeObservationsForPrompt(merged: MergedObservation[]): string {
  const byType = new Map<string, MergedObservation[]>();
  for (const m of merged) {
    if (!byType.has(m.type)) byType.set(m.type, []);
    byType.get(m.type)!.push(m);
  }

  const lines: string[] = [];
  for (const [type, items] of byType) {
    lines.push(`${type.toUpperCase()}:`);
    for (const item of items.slice(0, 20)) {
      lines.push(
        `  - ${item.text} [sources: ${item.sourceIndices.join(",")}]${
          item.product ? ` (re: ${item.product})` : ""
        } (seen ${item.frequency}x)`
      );
    }
  }
  return lines.join("\n");
}

async function callSynthesisWithRetry(
  client: OpenRouterClient,
  model: string,
  system: string,
  user: string,
  requestId?: string
): Promise<SynthesisOutput> {
  let lastIssue = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await client.callForJson({
      model,
      system,
      user,
      requestId,
      temperature: 0.25,
      maxTokens: 2200,
    });
    const parsed = SynthesisSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    lastIssue = parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ");
    logger.warn("synthesis_schema_invalid_retrying", { requestId, attempt, issues: lastIssue });
  }
  throw new AnalysisProviderError(
    `Model output did not match the expected report schema: ${lastIssue}`
  );
}

function sourcesFor(
  indices: number[],
  discussionByIndex: Map<number, NormalizedDiscussion>
): EvidenceSource[] {
  const seen = new Set<string>();
  const sources: EvidenceSource[] = [];
  for (const idx of indices) {
    const d = discussionByIndex.get(idx);
    if (!d || seen.has(d.id)) continue;
    seen.add(d.id);
    sources.push({
      title: d.title,
      url: d.url,
      subreddit: d.subreddit,
      author: d.author,
      timestamp: d.timestamp,
      score: d.score,
    });
  }
  return sources;
}

function buildEvidence(
  claims: SynthesisOutput["evidenceClaims"],
  discussionByIndex: Map<number, NormalizedDiscussion>
): Evidence[] {
  const evidence: Evidence[] = [];
  for (const claim of claims) {
    const validIndices = claim.sourceIndices.filter((i) => discussionByIndex.has(i));
    if (validIndices.length === 0) continue; // no-evidence-means-no-claim
    evidence.push({ claim: claim.claim, sources: sourcesFor(validIndices, discussionByIndex) });
  }
  return evidence;
}

function subredditBreakdown(discussions: NormalizedDiscussion[]): SubredditBreakdown[] {
  const counts = new Map<string, number>();
  for (const d of discussions) {
    const key = d.subreddit ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function computeConfidence(
  sourceCount: number,
  subredditCount: number,
  sentimentLeans: string[],
  citationCoverage: number
): ConfidenceInfo {
  const leanVariety = new Set(sentimentLeans).size;
  const consistency = sentimentLeans.length <= 1 ? 1 : 1 - (leanVariety - 1) / 4;

  let points = 0;
  if (sourceCount >= 30) points += 2;
  else if (sourceCount >= 12) points += 1;
  if (subredditCount >= 5) points += 2;
  else if (subredditCount >= 2) points += 1;
  if (consistency > 0.6) points += 1;
  if (citationCoverage > 0.7) points += 1;

  const level: ConfidenceInfo["level"] = points >= 5 ? "high" : points >= 3 ? "medium" : "low";

  const reasoning = `Based on ${sourceCount} discussions across ${subredditCount} subreddit${
    subredditCount === 1 ? "" : "s"
  }, ${
    consistency > 0.6 ? "with broadly consistent sentiment" : "with notably mixed/inconsistent sentiment"
  } across sources, and ${Math.round(citationCoverage * 100)}% of report claims backed by cited evidence.`;

  return { level, sourceCount, subredditCount, reasoning };
}

export interface SynthesizeArgs {
  client: OpenRouterClient;
  model: string;
  topic: string;
  intent: ReadditIntent;
  discussions: NormalizedDiscussion[];
  requestId?: string;
  onProgress?: import("../types.js").ProgressCallback;
}

export async function synthesizeReport(args: SynthesizeArgs): Promise<RedditReport> {
  const { client, model, topic, intent, discussions, requestId, onProgress } = args;
  const indexed = indexDiscussions(discussions);
  const discussionByIndex = new Map(indexed.map((i) => [i.index, i.discussion]));
  const chunks = chunkIndexed(indexed);

  const { observations, sentimentLeans } = await analyzeChunks(
    client,
    model,
    topic,
    intent,
    chunks,
    requestId
  );
  const merged = mergeObservations(observations);
  const summaryBlock = summarizeObservationsForPrompt(merged);

  const subreddits = subredditBreakdown(discussions);

  onProgress?.("synthesizing", "Synthesizing the final report");
  const synthesis = await callSynthesisWithRetry(
    client,
    model,
    synthesisSystemPrompt(),
    synthesisUserPrompt(topic, intent, summaryBlock || "(no strong observations extracted)", {
      sourceCount: discussions.length,
      subredditCount: subreddits.length,
      subredditList: subreddits.map((s) => s.name),
    }),
    requestId
  );

  const evidence = buildEvidence(synthesis.evidenceClaims, discussionByIndex);
  const citationCoverage =
    synthesis.evidenceClaims.length === 0 ? 0 : evidence.length / synthesis.evidenceClaims.length;

  const confidence = computeConfidence(
    discussions.length,
    subreddits.length,
    sentimentLeans,
    citationCoverage
  );
  const sentiment: Sentiment = {
    score: synthesis.sentimentScore,
    label: synthesis.sentimentLabel,
    confidence: confidence.level === "high" ? 0.85 : confidence.level === "medium" ? 0.6 : 0.35,
  };

  const limitations = [...synthesis.limitations];
  if (!limitations.some((l) => /representative/i.test(l))) {
    limitations.push(
      "Reddit users are not a statistically representative sample of the entire market — this reflects what Reddit discussions show, not overall customer sentiment."
    );
  }

  return {
    query: topic,
    intent,
    summary: synthesis.summary,
    keyTakeaways: synthesis.keyTakeaways,
    sentiment,
    praise: synthesis.praise,
    complaints: synthesis.complaints,
    featureRequests: synthesis.featureRequests,
    themes: synthesis.themes.sort((a, b) => b.frequency - a.frequency),
    comparisons: synthesis.comparisons,
    switchingReasons: synthesis.switchingReasons,
    evidence,
    sourceCount: discussions.length,
    subreddits,
    confidence,
    limitations,
    generatedAt: new Date().toISOString(),
    model,
    cached: false,
  };
}

async function callCompareSynthesisWithRetry(
  client: OpenRouterClient,
  model: string,
  system: string,
  user: string,
  requestId?: string
): Promise<CompareSynthesisOutput> {
  let lastIssue = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await client.callForJson({
      model,
      system,
      user,
      requestId,
      temperature: 0.25,
      maxTokens: 2400,
    });
    const parsed = CompareSynthesisSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    lastIssue = parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ");
    logger.warn("compare_synthesis_schema_invalid_retrying", { requestId, attempt, issues: lastIssue });
  }
  throw new AnalysisProviderError(
    `Model output did not match the expected comparison schema: ${lastIssue}`
  );
}

export interface SynthesizeCompareArgs {
  client: OpenRouterClient;
  model: string;
  topicA: string;
  topicB: string;
  discussionsA: NormalizedDiscussion[];
  discussionsB: NormalizedDiscussion[];
  requestId?: string;
  onProgress?: import("../types.js").ProgressCallback;
}

/**
 * Researches both products independently (separate discussion sets, kept in
 * separate index ranges) and only combines them at the final synthesis step
 * — this is what keeps a comparison report from just being "ask the model
 * to write A vs B" out of general knowledge.
 */
export async function synthesizeCompareReport(args: SynthesizeCompareArgs): Promise<CompareReport> {
  const { client, model, topicA, topicB, discussionsA, discussionsB, requestId, onProgress } = args;

  const indexedA = indexDiscussions(discussionsA);
  const offset = indexedA.length;
  const indexedB = discussionsB.map((discussion, i) => ({ index: offset + i + 1, discussion }));
  const discussionByIndex = new Map(
    [...indexedA, ...indexedB].map((i) => [i.index, i.discussion])
  );

  const [resA, resB] = await Promise.all([
    analyzeChunks(client, model, topicA, "compare", chunkIndexed(indexedA), requestId),
    analyzeChunks(client, model, topicB, "compare", chunkIndexed(indexedB), requestId),
  ]);

  const mergedA = mergeObservations(resA.observations);
  const mergedB = mergeObservations(resB.observations);

  const { system, user } = comparePrompt(
    topicA,
    topicB,
    summarizeObservationsForPrompt(mergedA) || "(no strong observations extracted)",
    summarizeObservationsForPrompt(mergedB) || "(no strong observations extracted)",
    { sourceCountA: discussionsA.length, sourceCountB: discussionsB.length }
  );

  onProgress?.("synthesizing", "Synthesizing the comparison");
  const synthesis = await callCompareSynthesisWithRetry(client, model, system, user, requestId);

  const evidence = buildEvidence(synthesis.evidenceClaims, discussionByIndex);
  const allDiscussions = [...discussionsA, ...discussionsB];
  const subreddits = subredditBreakdown(allDiscussions);

  const confidenceA = computeConfidence(
    discussionsA.length,
    subredditBreakdown(discussionsA).length,
    resA.sentimentLeans,
    1
  );
  const confidenceB = computeConfidence(
    discussionsB.length,
    subredditBreakdown(discussionsB).length,
    resB.sentimentLeans,
    1
  );

  const limitations = [...synthesis.limitations];
  if (!limitations.some((l) => /representative/i.test(l))) {
    limitations.push(
      "Reddit users are not a statistically representative sample of the entire market — this reflects what Reddit discussions show for each product, not overall customer sentiment."
    );
  }
  if (discussionsA.length < 8 || discussionsB.length < 8) {
    limitations.push(
      `Evidence volume is uneven or thin (${discussionsA.length} sources for ${topicA}, ${discussionsB.length} for ${topicB}) — treat the comparison as directional, not definitive.`
    );
  }

  return {
    query: `${topicA} vs ${topicB}`,
    productA: topicA,
    productB: topicB,
    summary: synthesis.summary,
    overallSentiment: {
      a: {
        score: synthesis.sentimentA.score,
        label: synthesis.sentimentA.label,
        confidence: confidenceA.level === "high" ? 0.85 : confidenceA.level === "medium" ? 0.6 : 0.35,
      },
      b: {
        score: synthesis.sentimentB.score,
        label: synthesis.sentimentB.label,
        confidence: confidenceB.level === "high" ? 0.85 : confidenceB.level === "medium" ? 0.6 : 0.35,
      },
    },
    strengthsA: synthesis.strengthsA,
    strengthsB: synthesis.strengthsB,
    complaintsA: synthesis.complaintsA,
    complaintsB: synthesis.complaintsB,
    commonThemes: synthesis.commonThemes.sort((a, b) => b.frequency - a.frequency),
    switching: synthesis.switching,
    evidence,
    sourceCount: allDiscussions.length,
    subreddits,
    limitations,
    generatedAt: new Date().toISOString(),
    model,
    cached: false,
  };
}
