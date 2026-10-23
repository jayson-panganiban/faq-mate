export interface Env {
  // Cloudflare AI Search (Hybrid BM25 + Vector + Reranking)
  AI_SEARCH?: {
    search(params: {
      query: string;
      topK?: number;
      rerank?: boolean;
      filter?: Record<string, string>;
    }): Promise<{
      results: Array<{
        id: string;
        score: number;
        content: string;
        metadata: {
          insurer?: string;
          product?: string;
          docType?: string;
          section?: string;
          clauseId?: string;
          sourceUrl?: string;
          effectiveDate?: string;
        };
      }>;
    }>;
  };

  // Cloudflare Workers AI
  AI: {
    run(
      model: string,
      params: Record<string, unknown>
    ): Promise<ReadableStream<Uint8Array> | Record<string, unknown>>;
  };

  // Cloudflare D1 Telemetry
  DB: D1Database;

  // Cloudflare R2 Corpus
  CORPUS_BUCKET: R2Bucket;

  // Cloudflare KV Config
  CONFIG_KV: KVNamespace;
}
