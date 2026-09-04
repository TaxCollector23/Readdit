const API_BASE = "https://readdit-sigma.vercel.app";

export interface StreamEvent {
  type: "progress" | "result" | "error";
  stage?: string;
  detail?: string;
  report?: unknown;
  error?: string;
  code?: string;
}

async function* ndjsonStream(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) {
        try {
          yield JSON.parse(line) as StreamEvent;
        } catch {
          /* skip malformed line */
        }
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer) as StreamEvent;
    } catch {
      /* skip */
    }
  }
}

/** Stream an analyze/compare/ask call from the hosted Readdit API. */
export async function* cloudStream(
  endpoint: "analyze" | "compare",
  body: Record<string, unknown>,
  idToken: string
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield { type: "error", error: `Network error: ${msg}`, code: "network_error" };
    return;
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    yield {
      type: "error",
      error: String(data.error ?? `Request failed (HTTP ${res.status})`),
      code: String(data.code ?? "unknown_error"),
    };
    return;
  }

  yield* ndjsonStream(res);
}

/** Non-auth search — returns raw discussion list. */
export async function cloudSearchRaw(
  query: string,
  limit: number
): Promise<{ discussions: unknown[]; queriesUsed: string[] }> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String(data.error ?? `Search failed (HTTP ${res.status})`));
  }
  return res.json() as Promise<{ discussions: unknown[]; queriesUsed: string[] }>;
}
