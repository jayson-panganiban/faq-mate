# Specification: Edge RAG Runtime & Cloudflare Worker API

**Module:** `packages/api` (Cloudflare Worker)  
**Status:** Living Specification  
**Version:** 1.0.0  
**Associated ADR:** [ADR-0001](file:///Users/jaysoncp/Developer/faq-mate/docs/adr/0001-cloudflare-ai-search-hybrid-retrieval.md)  

---

## 1. Deep Module Interface Contract

Following the `codebase-design` principle of deep modules, the entire edge runtime presents a lean external interface concealing the retrieval, prompt synthesis, and streaming mechanics.

### 1.1 Inbound API Schema (Zod)
```typescript
import { z } from "zod";

export const ChatRequestSchema = z.object({
  query: z.string().min(3).max(500),
  conversationId: z.string().uuid(),
  filters: z.object({
    insurer: z.enum(["NRMA", "SUNCORP", "ALLIANZ", "QBE", "YOUI"]).optional(),
    product: z.string().optional(),
    docType: z.enum(["PDS", "TMD", "SPDS"]).default("PDS"),
  }).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
```

### 1.2 Outbound Protocol: Server-Sent Events (SSE)
* **Endpoint:** `POST /api/chat`
* **Content-Type:** `text/event-stream`
* **Event Structure:**
  * `event: metadata` -> `{ latency_ms, retrieved_chunks: [...] }`
  * `event: token` -> `{"text": "According to the PDS..."}`
  * `event: done` -> `{"finish_reason": "stop", "total_tokens": 142}`
  * `event: error` -> `{"code": "ADVICE_BOUNDARY_VIOLATION", "message": "..."}`

---

## 2. Cloudflare Edge Bindings Contract

```typescript
export interface Env {
  // Cloudflare AI Search (Hybrid BM25 + Dense Retrieval)
  AI_SEARCH: {
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
        metadata: Record<string, string>;
      }>;
    }>;
  };

  // Cloudflare Workers AI (LLM Inference)
  AI: {
    run(
      model: "@cf/meta/llama-3.3-70b-instruct" | "@cf/meta/llama-3.1-8b-instruct",
      params: {
        messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
        stream?: boolean;
        max_tokens?: number;
        temperature?: number;
      }
    ): Promise<ReadableStream<Uint8Array>>;
  };

  // Cloudflare D1 (Audit & Telemetry SQLite)
  DB: D1Database;

  // Cloudflare KV (Prompts & Feature Flags)
  KV: KVNamespace;
}
```

---

## 3. Worker Execution Flow

1. **WAF & Rate Limiting:** Enforce maximum 10 requests per minute per IP using Cloudflare Rate Limiting API.
2. **PII Sanitizer:** Strip TFNs, Medicare, credit cards, Australian phone numbers.
3. **ASIC Advice Filter:** Evaluate intent; reject personal advice framing.
4. **AI Search Hybrid Query:** Call `env.AI_SEARCH.search({ query, topK: 5, rerank: true })`.
5. **Prompt Injection & Assembly:**
   * Context wrapping: `<context id="${chunk.id}" source="${chunk.metadata.source}">${chunk.content}</context>`.
   * Inject mandatory statutory General Advice Warning (GAW).
6. **Streaming LLM Execution:** Invoke `@cf/meta/llama-3.3-70b-instruct` with `{ stream: true }`.
7. **Async Telemetry:** Dispatch non-blocking write to Cloudflare D1 via `ctx.waitUntil()`.
