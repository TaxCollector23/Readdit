import { NextResponse } from "next/server";
import { auth } from "./auth";
import { checkAnalysisRateLimit } from "./rateLimit";
import { ReadditError, newRequestId } from "@readdit/core";

export interface AuthedContext {
  userId: string;
  requestId: string;
}

/**
 * Shared guard for every live-research API route: verifies the session
 * server-side (never trusting a client-supplied "isLoggedIn" flag) and
 * enforces the per-user rate limit before any search/LLM budget is spent.
 */
export async function requireAuthedAndWithinLimit(): Promise<
  { ok: true; ctx: AuthedContext } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in to run live Reddit research.", code: "unauthenticated" },
        { status: 401 }
      ),
    };
  }

  const limit = checkAnalysisRateLimit(userId);
  if (!limit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Rate limit reached (${limit.limit}/hour). Try again in about ${limit.retryAfterSeconds}s.`,
          code: "rate_limited",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        { status: 429 }
      ),
    };
  }

  return { ok: true, ctx: { userId, requestId: newRequestId() } };
}

export function readditErrorResponse(err: unknown): NextResponse {
  if (err instanceof ReadditError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus }
    );
  }
  return NextResponse.json(
    { error: "Something went wrong while researching that.", code: "unknown_error" },
    { status: 500 }
  );
}
