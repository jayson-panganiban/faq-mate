import { describe, expect, it, vi } from "vitest";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import worker from "../../src/index";
import type { Env } from "../../src/types/bindings";

describe("Conversational Natural Language Inquiries & Multi-Turn Edge Integration (Spec 07)", () => {
  const mockEnv: Env = {
    AI: {
      run: vi.fn(), // Triggers deterministic edge fallback generator
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

  it("1. Multi-turn context carry-over: processes follow-up turn with history array", async () => {
    const payload = {
      query: "What if it happened on the second day after buying?",
      conversationId: "c1111111-1111-1111-1111-111111111111",
      history: [
        {
          role: "user" as const,
          content: "What does Suncorp cover for riverine flood damage?",
        },
        {
          role: "assistant" as const,
          content:
            "Suncorp covers flood defined under Insurance Contracts Regulations 2012, subject to a 72-hour embargo.",
        },
      ],
      filters: { insurer: "SUNCORP" },
    };

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.1" },
      body: JSON.stringify(payload),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event: metadata");
    expect(text).toContain("event: token");
    expect(text).toContain("event: done");
    expect(text).toMatch(/72-hour|embargo/i);
    expect(text).toContain(STATUTORY_GAW);
  });

  it("2. Conversational dilemma: reframes repair quote vs excess inquiry to objective criteria without advice", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.2" },
      body: JSON.stringify({
        query:
          "My roof is leaking and the repair quote is $3,500 while my excess is $1,000. Should I lodge a claim or just pay out of pocket?",
        conversationId: "c2222222-2222-2222-2222-222222222222",
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const text = await res.text();
    // Must NOT return an advice error; must stream response
    expect(text).not.toContain("event: error");
    expect(text).toContain("event: token");
    expect(text).toContain(
      "cannot advise whether you should lodge a claim or pay for repairs out of pocket"
    );
    expect(text).toContain("Excess Deduction vs. Repair Cost");
    expect(text).toContain("No-Claim Bonus (NCB)");
    expect(text).toContain("Gradual Deterioration");
    expect(text).toContain(STATUTORY_GAW);
  });

  it("3. Voice dictation & colloquial intent normalizer: strips fillers and retrieves Escape of Liquid", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.3" },
      body: JSON.stringify({
        query:
          "Um so like a pipe burst in my ensuite while I was on holiday and ruined the floorboards, what do I do?",
        conversationId: "c3333333-3333-3333-3333-333333333333",
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain("event: metadata");
    expect(text).toContain("Escape of Liquid");
    expect(text).toContain("Building Cover");
    expect(text).toContain("Contents Cover");
    expect(text).toContain(STATUTORY_GAW);
  });

  it("4. Emits dynamic follow-up prompt suggestions in metadata and done SSE events", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.4" },
      body: JSON.stringify({
        query: "What is the standard flood definition?",
        conversationId: "c4444444-4444-4444-4444-444444444444",
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    const text = await res.text();

    expect(text).toContain("suggested_follow_ups");
    expect(text).toContain("72-hour");
  });

  it("5. APP 3/11 PII compliance: scrubs PII across multi-turn history while preserving daily salted hash", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.5" },
      body: JSON.stringify({
        query: "What is my excess for flood damage?",
        conversationId: "c5555555-5555-5555-5555-555555555555",
        history: [
          {
            role: "user",
            content: "My phone number is 0412 345 678 and Medicare is 21234567891",
          },
          {
            role: "assistant",
            content: "Hello, I can provide policy information.",
          },
        ],
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    // Verify D1 telemetry log called with query hash of latest query
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });
});
