export interface JsonModelCallOptions {
  model: string;
  system: string;
  user: string;
  requestId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface JsonModelClient {
  callForJson(opts: JsonModelCallOptions): Promise<unknown>;
}
