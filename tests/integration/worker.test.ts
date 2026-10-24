import { describe, expect, it, vi } from "vitest";
import { getDailySalt, sanitizePii } from "../../src/guardrails/pii-sanitizer";
import worker from "../../src/index";
import type { Env } from "../../src/types/bindings";

describe("Worker End-to-End Integration Suite (Spec 02 & Spec 03)", () => {
  const mockEnv: Env = {
    AI: {
      run: vi.fn().mockImplementation(() =>
        Promise.resolve(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: {"text": "According to the PDS, flood is defined..."}\n\n`
                )
              );
              controller.close();
            },
          })
        )
      ),
    },
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    } as unknown as D1Database,
    CORPUS_BUCKET: {} as R2Bucket,
    CONFIG_KV: {} as KVNamespace,
  };

  const mockCtx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;

  it("1. GET /health returns 200 OK and PoP location", async () => {
    const req = new Request("http://localhost/health", { method: "GET" });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; popLocation: string };
    expect(body.status).toBe("healthy");
    expect(body.popLocation).toBeDefined();
  });

  it("2. POST /api/chat returns 422 on invalid schema", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "" }), // missing conversationId and invalid query
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(422);
  });

  it("3. POST /api/chat intercepts personal financial advice framing with event: error", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" },
      body: JSON.stringify({
        query: "I have a budget of $500. Which policy should I buy?",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toContain("ADVICE_BOUNDARY_VIOLATION");
    expect(text).toContain("PERSONAL_ADVICE_REQUESTED");
    expect(text).toContain("cannot provide personal financial product advice");
    // Verify non-blocking telemetry recorded with advice flag
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });

  it("4. POST /api/chat intercepts emergency life threats with emergency hotlines", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.5" },
      body: JSON.stringify({
        query: "My house is burning down right now, who do I call for help?",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toContain("EMERGENCY_INTERCEPTION");
    expect(text).toContain("000");
    expect(text).toContain("132 500");
    expect(text).toContain("1800 018 444");
  });

  it("5. POST /api/chat streams SSE events (metadata, token, done) for compliant queries", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.6" },
      body: JSON.stringify({
        query: "What is the standard flood definition?",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        filters: { insurer: "SUNCORP" },
      }),
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: metadata");
    expect(text).toContain("event: token");
    expect(text).toContain("flood is defined");
    expect(text).toContain("event: done");
    expect(text).toContain('"finish_reason":"stop"');
  });

  it("6. PII Sanitizer strips Australian Driver Licences, TFNs, Cards, Medicare and Phone numbers with daily salt", async () => {
    const dirtyQuery =
      "My driver licence is NSW licence 12345678, my TFN is 123 456 789, medicare 21234567891, card 4532 1234 5678 9010, phone 0412 345 678. What is my cover?";
    const result = await sanitizePii(dirtyQuery);

    expect(result.wasRedacted).toBe(true);
    expect(result.sanitized).toContain("[REDACTED_LICENCE]");
    expect(result.sanitized).toContain("[REDACTED_TFN]");
    expect(result.sanitized).toContain("[REDACTED_MEDICARE]");
    expect(result.sanitized).toContain("[REDACTED_CARD]");
    expect(result.sanitized).toContain("[REDACTED_PHONE]");
    expect(result.sanitized).not.toContain("12345678");
    expect(result.queryHash).toBeDefined();
    expect(result.queryHash.length).toBe(64);

    // Verify salt rotation changes hash across dates for k-anonymity (PRD § 5.4)
    const saltDay1 = getDailySalt(new Date("2026-10-23"));
    const saltDay2 = getDailySalt(new Date("2026-10-24"));
    expect(saltDay1).not.toBe(saltDay2);

    const hash1 = (await sanitizePii("Test query", saltDay1)).queryHash;
    const hash2 = (await sanitizePii("Test query", saltDay2)).queryHash;
    expect(hash1).not.toBe(hash2);
  });

  it("7. Enforces rate limiting headers and blocks when exceeding 10 req/min (PRD § 4.1)", async () => {
    const testIp = "203.0.113.42";
    let lastRes: Response | null = null;

    // Send 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
        body: JSON.stringify({
          query: "What does Suncorp cover?",
          conversationId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      });
      lastRes = await worker.fetch(req, mockEnv, mockCtx);
      expect(lastRes.status).toBe(200);
      expect(lastRes.headers.get("X-RateLimit-Limit")).toBe("10");
    }

    // 11th request must be rejected with 429 Too Many Requests
    const req11 = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({
        query: "What does Suncorp cover?",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });
    const res11 = await worker.fetch(req11, mockEnv, mockCtx);
    expect(res11.status).toBe(429);
    expect(res11.headers.get("X-RateLimit-Remaining")).toBe("0");
    const body = (await res11.json()) as { error: string };
    expect(body.error).toBe("Too Many Requests");
  });

  it("8. Invokes env.AI_SEARCH when provided and forwards retrieved chunks in metadata SSE", async () => {
    const searchMock = vi.fn().mockResolvedValue({
      results: [
        {
          id: "chunk-ai-1",
          score: 0.95,
          content: "Cloudflare AI Search retrieved clause content for testing.",
          metadata: {
            insurer: "allianz",
            product: "Home Insurance",
            docType: "PDS",
            section: "Flood Cover",
            effectiveDate: "2024-03-01",
          },
        },
      ],
    });

    const envWithAiSearch: Env = {
      ...mockEnv,
      AI_SEARCH: {
        search: searchMock,
      },
    };

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.101" },
      body: JSON.stringify({
        query: "What is the flood definition for Allianz?",
        conversationId: "550e8400-e29b-41d4-a716-446655440001",
        filters: {
          insurer: "allianz",
        },
      }),
    });

    const res = await worker.fetch(req, envWithAiSearch, mockCtx);
    expect(res.status).toBe(200);
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.any(String),
        topK: 5,
        rerank: true,
        filter: { insurer: "allianz" },
      })
    );

    const text = await res.text();
    expect(text).toContain("event: metadata");
    expect(text).toContain("Cloudflare AI Search retrieved clause content for testing.");
  });

  it("9. Seamlessly falls back to in-isolate localHybridSearch if env.AI_SEARCH throws", async () => {
    const searchMock = vi.fn().mockRejectedValue(new Error("AI Search cluster unavailable"));

    const envWithFaultySearch: Env = {
      ...mockEnv,
      AI_SEARCH: {
        search: searchMock,
      },
    };

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.102" },
      body: JSON.stringify({
        query: "Does Suncorp cover flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440002",
        filters: {
          insurer: "suncorp",
        },
      }),
    });

    const res = await worker.fetch(req, envWithFaultySearch, mockCtx);
    expect(res.status).toBe(200);
    expect(searchMock).toHaveBeenCalled();

    const text = await res.text();
    expect(text).toContain("event: metadata");
    // Chunks should come from local retriever fallback
    expect(text).toContain("suncorp");
  });

  it("10. Supports modern Cloudflare AI Search response schema (chunks array)", async () => {
    const searchMock = vi.fn().mockResolvedValue({
      search_query: "What is flood?",
      chunks: [
        {
          id: "chunk-modern-ai",
          score: 0.98,
          content: "Water defined under modern AI Search chunks format.",
          metadata: {
            insurer: "suncorp",
            filename: "corpus/pds/suncorp/home/PDS.md",
          },
        },
      ],
    });

    const envWithModernSearch: Env = {
      ...mockEnv,
      AI_SEARCH: {
        search: searchMock,
      },
    };

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.103" },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440003",
        filters: {
          insurer: "suncorp",
        },
      }),
    });

    const res = await worker.fetch(req, envWithModernSearch, mockCtx);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: metadata");
    expect(text).toContain("Water defined under modern AI Search chunks format.");
  });
});
