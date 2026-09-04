import { createSearchCoreFromEnv, ReadditError } from "@readdit/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface SearchBody {
  query?: unknown;
  limit?: unknown;
  fresh?: unknown;
}

export async function POST(req: Request) {
  let body: SearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid_input" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.round(body.limit), 5), 50)
      : 20;
  const fresh = body.fresh === true;

  if (!query || query.length > 300) {
    return NextResponse.json(
      { error: "Provide a query between 1 and 300 characters.", code: "invalid_input" },
      { status: 400 }
    );
  }

  try {
    const core = createSearchCoreFromEnv({});
    const { discussions, queriesUsed } = await core.search(query, {
      limit,
      fresh,
      depth: "quick",
    });

    return NextResponse.json({
      query,
      queriesUsed,
      resultCount: discussions.length,
      subredditCount: new Set(discussions.map((d) => d.subreddit ?? "unknown")).size,
      results: discussions.map((d) => ({
        title: d.title,
        url: d.url,
        subreddit: d.subreddit,
        author: d.author,
        timestamp: d.timestamp,
        score: d.score,
        numComments: d.numComments,
        sourceType: d.sourceType,
        source: d.source,
        excerpt: (d.text || d.snippet || "").slice(0, 500),
        relevance: Number(d.relevanceScore.toFixed(2)),
      })),
    });
  } catch (err) {
    if (err instanceof ReadditError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong while searching Reddit.", code: "unknown_error" },
      { status: 500 }
    );
  }
}
