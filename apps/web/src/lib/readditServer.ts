import { NextResponse } from "next/server";
import { verifyFirebaseToken } from "./firebaseAdmin";
import { checkAnalysisRateLimit } from "./rateLimit";
import { ReadditError, newRequestId, logger } from "@readdit/core";

export interface AuthedContext {
  userId: string;
  requestId: string;
}

export async function requireAuthedAndWithinLimit(
  req: Request
): Promise<{ ok: true; ctx: AuthedContext } | { ok: false; response: NextResponse }> {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Sign in to run live Reddit research.", code: "unauthenticated" },
          { status: 401 }
        ),
      };
    }

    const claims = await verifyFirebaseToken(token);
    if (!claims) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or expired session. Sign in again.", code: "unauthenticated" },
          { status: 401 }
        ),
      };
    }

    const limit = checkAnalysisRateLimit(claims.uid);
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

    return { ok: true, ctx: { userId: claims.uid, requestId: newRequestId() } };
  } catch (err) {
    logger.error("auth_gate_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not verify your session. Try signing in again.", code: "unauthenticated" },
        { status: 401 }
      ),
    };
  }
}

export function readditErrorResponse(err: unknown): NextResponse {
  if (err instanceof ReadditError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
  }
  return NextResponse.json(
    { error: "Something went wrong while researching that.", code: "unknown_error" },
    { status: 500 }
  );
}
