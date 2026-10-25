export interface AiSearchChunkItem {
  id?: string;
  score?: number;
  content?: string;
  text?: string;
  item?: {
    key?: string;
    timestamp?: number;
    metadata?: Record<string, unknown>;
  };
  metadata?: {
    insurer?: string;
    product?: string;
    docType?: string;
    section?: string;
    clauseId?: string;
    sourceUrl?: string;
    effectiveDate?: string;
    filename?: string;
    [key: string]: unknown;
  };
}

export interface Env {
  // Cloudflare AI Search (Hybrid BM25 + Vector + Reranking)
  AI_SEARCH?: {
    search(params: {
      query?: string;
      messages?: Array<{ role: string; content: string }>;
      ai_search_options?: {
        retrieval?: {
          max_num_results?: number;
          return_on_failure?: boolean;
          filters?: Record<string, unknown>;
        };
      };
    }): Promise<{
      results?: AiSearchChunkItem[];
      chunks?: AiSearchChunkItem[];
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
