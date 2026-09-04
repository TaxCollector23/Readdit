# Readdit

**Readdit reads Reddit so you don't have to.**

Readdit is an evidence-first research engine for what Reddit actually says about products,
companies, technologies, libraries, and AI tools. Ask it about something and it plans a batch
of Reddit-focused searches, retrieves real discussions, deduplicates and ranks them, extracts
evidence, and synthesizes an evidence-backed report — every non-trivial claim links back to
the actual posts/comments that support it.

```
$ readdit "Cursor"

Readdit
Reading it...

› Searching Reddit...
✓ Analyzed 62 discussions across 18 subreddits

74/100  POSITIVE   Confidence: High

SUMMARY
Cursor is generally viewed positively, with agent capabilities being the
biggest recurring strength. The most common complaints concern pricing
and reliability under heavy use.

EVIDENCE
r/cursor — "Switched from Copilot, agent mode is..."
https://reddit.com/r/cursor/...
```

Same core engine, three interfaces:

- **CLI** — `readdit "Cursor"`, `readdit compare "Cursor" "Claude Code"`, `--json` for scripts.
- **MCP server** — give an AI agent `readdit_search`, `readdit_analyze`, `readdit_compare`, and more.
- **Web playground** — a public landing page + static demo, and an authenticated live playground.

Reddit users are not a statistically representative sample of the entire market. Readdit says
so, explicitly, in every report — treat findings as directional signal from a specific
community, not a market survey.

## Why "Readdit"

Reddit + "read it." Readdit reads Reddit so you don't have to.

## Table of contents

