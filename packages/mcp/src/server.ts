#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createCoreFromEnv, ReadditError, checkConfig, loadEnvFile } from "@readdit/core";
import type { NormalizedDiscussion } from "@readdit/core";

loadEnvFile();

const REPRESENTATIVENESS_NOTE =
  "Reddit is not a statistically representative sample of the entire market — results reflect what Reddit discussions actually show, with evidence URLs so you can verify claims yourself.";

const server = new McpServer({
  name: "readdit",
  version: "0.1.0",
  description:
    "Readdit reads Reddit so you don't have to: evidence-backed Reddit research tools. " +
    REPRESENTATIVENESS_NOTE,
});

function errorPayload(err: unknown): { code: string; message: string } {
  if (err instanceof ReadditError) {
    return { code: err.code, message: err.message };
  }
  return { code: "unknown_error", message: err instanceof Error ? err.message : String(err) };
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const payload = errorPayload(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function requireConfig() {
  const { ok, missing } = checkConfig();
  if (!ok) {
    throw new ReadditError(
      `Readdit MCP server is not configured. Missing: ${missing.join(", ")}. Set these environment variables where the MCP server process runs.`,
      "configuration_error",
      500
    );
  }
}

function toSearchResult(d: NormalizedDiscussion) {
  return {
    title: d.title,
    url: d.url,
    subreddit: d.subreddit,
    author: d.author,
    timestamp: d.timestamp,
    score: d.score,
    numComments: d.numComments,
    sourceType: d.sourceType,
    excerpt: (d.text || d.snippet || "").slice(0, 500),
    relevance: Number(d.relevanceScore.toFixed(2)),
  };
}

const limitSchema = z
  .number()
  .int()
  .min(5)
  .max(150)
  .optional()
  .describe("Max discussions to retrieve (5-150). Defaults to a sensible value for the depth.");
const freshSchema = z
  .boolean()
  .optional()
  .describe("Bypass the cache and re-research from scratch. Default false (cached results are reused when available).");
const modelSchema = z
  .string()
  .optional()
  .describe("Override the OpenRouter model used for analysis, e.g. 'anthropic/claude-sonnet-4.5'.");
const depthSchema = z
  .enum(["quick", "standard", "deep"])
  .optional()
  .describe("Research budget: quick (fast, fewer queries), standard (default), or deep (more queries/sources, slower).");

server.registerTool(
  "readdit_search",
  {
    title: "Search Reddit discussions",
    description:
      "Retrieve and rank real Reddit discussions about a topic WITHOUT running LLM synthesis — use this " +
      "when you want to inspect the raw evidence yourself (e.g. to quote specific comments, check dates, " +
      "or do your own reasoning over the source material) rather than get a pre-written report. Runs " +
      "several Reddit-focused search queries, deduplicates results, and ranks them by relevance/quality/" +
      "recency with source diversity balancing so one subreddit or thread doesn't dominate. Every result " +
      "includes its real Reddit URL. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      query: z.string().min(1).max(300).describe("Topic or product to search Reddit for."),
      limit: limitSchema,
      fresh: freshSchema,
      depth: depthSchema,
    },
  },
  async ({ query, limit, fresh, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({});
      const { discussions, queriesUsed } = await core.search(query, { limit, fresh, depth });
      return jsonResult({
        query,
        queriesUsed,
        resultCount: discussions.length,
        subredditCount: new Set(discussions.map((d) => d.subreddit ?? "unknown")).size,
        results: discussions.map(toSearchResult),
        note: REPRESENTATIVENESS_NOTE,
      });
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "readdit_analyze",
  {
    title: "Full Reddit intelligence report",
    description:
      "Research Reddit discussions about a topic and produce a complete evidence-grounded report: summary, " +
      "key takeaways, overall sentiment (with confidence), what people praise, common complaints, feature " +
      "requests, recurring themes, comparisons/alternatives mentioned, switching behavior, subreddit " +
      "breakdown, and evidence — every major claim cites the specific Reddit posts/comments that support " +
      "it, with real URLs. Use this when you need a complete, ready-to-use research report rather than raw " +
      "search results. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      query: z.string().min(1).max(300).describe("Topic, product, company, or technology to research."),
      limit: limitSchema,
      fresh: freshSchema,
      model: modelSchema,
      depth: depthSchema,
    },
  },
  async ({ query, limit, fresh, model, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({ model });
      const report = await core.analyze(query, { limit, fresh, model, depth });
      return jsonResult(report);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "readdit_compare",
  {
    title: "Compare two products on Reddit",
    description:
      "Research two products/topics independently on Reddit, then synthesize a comparison: overall " +
      "sentiment for each, why people choose one over the other, complaints about each, common themes, " +
      "and switching behavior (which direction users move and why). Each side is researched separately " +
      "before comparing, so this isn't just the model's general knowledge of 'A vs B' — it's grounded in " +
      "actual retrieved discussions about each product. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      topicA: z.string().min(1).max(300).describe("First product/topic."),
      topicB: z.string().min(1).max(300).describe("Second product/topic."),
      limit: limitSchema,
      fresh: freshSchema,
      model: modelSchema,
      depth: depthSchema,
    },
  },
  async ({ topicA, topicB, limit, fresh, model, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({ model });
      const report = await core.compare(topicA, topicB, { limit, fresh, model, depth });
      return jsonResult(report);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "readdit_complaints",
  {
    title: "Reddit complaints about a topic",
    description:
      "Research Reddit specifically for recurring complaints and negative experiences about a topic, " +
      "prioritizing firsthand accounts over speculation. Returns the strongest, most-repeated complaints " +
      "(each backed by evidence links) rather than one-off gripes. Use this when the user specifically " +
      "wants to know what's wrong with something, not a balanced overview. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      query: z.string().min(1).max(300).describe("Topic/product to find complaints about."),
      limit: limitSchema,
      fresh: freshSchema,
      depth: depthSchema,
    },
  },
  async ({ query, limit, fresh, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({});
      const report = await core.complaints(query, { limit, fresh, depth });
      return jsonResult(report);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "readdit_features",
  {
    title: "Reddit feature requests about a topic",
    description:
      "Research Reddit specifically for recurring feature requests, missing functionality, and things " +
      "users wish a product did. Distinguishes frequently-requested items (multiple independent " +
      "discussions) from one-off suggestions — do not treat a single comment as community consensus. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      query: z.string().min(1).max(300).describe("Topic/product to find feature requests about."),
      limit: limitSchema,
      fresh: freshSchema,
      depth: depthSchema,
    },
  },
  async ({ query, limit, fresh, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({});
      const report = await core.features(query, { limit, fresh, depth });
      return jsonResult(report);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "readdit_sentiment",
  {
    title: "Reddit sentiment toward a topic",
    description:
      "Get a focused sentiment read on how Reddit discusses a topic: a 0-100 score, a label, a confidence " +
      "level (based on source count, subreddit diversity, and consistency across discussions — not a " +
      "statistical survey), plus the positive and negative themes driving that score. Use this when the " +
      "user wants a quick temperature check rather than a full report. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      query: z.string().min(1).max(300).describe("Topic/product to gauge sentiment on."),
      limit: limitSchema,
      fresh: freshSchema,
      depth: depthSchema,
    },
  },
  async ({ query, limit, fresh, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({});
      const report = await core.sentiment(query, { limit, fresh, depth });
      return jsonResult({
        query: report.query,
        sentiment: report.sentiment,
        confidence: report.confidence,
        positiveThemes: report.praise,
        negativeThemes: report.complaints,
        sourceCount: report.sourceCount,
        subreddits: report.subreddits,
        note: REPRESENTATIVENESS_NOTE,
      });
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "readdit_ask",
  {
    title: "Ask a natural-language question about what Reddit thinks",
    description:
      "Ask any natural-language question about Reddit community opinion, e.g. 'Why are people leaving " +
      "Cursor?' or 'What do developers like about Claude Code?'. Readdit infers the right research " +
      "strategy automatically (e.g. a 'why are people leaving X' question researches complaints, " +
      "alternatives, and switching behavior rather than doing one literal search) and returns a full " +
      "evidence-grounded report. Prefer this over readdit_analyze when the input is a question rather " +
      "than a bare topic name. " +
      REPRESENTATIVENESS_NOTE,
    inputSchema: {
      question: z.string().min(1).max(300).describe("A natural-language question about Reddit opinion."),
      limit: limitSchema,
      fresh: freshSchema,
      model: modelSchema,
      depth: depthSchema,
    },
  },
  async ({ question, limit, fresh, model, depth }) => {
    try {
      requireConfig();
      const core = createCoreFromEnv({ model });
      const report = await core.ask(question, { limit, fresh, model, depth });
      return jsonResult(report);
    } catch (err) {
      return errorResult(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Readdit MCP server failed to start:", err);
  process.exit(1);
});
