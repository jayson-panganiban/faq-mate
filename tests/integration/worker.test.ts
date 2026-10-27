import { describe, expect, it, vi } from "vitest";
import { getDailySalt, sanitizePii } from "../../src/guardrails/pii-sanitizer";
import worker, { getCorsHeaders, isOriginAllowed, SECURITY_HEADERS } from "../../src/index";
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
        ai_search_options: expect.objectContaining({
          retrieval: expect.objectContaining({
            max_num_results: 5,
          }),
        }),
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

  it("11. isOriginAllowed strictly validates production, preview subdomains, localhost, and env overrides", () => {
    // Valid origins
    expect(isOriginAllowed("https://faq-mate.pages.dev")).toBe(true);
    expect(isOriginAllowed("https://preview-123.faq-mate.pages.dev")).toBe(true);
    expect(isOriginAllowed("https://feat-security.faq-mate.pages.dev")).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(isOriginAllowed("http://localhost:8787")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173")).toBe(true);

    // Custom origin via env
    const customEnv: Env = {
      ...mockEnv,
      ALLOWED_ORIGINS: "https://custom-partner.com.au,https://staging.insure.org",
    };
    expect(isOriginAllowed("https://custom-partner.com.au", customEnv)).toBe(true);
    expect(isOriginAllowed("https://staging.insure.org", customEnv)).toBe(true);

    // Disallowed / Malicious origins
    expect(isOriginAllowed("https://malicious-phishing.com")).toBe(false);
    expect(isOriginAllowed("https://faq-mate.pages.dev.attacker.com")).toBe(false);
    expect(isOriginAllowed("https://not-faq-mate.pages.dev")).toBe(false);
    expect(isOriginAllowed("")).toBe(false);
  });

  it("12. OPTIONS preflight handles allowed vs disallowed origins and emits security headers", async () => {
    // Allowed origin
    const preflightAllowed = new Request("http://localhost/api/chat", {
      method: "OPTIONS",
      headers: {
        Origin: "https://faq-mate.pages.dev",
        "Access-Control-Request-Method": "POST",
      },
    });
    const resAllowed = await worker.fetch(preflightAllowed, mockEnv, mockCtx);
    expect(resAllowed.status).toBe(204);
    expect(resAllowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://faq-mate.pages.dev"
    );
    expect(resAllowed.headers.get("Vary")).toBe("Origin");
    expect(resAllowed.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(resAllowed.headers.get("X-Frame-Options")).toBe("DENY");

    // Disallowed origin
    const preflightDisallowed = new Request("http://localhost/api/chat", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-attacker.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    const resDisallowed = await worker.fetch(preflightDisallowed, mockEnv, mockCtx);
    expect(resDisallowed.status).toBe(403);
    expect(resDisallowed.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("13. POST /api/chat enforces CORS origin restrictions and attaches full OWASP security headers", async () => {
    // Unauthorized origin receives 403 Forbidden
    const unauthReq = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://rogue-ai-scraper.org",
      },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440004",
      }),
    });
    const unauthRes = await worker.fetch(unauthReq, mockEnv, mockCtx);
    expect(unauthRes.status).toBe(403);
    const unauthBody = (await unauthRes.json()) as { error: string };
    expect(unauthBody.error).toBe("Forbidden");

    // Authorized origin receives 200 with dynamic CORS and defense-in-depth headers
    const authReq = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://faq-mate.pages.dev",
        "cf-connecting-ip": "192.168.1.104",
      },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440005",
      }),
    });
    const authRes = await worker.fetch(authReq, mockEnv, mockCtx);
    expect(authRes.status).toBe(200);
    expect(authRes.headers.get("Access-Control-Allow-Origin")).toBe("https://faq-mate.pages.dev");
    expect(authRes.headers.get("Vary")).toBe("Origin");
    expect(authRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(authRes.headers.get("X-Frame-Options")).toBe("DENY");
    expect(authRes.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(authRes.headers.get("Permissions-Policy")).toBeDefined();
  });

  it("14. Worker respects configurable environment variables (AI_MODEL, RETRIEVAL_TOP_K, RATE_LIMIT_MAX)", async () => {
    const aiRunMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`data: {"text": "Configurable model output"}\n\n`)
            );
            controller.close();
          },
        })
      )
    );

    const configuredEnv: Env = {
      ...mockEnv,
      AI_MODEL: "@cf/meta/llama-custom-model",
      AI_MAX_TOKENS: "512",
      RATE_LIMIT_MAX: "2",
      RATE_LIMIT_WINDOW_SECONDS: "30",
      AI: { run: aiRunMock },
    };

    const clientIp = "192.168.1.200";

    // Request 1: Allowed
    const req1 = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": clientIp },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440006",
      }),
    });
    const res1 = await worker.fetch(req1, configuredEnv, mockCtx);
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("1");
    expect(aiRunMock).toHaveBeenCalledWith(
      "@cf/meta/llama-custom-model",
      expect.objectContaining({ max_tokens: 512 })
    );

    // Request 2: Allowed
    const req2 = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": clientIp },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440007",
      }),
    });
    const res2 = await worker.fetch(req2, configuredEnv, mockCtx);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");

    // Request 3: Blocked by custom RATE_LIMIT_MAX = 2
    const req3 = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": clientIp },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440008",
      }),
    });
    const res3 = await worker.fetch(req3, configuredEnv, mockCtx);
    expect(res3.status).toBe(429);
  });

  it("15. Turnstile bot protection gates requests when TURNSTILE_SECRET_KEY is configured", async () => {
    const envWithTurnstile: Env = {
      ...mockEnv,
      TURNSTILE_SECRET_KEY: "0x4AAAAAAtestsecret",
    };

    // Missing token should be rejected with 403
    const reqNoToken = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.205" },
      body: JSON.stringify({
        query: "What is flood?",
        conversationId: "550e8400-e29b-41d4-a716-446655440009",
      }),
    });
    const resNoToken = await worker.fetch(reqNoToken, envWithTurnstile, mockCtx);
    expect(resNoToken.status).toBe(403);
    const body = (await resNoToken.json()) as { error: string; message: string };
    expect(body.message).toContain("Turnstile bot verification required");
  });

  it("16. Enforces AI_SEARCH_TIMEOUT_MS latency budget and falls back to localHybridSearch when AI_SEARCH stalls", async () => {
    const slowSearchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                chunks: [
                  {
                    id: "slow-chunk",
                    score: 0.99,
                    content: "Too late response from stalled AI Search.",
                    metadata: { insurer: "suncorp" },
                  },
                ],
              }),
            600
          )
        )
    );

    const envWithSlowSearch: Env = {
      ...mockEnv,
      AI_SEARCH_TIMEOUT_MS: "40",
      AI_SEARCH: {
        search: slowSearchMock,
      },
    };

    const start = performance.now();
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.210" },
      body: JSON.stringify({
        query: "Does Suncorp cover flood damage?",
        conversationId: "550e8400-e29b-41d4-a716-446655440010",
        filters: { insurer: "suncorp" },
      }),
    });

    const res = await worker.fetch(req, envWithSlowSearch, mockCtx);
    const text = await res.text();
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(250);
    expect(text).toContain("event: metadata");
    expect(text).not.toContain("Too late response from stalled AI Search.");
    expect(text.toLowerCase()).toContain("suncorp");
  });

  it("17. Never leaks wrong-insurer chunks when AI_SEARCH returns global non-matching results, backfilling from localHybridSearch", async () => {
    const mismatchedSearchMock = vi.fn().mockResolvedValue({
      chunks: [
        {
          id: "wrong-insurer-chunk",
          score: 0.95,
          content: "Suncorp Landlord flood clause from unfiltered global vector search.",
          metadata: {
            insurer: "suncorp",
            filename: "corpus/guides/suncorp/landlord/GUIDE.md",
          },
        },
      ],
    });

    const envWithMismatchedSearch: Env = {
      ...mockEnv,
      AI_SEARCH: {
        search: mismatchedSearchMock,
      },
    };

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.211" },
      body: JSON.stringify({
        query: "What happens if an unlicensed driver crashes my car under Allianz?",
        conversationId: "550e8400-e29b-41d4-a716-446655440011",
        filters: { insurer: "allianz" },
      }),
    });

    const res = await worker.fetch(req, envWithMismatchedSearch, mockCtx);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).not.toContain("wrong-insurer-chunk");
    expect(text.toLowerCase()).toContain("allianz");
  });
});