- [Architecture](#architecture)
- [Quickstart](#quickstart)
- [CLI](#cli)
- [MCP server](#mcp-server)
- [Web playground](#web-playground)
- [How analysis works](#how-analysis-works)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Limitations](#limitations)

## Architecture

```
                      ┌──────────────────┐
                      │   Readdit Core    │
                      │ (@readdit/core)   │
                      │                   │
                      │ research()        │
                      │ analyze()         │
                      │ compare()         │
                      │ complaints()      │
                      │ features()        │
                      │ sentiment()       │
                      │ ask()             │
                      │ search()          │
                      └─────────┬─────────┘
                                │
             ┌──────────────────┼──────────────────┐
             ↓                  ↓                   ↓
            CLI                MCP               Web app
     (readdit-cli)        (@readdit/mcp)      (apps/web, Next.js)
             ↓                  ↓                   ↓
         terminal          AI agents            playground UI
```

The CLI, MCP server, and web app never duplicate research/analysis logic — they all call the
same `ReadditCore` instance. Fix a bug in the pipeline once, every interface benefits.

Inside the core:

```
query
 ↓
research planning        (packages/core/src/planning)     — intent-aware query generation
 ↓
retrieval                (packages/core/src/search)       — Reddit search, DuckDuckGo, OpenRouter web search
 ↓
normalization + dedup    (packages/core/src/ranking)      — canonical URLs, near-duplicate merge
 ↓
relevance/quality ranking (packages/core/src/ranking)      — source diversity balancing
 ↓
chunked evidence extraction (packages/core/src/synthesis)  — cited to source indices, never free URLs
 ↓
theme/sentiment aggregation
 ↓
cross-source synthesis    (packages/core/src/analysis)     — OpenRouter, structured JSON, validated
 ↓
evidence-backed report    (RedditReport / CompareReport)
```

Search and analysis are both behind provider interfaces (`SearchProvider`, `AnalysisProvider`),
so they're swappable — see [Provider architecture](#provider-architecture) below.

### Monorepo layout

```
packages/core   @readdit/core   — the engine (types, search, ranking, analysis, synthesis, cache)
packages/cli    readdit-cli     — terminal interface (bin: readdit)
packages/mcp    @readdit/mcp    — MCP server (bin: readdit-mcp)
apps/web        web             — Next.js landing page, demo, playground, API routes
```

## Quickstart

Requires Node 20.6+ (uses the built-in `node:sqlite` module — no native build step) and pnpm.

```bash
git clone <this repo>
cd Readdit
pnpm install
cp .env.example .env
# edit .env — at minimum set OPENROUTER_API_KEY (get one at https://openrouter.ai/keys)
pnpm --filter @readdit/core build
```

Try the CLI immediately:

```bash
pnpm --filter readdit-cli build
node packages/cli/dist/bin.js "Cursor"
```

Or install it globally-ish for repeated use:

```bash
pnpm --filter readdit-cli build
npm link --prefix packages/cli   # or: alias readdit="node $(pwd)/packages/cli/dist/bin.js"
readdit "Cursor"
```

Run the web app:

```bash
pnpm --filter web dev
# open http://localhost:3000
```

Run the MCP server:

```bash
pnpm --filter @readdit/mcp build
node packages/mcp/dist/server.js
```

### Try it without an API key

Every package respects `READDIT_MOCK_PROVIDERS=1`, which swaps in a deterministic mock search
provider and a keyword-based mock analysis provider — no OpenRouter calls, no network calls to
Reddit. Useful for UI work, tests, and exploring the pipeline without spending API budget:

```bash
READDIT_MOCK_PROVIDERS=1 node packages/cli/dist/bin.js "Cursor"
```

## CLI

```
readdit "Cursor"                                  # shorthand for `analyze`
readdit analyze "Cursor"
readdit compare "Cursor" "Claude Code"
readdit complaints "Vercel"
readdit features "OpenWebUI"
readdit sentiment "Qwen"
readdit ask "Why are people leaving Cursor?"
readdit search "RTX 5070 Ti"                       # retrieval only, no LLM call
```

Global options:

```
--json              machine-readable JSON only, no decorative output
--limit <number>    max discussions to retrieve
--model <model>     OpenRouter model override, e.g. anthropic/claude-sonnet-4.5
--fresh             bypass the cache and re-research
--depth <depth>     quick | standard | deep — bounds query fan-out and source volume
--verbose           print diagnostic info on failure
--quiet             suppress status lines
--no-color          disable colored output
```

`--json` output is a stable `RedditReport` (or `CompareReport`) shape — see
[`packages/core/src/types.ts`](packages/core/src/types.ts) for the exact fields (`query`,
`summary`, `sentiment`, `praise`, `complaints`, `featureRequests`, `themes`, `evidence`,
`sourceCount`, `subreddits`, `confidence`, `limitations`, …). On failure it prints
`{"error": true, "code": "...", "message": "..."}` instead.

Exit codes: `0` success · `1` general/application error · `2` invalid usage · `3`
configuration error · `5` rate limited.

## MCP server

Same core, exposed as MCP tools for AI agents:

- `readdit_search` — retrieval only (no LLM synthesis), for agents that want to reason over raw evidence themselves.
- `readdit_analyze` — full report: summary, sentiment, praise/complaints/themes, evidence.
- `readdit_compare` — researches two products independently, then compares.
- `readdit_complaints` / `readdit_features` / `readdit_sentiment` — focused variants.
- `readdit_ask` — natural-language question in, evidence-backed report out; infers the right
  research strategy (e.g. "why are people leaving X" researches complaints + alternatives +
  switching behavior, not one literal search).

Every tool description tells the calling agent what it returns, that evidence URLs are
included, and that Reddit isn't representative of the whole market — see
[`packages/mcp/src/server.ts`](packages/mcp/src/server.ts).

### Configuring an MCP client

```json
{
  "mcpServers": {
    "readdit": {
      "command": "node",
      "args": ["/absolute/path/to/Readdit/packages/mcp/dist/server.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-..."
      }
    }
  }
}
```

Build first (`pnpm --filter @readdit/mcp build`, plus `pnpm --filter @readdit/core build`), or
point `args` at a published npm package once you publish one. The MCP server does not read the
web app's `.env` automatically unless the client launches it from the repo root or you pass
`env` explicitly, as above.

## Web playground

- `/` — public landing page (product explanation, CLI/MCP examples).
- `/demo` — a static, pre-generated example report. No login, no live search/LLM calls — safe
  for anonymous traffic.
- `/playground` — public to view; typing a query and hitting **Analyze** triggers live research.
  If you're not signed in, your query is preserved and you're prompted to sign in, then
  returned straight to your results (no silent redirect, no lost input).
- `/login`, `/signup` — email/password auth (NextAuth, credentials provider, scrypt-hashed
  passwords in the local SQLite file — see [Authentication](#authentication)).

All live research goes through `POST /api/analyze` / `POST /api/compare`, which:

1. verify the session server-side (never trust a client `isLoggedIn` flag),
2. enforce a per-user rate limit (`READDIT_RATE_LIMIT_PER_HOUR`, default 20/hour),
3. validate input,
4. run `ReadditCore`,
5. stream real progress events (newline-delimited JSON: `{"type":"progress","stage":...}`)
   followed by `{"type":"result","report":...}` — the UI only shows a stage once the backend
   is actually in it, never a fake percentage.

Secrets (`OPENROUTER_API_KEY`, `AUTH_SECRET`, `DATABASE_URL`) are only ever read server-side.

### Authentication

The public site (landing page, demo, CLI/MCP docs) needs no login. Live playground research
does, purely to bound cost and abuse:

```
visitor → landing page → demo (no auth) → playground → types a query
  → clicks Analyze → 401 → "sign in to continue" (query preserved)
  → signs in → redirected back to /playground with the query pre-filled → auto-runs
```

If this repo already had an auth system, Readdit would reuse it. It didn't, so this uses
NextAuth (Auth.js) v5 with a credentials provider and a `users` table in the same local SQLite
file as everything else — no OAuth app registration required to run this locally.

## How analysis works

1. **Query planning** (`planQueries`) — the user's topic/intent produces 4–12 Reddit-focused
   search queries (more for `complaints`/`features`/`compare`, fewer for `quick` depth), not
   one literal search.
2. **Retrieval** — queries fan out in parallel to every configured `SearchProvider`
   (`RedditSearchProvider` hits `reddit.com/search.json` directly; `DuckDuckGoSearchProvider`
   scrapes `site:reddit.com` results; `OpenRouterSearchProvider` uses OpenRouter's web-search
   plugin as a fallback that works even when direct scraping is blocked/rate-limited from a
   given network). Failures in one provider don't fail the whole search
   (`CompositeSearchProvider` uses `Promise.allSettled`).
3. **Normalize + dedupe** — canonicalize URLs, merge near-identical titles, compute a
   relevance score (topic/term overlap) and a quality score (upvotes, comment count,
   substantive text length — **upvotes alone are never treated as truth**).
4. **Rank + diversify** — sort by blended relevance/quality/recency, then round-robin across
   subreddits so one loud thread or community can't dominate the evidence set.
5. **Adaptive follow-up** — if the first round comes back thin (too few subreddits, too few
   results), a small second round of queries runs automatically (`standard`/`deep` depth only).
6. **Chunked evidence extraction** — discussions are split into ~15-source chunks, each sent to
   OpenRouter with a numbered source list; the model may only cite those numbers
   (`sourceIndices`), never invent a URL. Anything citing an out-of-range index is dropped.
7. **Merge observations** — near-duplicate observations across chunks are merged (Jaccard
   similarity on normalized text) and counted, so "12 people mentioned pricing" is an actual
   count, not a guess.
8. **Final synthesis** — one more OpenRouter call turns the merged observations into the report
   shape (summary, key takeaways, sentiment, themes, evidence claims). Output is validated
   against a Zod schema; on validation failure it retries once, then fails loudly rather than
   returning malformed data.
9. **Evidence mapping** — every evidence claim's cited source indices are resolved back to the
   *actual* retrieved discussion's title/URL/subreddit — the model never gets to author a URL.
   A claim with zero valid citations after this step is dropped (no evidence → no claim).
10. **Confidence scoring** — based on source count, subreddit diversity, cross-chunk sentiment
    consistency, and citation coverage. Low source counts produce a `low` confidence report,
    not a falsely-confident one. A representativeness caveat is always included in
    `limitations`.

### Provider architecture

```ts
interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
interface AnalysisProvider {
  analyze(input: AnalysisInput): Promise<RedditReport>;
  compare(input: AnalysisInput & { discussionsB: NormalizedDiscussion[] }): Promise<CompareReport>;
}
interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
```

To add a new search source, implement `SearchProvider` and add it to the list in
`createCoreFromEnv` (`packages/core/src/factory.ts`). To use a different model gateway,
implement `AnalysisProvider` the same way.

## Environment variables

See [`.env.example`](.env.example) for the full list with defaults. The important ones:

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes (unless `READDIT_MOCK_PROVIDERS=1`) | OpenRouter API key for analysis + web-search fallback |
| `OPENROUTER_MODEL` | No | Model id, default `openai/gpt-4o-mini` |
| `DATABASE_URL` | No | SQLite file path, default `./data/readdit.db` — shared by cache, rate limits, and (web app) users/history |
| `AUTH_SECRET` | Yes, for the web app | NextAuth session secret — `openssl rand -base64 32` |
| `READDIT_CACHE_TTL_SECONDS` | No | Default 21600 (6h) |
| `READDIT_RATE_LIMIT_PER_HOUR` | No | Web playground per-user limit, default 20 |
| `READDIT_MOCK_PROVIDERS` | No | `1` to use mock search/analysis (no external calls) |

All packages read a single root-level `.env` (the CLI and MCP server walk up from their own
location to find it; the web app's `next.config.mjs` loads it as a fallback when it has no
`apps/web/.env.local` of its own).

## Local development

```bash
pnpm install
pnpm --filter @readdit/core build     # rebuild after core changes — cli/mcp/web import its dist
pnpm --filter readdit-cli build
pnpm --filter @readdit/mcp build
pnpm --filter web dev                 # Next dev server with hot reload
pnpm -r typecheck                     # typecheck every package
```

`READDIT_MOCK_PROVIDERS=1` is the fastest inner loop for UI/CLI/MCP work — it exercises the
full pipeline (query planning → search → dedupe → rank → "analysis" → report rendering) with
zero external calls, using [`MockSearchProvider`](packages/core/src/search/mockProvider.ts) and
[`MockAnalysisProvider`](packages/core/src/analysis/mockProvider.ts).

## Limitations

- **Reddit is not representative.** Every report says so explicitly. Treat findings as "what
  Reddit discussions show," not a market-wide survey.
- **Retrieval depends on network conditions.** Reddit's and DuckDuckGo's public endpoints can
  rate-limit or bot-block requests from some networks/IPs; the OpenRouter web-search fallback
  exists specifically to keep retrieval working when that happens, at the cost of an extra
  model call per query.
- **This is a single-instance MVP.** Caching, rate limiting, and user data all live in one
  local SQLite file — by design, per the project's own "don't build infrastructure the MVP
  doesn't need" constraint. It's not built for multi-region serverless deployment as-is.
- **Sentiment scores are a summary signal, not a statistic.** A score is not a confidence
  interval; the `confidence` field (based on source count/diversity/consistency) is meant to be
  read alongside it, not instead of it.

---

Readdit. It reads Reddit.
