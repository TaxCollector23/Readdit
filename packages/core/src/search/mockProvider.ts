import type { SearchOptions, SearchProvider, SearchResult } from "../types.js";

const SUBREDDITS = ["programming", "webdev", "technology", "SaaS", "startups"];

/**
 * Deterministic fixture provider for local development and tests, so UI and
 * integration work doesn't have to spend real search/LLM budget. Enabled via
 * READDIT_MOCK_PROVIDERS=1.
 */
export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 12, 20);
    const topic = query.replace(/^site:reddit\.com\s*/i, "").trim();
    const results: SearchResult[] = [];

    const templates: Array<{ title: string; text: string; score: number; type: "post" | "comment" }> = [
      {
        title: `${topic} review after 3 months of daily use`,
        text: `Been using ${topic} daily for a project. Honestly it's solid for the core workflow, but pricing caught me off guard once we scaled up. Support has been responsive though.`,
        score: 342,
        type: "post",
      },
      {
        title: `Anyone else having reliability issues with ${topic}?`,
        text: `Getting intermittent failures with ${topic} this week. Not a dealbreaker but annoying during a deadline crunch.`,
        score: 87,
        type: "post",
      },
      {
        title: `${topic} vs the alternatives — what did you switch to?`,
        text: `I moved off ${topic} mostly because of cost, but honestly the migration was more painful than expected. The alternative had better docs though.`,
        score: 156,
        type: "post",
      },
      {
        title: `re: ${topic} thread`,
        text: `Feature request: it'd be great if ${topic} supported better keyboard shortcuts and offline mode. Been asking for this for a year.`,
        score: 44,
        type: "comment",
      },
      {
        title: `${topic} for beginners — worth it?`,
        text: `Started using ${topic} last month as a beginner. The learning curve is real but once it clicks it's genuinely fast.`,
        score: 220,
        type: "post",
      },
    ];

    for (let i = 0; i < limit; i++) {
      const t = templates[i % templates.length];
      results.push({
        title: t.title,
        url: `https://www.reddit.com/r/${SUBREDDITS[i % SUBREDDITS.length]}/comments/mock${i}/${encodeURIComponent(
          topic.toLowerCase().replace(/\s+/g, "_")
        )}/`,
        snippet: t.text,
        text: t.text,
        source: "mock",
        subreddit: SUBREDDITS[i % SUBREDDITS.length],
        author: `mock_user_${i}`,
        timestamp: new Date(Date.now() - i * 86400000 * 3).toISOString(),
        score: t.score,
        numComments: Math.floor(t.score / 4),
        sourceType: t.type,
        matchedQuery: query,
      });
    }

    return results;
  }
}
