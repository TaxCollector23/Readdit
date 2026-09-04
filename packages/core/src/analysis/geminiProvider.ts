import type {
  AnalysisInput,
  AnalysisProvider,
  CompareReport,
  NormalizedDiscussion,
  RedditReport,
} from "../types.js";
import { synthesizeCompareReport, synthesizeReport } from "../synthesis/pipeline.js";
import { GeminiClient } from "./geminiClient.js";

export class GeminiAnalysisProvider implements AnalysisProvider {
  readonly name = "gemini";
  private client: GeminiClient;

  constructor(apiKey: string, readonly model: string) {
    this.client = new GeminiClient(apiKey);
  }

  async analyze(input: AnalysisInput): Promise<RedditReport> {
    return synthesizeReport({
      client: this.client,
      model: this.model,
      topic: input.query,
      intent: input.intent,
      discussions: input.discussions,
      onProgress: input.onProgress,
    });
  }

  async compare(
    input: AnalysisInput & { discussionsB: NormalizedDiscussion[] }
  ): Promise<CompareReport> {
    return synthesizeCompareReport({
      client: this.client,
      model: this.model,
      topicA: input.query,
      topicB: input.secondaryTopic ?? "",
      discussionsA: input.discussions,
      discussionsB: input.discussionsB,
      onProgress: input.onProgress,
    });
  }
}
