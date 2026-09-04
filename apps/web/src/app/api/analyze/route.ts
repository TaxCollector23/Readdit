import { createCoreFromEnv, ReadditError, type ProgressStage } from "@readdit/core";
import { requireAuthedAndWithinLimit } from "@/lib/readditServer";
import { recordSearchHistory } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface AnalyzeBody {
  query?: unknown;
  intent?: unknown;
  limit?: unknown;
  fresh?: unknown;
}

const VALID_INTENTS = new Set(["analyze", "complaints", "features", "sentiment", "ask"]);

function sseLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  const gate = await requireAuthedAndWithinLimit();
  if (!gate.ok) return gate.response;

  let body: AnalyzeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid_input" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const intent = typeof body.intent === "string" && VALID_INTENTS.has(body.intent) ? body.intent : "analyze";
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.round(body.limit), 5), 100)
      : undefined;
  const fresh = body.fresh === true;

  if (!query || query.length > 300) {
    return NextResponse.json(
      { error: "Provide a query between 1 and 300 characters.", code: "invalid_input" },
      { status: 400 }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const onProgress = (stage: ProgressStage, detail?: string) => {
        if (stage === "done") return;
        controller.enqueue(sseLine({ type: "progress", stage, detail }));
      };

      try {
        const core = createCoreFromEnv({ requestId: gate.ctx.requestId });
        const report =
          intent === "ask"
            ? await core.ask(query, { limit, fresh, requestId: gate.ctx.requestId, onProgress })
            : await core[intent as "analyze" | "complaints" | "features" | "sentiment"](query, {
                limit,
                fresh,
                requestId: gate.ctx.requestId,
                onProgress,
              });

        recordSearchHistory(gate.ctx.userId, query, intent);
        controller.enqueue(sseLine({ type: "result", report }));
      } catch (err) {
        if (err instanceof ReadditError) {
          controller.enqueue(sseLine({ type: "error", error: err.message, code: err.code }));
        } else {
          controller.enqueue(
            sseLine({ type: "error", error: "Something went wrong while researching that.", code: "unknown_error" })
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
