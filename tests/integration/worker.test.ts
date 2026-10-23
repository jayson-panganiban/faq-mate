import { describe, it, expect, vi } from "vitest";
import worker from "../../src/index";
import type { Env } from "../../src/types/bindings";

describe("Worker End-to-End Integration Suite", () => {
  const mockEnv: Env = {
    AI: {
      run: vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`data: {"text": "According to the PDS, flood is defined..."}\n\n`)
            );
            controller.close();
          },
        })
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

  it("3. POST /api/chat intercepts personal financial advice framing", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "I have a budget of $500. Which policy should I buy?",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("PERSONAL_ADVICE_REQUESTED");
    expect(text).toContain("cannot provide personal financial product advice");
    // Verify non-blocking telemetry recorded with advice flag
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });

  it("4. POST /api/chat streams factual response for compliant queries", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "What is the standard flood definition?",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("flood is defined");
  });
});
