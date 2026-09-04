import { createCoreFromEnv, ReadditError, type ProgressStage } from "@readdit/core";
import { requireAuthedAndWithinLimit } from "@/lib/readditServer";
import { recordSearchHistory } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface CompareBody {
  topicA?: unknown;
  topicB?: unknown;
  limit?: unknown;
  fresh?: unknown;
}

function sseLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  const gate = await requireAuthedAndWithinLimit(req);
  if (!gate.ok) return gate.response;

  let body: CompareBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid_input" }, { status: 400 });
  }

  const topicA = typeof body.topicA === "string" ? body.topicA.trim() : "";
  const topicB = typeof body.topicB === "string" ? body.topicB.trim() : "";
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.round(body.limit), 5), 100)
      : undefined;
  const fresh = body.fresh === true;

  if (!topicA || !topicB || topicA.length > 300 || topicB.length > 300) {
    return NextResponse.json(
      { error: "Provide both products to compare (1-300 characters each).", code: "invalid_input" },
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
        const report = await core.compare(topicA, topicB, {
          limit,
          fresh,
          requestId: gate.ctx.requestId,
          onProgress,
        });
        recordSearchHistory(gate.ctx.userId, `${topicA} vs ${topicB}`, "compare");
        controller.enqueue(sseLine({ type: "result", report }));
      } catch (err) {
        if (err instanceof ReadditError) {
          controller.enqueue(sseLine({ type: "error", error: err.message, code: err.code }));
        } else {
          controller.enqueue(
            sseLine({ type: "error", error: "Something went wrong while comparing that.", code: "unknown_error" })
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
