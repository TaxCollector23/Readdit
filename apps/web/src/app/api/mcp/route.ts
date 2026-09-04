/**
 * Remote MCP endpoint — implements MCP Streamable HTTP transport.
 * Users paste this URL into Claude.ai → Integrations → Add custom integration.
 * No local setup, no API keys, no npm install required.
 */

import { createCoreFromEnv, createSearchCoreFromEnv, ReadditError } from "@readdit/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

function ok(id: number | string | null | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function err(id: number | string | null | undefined, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}

const TOOLS = [
  {
    name: "readdit_search",
    description:
      "Search Reddit for real discussions about a product, company, or topic. " +
      "Returns ranked Reddit threads with titles, URLs, subreddits, and excerpts. " +
      "No AI synthesis — raw evidence so you can reason over it yourself.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The product, brand, or topic to search Reddit for.",
        },
        limit: {
          type: "number",
          description: "Max discussions to return (5-50). Default 20.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "readdit_analyze",
    description:
      "Search Reddit and synthesize a cited AI report about a product or topic. " +
      "Returns a structured report with sentiment, key takeaways, praise, complaints, and evidence links. " +
      "Takes 20-40 seconds. Use readdit_search for faster raw results.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The product, brand, or topic to research.",
        },
        intent: {
          type: "string",
          enum: ["analyze", "complaints", "features", "sentiment", "ask"],
          description: "Analysis focus. Default: analyze.",
        },
      },
      required: ["query"],
    },
  },
];

export async function POST(req: Request) {
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return err(null, -32700, "Parse error");
  }

  const { id, method, params } = body;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "readdit", version: "0.1.0" },
    });
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const toolName = params?.name as string | undefined;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    if (toolName === "readdit_search") {
      const query = String(args.query ?? "").trim();
      if (!query) return err(id, -32602, "query is required");
      const limit = Math.min(Math.max(Number(args.limit ?? 20), 5), 50);

      try {
        const core = createSearchCoreFromEnv({ memoryCache: true });
        const { discussions } = await core.search(query, { limit });
        const formatted = discussions.map((d) => ({
          title: d.title,
          url: d.url,
          subreddit: d.subreddit,
          score: d.score,
          numComments: d.numComments,
          excerpt: (d.text || d.snippet || "").slice(0, 500),
          timestamp: d.timestamp,
        }));
        return ok(id, textContent(JSON.stringify({ query, results: formatted }, null, 2)));
      } catch (e) {
        const msg = e instanceof ReadditError ? e.message : "Search failed.";
        return ok(id, { isError: true, ...textContent(msg) });
      }
    }

    if (toolName === "readdit_analyze") {
      const query = String(args.query ?? "").trim();
      if (!query) return err(id, -32602, "query is required");
      const validIntents = ["analyze", "complaints", "features", "sentiment", "ask"] as const;
      type ValidIntent = (typeof validIntents)[number];
      const rawIntent = String(args.intent ?? "analyze");
      const intent: ValidIntent = validIntents.includes(rawIntent as ValidIntent)
        ? (rawIntent as ValidIntent)
        : "analyze";

      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (!geminiKey) {
        return ok(
          id,
          textContent(
            "The Readdit MCP server is not configured with an AI key. " +
              "Use readdit_search for raw Reddit results, or contact the server operator."
          )
        );
      }

      try {
        const core = createCoreFromEnv({ memoryCache: true });
        const report =
          intent === "ask"
            ? await core.ask(query, { limit: 25 })
            : await core[intent](query, { limit: 25 });

        return ok(id, textContent(JSON.stringify(report, null, 2)));
      } catch (e) {
        const msg = e instanceof ReadditError ? e.message : "Analysis failed.";
        return ok(id, { isError: true, ...textContent(msg) });
      }
    }

    return err(id, -32601, `Unknown tool: ${toolName}`);
  }

  return err(id, -32601, `Method not found: ${method}`);
}

// Allow GET for health check / discovery
export async function GET() {
  return NextResponse.json({
    name: "readdit",
    version: "0.1.0",
    description: "Reddit research MCP server — paste this URL into Claude.ai → Integrations",
    transport: "http",
    tools: TOOLS.map((t) => t.name),
  });
}
