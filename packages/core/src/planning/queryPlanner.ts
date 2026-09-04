import type { ReadditIntent, ResearchPlan } from "../types.js";

const DEPTH_QUERY_CAP: Record<"quick" | "standard" | "deep", number> = {
  quick: 4,
  standard: 8,
  deep: 12,
};

/**
 * Generates a fan-out of Reddit-focused research queries for a topic,
 * tailored to what the user is trying to learn. This is what keeps Readdit
 * from being "search once, summarize" — each intent biases the query mix
 * toward the kind of evidence that actually answers the question.
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
        `${t} review`,
        `${t} problems`,
        `${other} review`,
        `${other} problems`,
        `${t} vs ${other}`,
        `${other} vs ${t}`,
        `switched from ${t} to ${other}`,
        `switched from ${other} to ${t}`,
        `${t} alternatives`,
        `${other} alternatives`,
      ];
      reasoning = `Comparing two products: researching each independently plus direct head-to-head and switching-direction threads.`;
      break;
    }
    case "complaints": {
      queries = [
        `${t} complaints`,
        `${t} problems`,
        `${t} issues`,
        `${t} disappointed`,
        `${t} broken`,
        `${t} bugs`,
        `${t} worst`,
        `${t} regret`,
        `${t} switched away from`,
        `${t} not worth it`,
      ];
      reasoning = `Complaints intent: prioritizing queries that surface negative firsthand experiences.`;
      break;
    }
    case "features": {
      queries = [
        `${t} feature request`,
        `${t} missing feature`,
        `${t} wish it had`,
        `${t} would be nice if`,
        `${t} roadmap`,
        `${t} needs`,
        `${t} lacking`,
        `${t} feedback`,
      ];
      reasoning = `Feature-request intent: prioritizing queries that surface desired/missing functionality.`;
      break;
    }
    case "sentiment": {
      queries = [
        `${t} review`,
        `${t} opinions`,
        `${t} thoughts`,
        `${t} experience`,
        `${t} worth it`,
        `${t} good or bad`,
        `${t} reddit`,
      ];
      reasoning = `Sentiment intent: gathering a diverse spread of general opinion threads to avoid over-indexing on one discussion.`;
      break;
    }
    case "search":
    case "analyze":
    case "ask":
    default: {
      queries = [
        `${t} review`,
        `${t} problems`,
        `${t} complaints`,
        `${t} alternatives`,
        `${t} vs`,
        `${t} pricing`,
        `${t} worth it`,
        `${t} experience`,
        `${t} reddit`,
        `${t} feature request`,
      ];
      reasoning = `General analysis: broad mix of praise, complaint, comparison, and pricing queries for balanced coverage.`;
      break;
    }
  }

  const capped = queries.slice(0, cap);
  return {
    intent,
    primaryTopic: t,
    secondaryTopic: options.secondaryTopic,
    queries: capped,
    reasoning,
  };
}

/**
 * Given a batch of already-retrieved discussions, decide whether a second
 * round of targeted queries would meaningfully improve coverage (adaptive
 * research loop). Looks for signals like: too few distinct subreddits, too
 * few results overall, or an intent that specifically benefits from
 * follow-up (e.g. complaints found but no context on why).
 */
export function planFollowUpQueries(
  intent: ReadditIntent,
  topic: string,
  firstRoundSubredditCount: number,
  firstRoundResultCount: number
): string[] {
  const followUps: string[] = [];

  if (firstRoundResultCount < 8) {
    followUps.push(`${topic}`, `${topic} discussion`);
  }
  if (firstRoundSubredditCount < 3) {
    followUps.push(`${topic} community`, `${topic} users`);
  }
  if (intent === "ask") {
    followUps.push(`${topic} explained`, `${topic} why`);
  }

  return Array.from(new Set(followUps)).slice(0, 4);
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
