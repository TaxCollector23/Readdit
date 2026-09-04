import { z } from "zod";

export const ObservationSchema = z.object({
  type: z.enum([
    "praise",
    "complaint",
    "feature_request",
    "theme",
    "comparison",
    "switching_to",
    "switching_from",
    "disagreement",
  ]),
  text: z.string().min(3).max(400),
  sourceIndices: z.array(z.number().int().positive()).min(1).max(10),
  product: z.string().max(120).optional(),
});

export const ChunkAnalysisSchema = z.object({
  observations: z.array(ObservationSchema).max(40),
  sentimentLean: z.enum([
    "very_negative",
    "negative",
    "mixed",
    "positive",
    "very_positive",
  ]),
});

export type ChunkAnalysis = z.infer<typeof ChunkAnalysisSchema>;
export type Observation = z.infer<typeof ObservationSchema>;

export const EvidenceClaimSchema = z.object({
  claim: z.string().min(3).max(300),
  sourceIndices: z.array(z.number().int().positive()).min(1).max(8),
});

export const SynthesisSchema = z.object({
  summary: z.string().min(10).max(1200),
  keyTakeaways: z.array(z.string().max(200)).max(7),
  sentimentScore: z.number().min(0).max(100),
  sentimentLabel: z.enum([
    "very_negative",
    "negative",
    "mixed",
    "positive",
    "very_positive",
  ]),
  sentimentReasoning: z.string().max(400),
  praise: z.array(z.string().max(200)).max(10),
  complaints: z.array(z.string().max(200)).max(10),
  featureRequests: z.array(z.string().max(200)).max(10),
  themes: z
    .array(
      z.object({
        name: z.string().max(80),
        description: z.string().max(300),
        frequency: z.number().int().min(1).max(1000),
      })
    )
    .max(8),
  comparisons: z
    .array(z.object({ product: z.string().max(100), context: z.string().max(300) }))
    .max(8),
  switchingReasons: z
    .array(
      z.object({
        direction: z.enum(["to", "from"]),
        product: z.string().max(100),
        reasons: z.array(z.string().max(200)).max(5),
      })
    )
    .max(8),
  evidenceClaims: z.array(EvidenceClaimSchema).max(20),
  limitations: z.array(z.string().max(300)).max(6),
});

export type SynthesisOutput = z.infer<typeof SynthesisSchema>;

export const CompareSynthesisSchema = z.object({
  summary: z.string().min(10).max(1200),
  sentimentA: z.object({
    score: z.number().min(0).max(100),
    label: z.enum(["very_negative", "negative", "mixed", "positive", "very_positive"]),
    reasoning: z.string().max(300),
  }),
  sentimentB: z.object({
    score: z.number().min(0).max(100),
    label: z.enum(["very_negative", "negative", "mixed", "positive", "very_positive"]),
    reasoning: z.string().max(300),
  }),
  strengthsA: z.array(z.string().max(200)).max(8),
  strengthsB: z.array(z.string().max(200)).max(8),
  complaintsA: z.array(z.string().max(200)).max(8),
  complaintsB: z.array(z.string().max(200)).max(8),
  commonThemes: z
    .array(
      z.object({
        name: z.string().max(80),
        description: z.string().max(300),
        frequency: z.number().int().min(1).max(1000),
      })
    )
    .max(8),
  switching: z
    .array(
      z.object({
        direction: z.enum(["to", "from"]),
        product: z.string().max(100),
        reasons: z.array(z.string().max(200)).max(5),
      })
    )
    .max(8),
  evidenceClaims: z.array(EvidenceClaimSchema).max(20),
  limitations: z.array(z.string().max(300)).max(6),
});

export type CompareSynthesisOutput = z.infer<typeof CompareSynthesisSchema>;

/** Extracts the first top-level JSON object/array from a possibly noisy LLM response. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to slicing between the first { and last }.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Could not parse JSON from model response");
  }
}
