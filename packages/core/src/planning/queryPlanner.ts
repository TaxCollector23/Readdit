import type { ReadditIntent, ResearchPlan } from "../types.js";

const DEPTH_QUERY_CAP: Record<"quick" | "standard" | "deep", number> = {
  quick: 4,
  standard: 8,
  deep: 14,
};

/**
 * Generates a fan-out of research queries for a topic, tailored to what the
 * user is trying to learn. Queries span Reddit-specific phrasing AND open-web
 * phrasing so that providers like HN, Dev.to, StackExchange, and Lemmy also
 * return relevant material for non-Reddit niches.
 */
export function planQueries(
  intent: ReadditIntent,
  topic: string,
  options: { secondaryTopic?: string; depth?: "quick" | "standard" | "deep" } = {}
): ResearchPlan {
  const depth = options.depth ?? "standard";
  const cap = DEPTH_QUERY_CAP[depth];
  const t = topic.trim();

  let queries: string[];
  let reasoning: string;

  switch (intent) {
    case "compare": {
      const other = options.secondaryTopic ?? "";
      queries = [
        `${t} vs ${other}`,
        `${other} vs ${t}`,
        `${t} review`,
        `${other} review`,
        `switched from ${t} to ${other}`,
        `switched from ${other} to ${t}`,
        `${t} vs ${other} reddit`,
        `${t} problems`,
        `${other} problems`,
        `${t} alternatives`,
        `${other} alternatives`,
        `${t} or ${other} which is better`,
        `${t} experience`,
        `${other} experience`,
      ];
      reasoning = `Comparison: independent + head-to-head + switching-direction queries across open web and Reddit.`;
      break;
    }
    case "complaints": {
      queries = [
        `${t} problems`,
        `${t} complaints`,
        `${t} issues`,
        `${t} not worth it`,
        `${t} disappointed`,
        `${t} bugs`,
        `${t} worst`,
        `${t} switched away from`,
        `${t} regret`,
        `${t} bad experience`,
        `${t} broken`,
        `what's wrong with ${t}`,
        `${t} negative review`,
        `hate ${t}`,
      ];
      reasoning = `Complaints intent: negative firsthand experience queries across Reddit and open web.`;
      break;
    }
    case "features": {
      queries = [
        `${t} feature request`,
        `${t} missing feature`,
        `${t} roadmap`,
        `${t} wish it had`,
        `${t} feedback`,
        `${t} needs`,
        `${t} would be nice if`,
        `${t} lacking`,
        `${t} improvement`,
        `${t} suggestion`,
        `${t} feature wishlist`,
      ];
      reasoning = `Feature intent: queries that surface desired and missing functionality.`;
      break;
    }
    case "sentiment": {
      queries = [
        `${t} review`,
        `${t} opinions`,
        `${t} experience`,
        `${t} thoughts`,
        `${t} worth it`,
        `${t} good or bad`,
        `is ${t} good`,
        `${t} honest review`,
        `${t} reddit`,
        `${t} community opinion`,
      ];
      reasoning = `Sentiment: diverse opinion queries to avoid over-indexing on a single discussion.`;
      break;
    }
    case "search":
    case "analyze":
    case "ask":
    default: {
      queries = [
        `${t} review`,
        `${t} experience`,
        `${t} problems`,
        `${t} complaints`,
        `${t} vs`,
        `${t} worth it`,
        `${t} alternatives`,
        `${t} reddit`,
        `${t} pricing`,
        `${t} feature request`,
        `is ${t} good`,
        `${t} honest opinion`,
        `${t} community`,
        `${t} discussion`,
      ];
      reasoning = `General: broad mix of praise, complaint, comparison, and community queries.`;
      break;
    }
  }

  const capped = deduplicateQueries(queries).slice(0, cap);
  return {
    intent,
    primaryTopic: t,
    secondaryTopic: options.secondaryTopic,
    queries: capped,
    reasoning,
  };
}

function deduplicateQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  return queries.filter((q) => {
    const k = q.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Adaptive follow-up queries when first-round coverage is thin.
 * Uses broader phrasing to surface discussions from niche communities
 * that may not use product-specific terminology.
 */
export function planFollowUpQueries(
  intent: ReadditIntent,
  topic: string,
  firstRoundSubredditCount: number,
  firstRoundResultCount: number
): string[] {
  const followUps: string[] = [];

  if (firstRoundResultCount < 10) {
    // Broaden — the topic might be niche, a brand, or an acronym
    followUps.push(topic, `${topic} discussion`, `"${topic}"`);
  }
  if (firstRoundSubredditCount < 3) {
    // Try community-level discovery
    followUps.push(`${topic} community`, `${topic} users`, `r/${topic.replace(/\s+/g, "")}`);
  }
  if (intent === "ask" || intent === "analyze") {
    followUps.push(`${topic} explained`, `${topic} overview`, `${topic} how it works`);
  }
  if (intent === "complaints") {
    followUps.push(`${topic} rant`, `${topic} negative`, `${topic} cancel`);
  }

  return deduplicateQueries(followUps).slice(0, 5);
}

/**
 * Very lightweight heuristic to pull a searchable topic out of a natural
 * language question, used by `ask()` before full query planning. Strips
 * common question scaffolding and keeps the meaningful remainder; quoted
 * phrases are preferred verbatim when present.
 */
export function extractTopicFromQuestion(question: string): string {
  const quoted = question.match(/"([^"]+)"|'([^']+)'/);
  if (quoted) return (quoted[1] ?? quoted[2]).trim();

  let cleaned = question
    .replace(
      /^(why|what|how|who|when|where|is|are|do|does|did|should|can|could|would)\b/i,
      ""
    )
    .replace(/\b(people|users|reddit|redditors|everyone|folks)\b/gi, "")
    .replace(/\b(are|is|do|does|did|leaving|switching from|switching|think about|thinks about|say about|feel about|like|love|hate|dislike)\b/gi, "")
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) cleaned = question.replace(/[?.!]+$/g, "").trim();
  return cleaned;
}

/** Infers the closer-fitting intent from a free-form question's wording. */
export function inferIntentFromQuestion(question: string): ReadditIntent {
  const q = question.toLowerCase();
  if (/(leaving|switch|alternative|instead of|migrat)/.test(q)) return "complaints";
  if (/(complain|problem|issue|hate|worst|annoy|frustrat)/.test(q)) return "complaints";
  if (/(feature|missing|wish|roadmap|request)/.test(q)) return "features";
  if (/(vs\.?|versus|compare|better than)/.test(q)) return "compare";
  if (/(sentiment|feel about|think about|opinion)/.test(q)) return "sentiment";
  return "ask";
}
