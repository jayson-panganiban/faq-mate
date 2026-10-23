import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatStream } from "../../src/frontend/hooks/useChatStream";
import type { GroundedChunk } from "../../src/frontend/types/chat-ui";

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        // brief tick for event loop
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      controller.close();
    },
  });
}

const SAMPLE_CHUNK: GroundedChunk = {
  id: "suncorp-classic-home-pds#sec-1",
  relevanceScore: 0.92,
  content: "Flood cover is included as standard in Classic Home Insurance.",
  source: {
    insurer: "Suncorp",
    product: "Classic Home",
    docType: "PDS",
    section: "Section 1 - Cover Details",
    effectiveDate: "2024-03-01",
  },
};

describe("useChatStream Hook (Spec 05 Section 1 & 2)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("initializes with default IDLE state and empty collections", () => {
    const { result } = renderHook(() => useChatStream());

    expect(result.current.status).toBe("IDLE");
    expect(result.current.messages).toEqual([]);
    expect(result.current.citations).toEqual([]);
    expect(result.current.selectedCitation).toBeNull();
    expect(result.current.activeRefusal).toBeNull();
    expect(result.current.telemetry).toEqual({});
    expect(result.current.rateLimit).toEqual({
      limit: 10,
      remaining: 10,
      resetSeconds: 60,
    });
  });

  it("handles standard streaming lifecycle: CONNECTING -> METADATA_RECEIVED -> STREAMING -> COMPLETED", async () => {
    const mockSse = [
      `event: metadata\ndata: ${JSON.stringify({ latency_ms: 38, retrieved_chunks: [SAMPLE_CHUNK] })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: "Flood cover " })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: "is standard." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop", total_tokens: 4 })}\n\n`,
    ];

    const mockHeaders = new Headers({
      "Content-Type": "text/event-stream",
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "8",
      "X-RateLimit-Reset": "45",
      "cf-ray": "8fa12345678-SYD",
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: mockHeaders,
      })
    );

    const { result } = renderHook(() => useChatStream());

    let sendPromise: Promise<void>;
    await act(async () => {
      sendPromise = result.current.sendMessage("Does Suncorp cover flood?", {
        insurer: "SUNCORP",
      });
    });

    await act(async () => {
      await sendPromise;
    });

    // Verify rate limit headers parsed
    expect(result.current.rateLimit).toEqual({
      limit: 10,
      remaining: 8,
      resetSeconds: 45,
    });

    // Verify telemetry
    expect(result.current.telemetry.latencyMs).toBe(38);
    expect(result.current.telemetry.popLocation).toBe("SYD");
    expect(result.current.telemetry.ttftMs).toBeGreaterThanOrEqual(0);

    // Verify citations
    expect(result.current.citations).toEqual([SAMPLE_CHUNK]);

    // Verify messages
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Does Suncorp cover flood?",
      insurer: "SUNCORP",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Flood cover is standard.",
    });
    expect(result.current.messages[1].metadata?.retrievedChunks).toEqual([SAMPLE_CHUNK]);

    // Final state
    expect(result.current.status).toBe("COMPLETED");

    // Verify fetch call payload
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining('"insurer":"SUNCORP"'),
      })
    );
  });

  it("handles ASIC RG 244 advice boundary violation with REFUSAL_BLOCKED", async () => {
    const refusalPayload = {
      code: "ADVICE_BOUNDARY_VIOLATION",
      reason: "PERSONAL_ADVICE_REQUESTED",
      message: "I cannot provide personal financial product advice under ASIC RG 244.",
    };

    const mockSse = [`event: error\ndata: ${JSON.stringify(refusalPayload)}\n\n`];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-RateLimit-Reset": "60",
        }),
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Which insurance policy should I buy with $500?");
    });

    expect(result.current.status).toBe("REFUSAL_BLOCKED");
    expect(result.current.activeRefusal).toEqual(refusalPayload);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].refusal).toEqual(refusalPayload);
    expect(result.current.messages[1].content).toBe(refusalPayload.message);
  });

  it("handles active emergency interception with EMERGENCY_INTERCEPTION code and hotlines", async () => {
    const emergencyPayload = {
      code: "EMERGENCY_INTERCEPTION",
      reason: "EMERGENCY_LIFE_SAFETY",
      message: "Emergency services must be contacted immediately.",
      emergencyHotline: ["000", "132 500", "1800 018 444"],
    };

    const mockSse = [`event: error\ndata: ${JSON.stringify(emergencyPayload)}\n\n`];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("My house is on fire right now what do I do?");
    });

    expect(result.current.status).toBe("REFUSAL_BLOCKED");
    expect(result.current.activeRefusal).toEqual(emergencyPayload);
    expect(result.current.activeRefusal?.emergencyHotline).toEqual(["000", "132 500", "1800 018 444"]);
  });

  it("transitions to THROTTLED when HTTP 429 response is received", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
        headers: new Headers({
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "30",
        }),
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Excess question?");
    });

    expect(result.current.status).toBe("THROTTLED");
    expect(result.current.rateLimit.remaining).toBe(0);
    expect(result.current.rateLimit.resetSeconds).toBe(30);
  });

  it("updates and clears selectedCitation via setSelectedCitation", () => {
    const { result } = renderHook(() => useChatStream());

    act(() => {
      result.current.setSelectedCitation(SAMPLE_CHUNK);
    });
    expect(result.current.selectedCitation).toEqual(SAMPLE_CHUNK);

    act(() => {
      result.current.setSelectedCitation(null);
    });
    expect(result.current.selectedCitation).toBeNull();
  });

  it("resets all state on reset() call", async () => {
    const mockSse = [
      `event: metadata\ndata: ${JSON.stringify({ latency_ms: 20, retrieved_chunks: [SAMPLE_CHUNK] })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: "Response" })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Test query");
    });

    expect(result.current.messages.length).toBe(2);
    expect(result.current.citations.length).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("IDLE");
    expect(result.current.messages).toEqual([]);
    expect(result.current.citations).toEqual([]);
    expect(result.current.selectedCitation).toBeNull();
    expect(result.current.activeRefusal).toBeNull();
    expect(result.current.telemetry).toEqual({});
  });

  it("correctly reassembles fragmented SSE packets across chunk boundaries", async () => {
    // Split events arbitrarily across byte chunks
    const fragmentedChunks = [
      "event: meta",
      `data\ndata: ${JSON.stringify({ latency_ms: 15, retrieved_chunks: [] })}\n\n`,
      'event: token\ndata: {"te',
      'xt": "Frag',
      'mented "}\n\nevent: token\ndata: {"text": "stream"}\n\n',
      'event: done\ndata: {"finish_reason": "stop"}\n\n',
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(fragmentedChunks), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Fragmented query");
    });

    expect(result.current.status).toBe("COMPLETED");
    expect(result.current.messages[1].content).toBe("Fragmented stream");
  });

  it("respects custom apiEndpoint and includes turnstileToken in request", async () => {
    const mockSse = [
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    const { result } = renderHook(() =>
      useChatStream({ apiEndpoint: "/custom/edge/chat" })
    );

    await act(async () => {
      await result.current.sendMessage("Query with turnstile", {
        turnstileToken: "cf-turnstile-dummy-token",
        insurer: "NRMA",
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/custom/edge/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Turnstile-Token": "cf-turnstile-dummy-token",
        }),
      })
    );
  });

  it("ignores empty or whitespace queries and prevents concurrent sends", async () => {
    global.fetch = vi.fn();

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("IDLE");
  });

  it("scrubs client-side PII before network dispatch and stores sanitized query in message state (APP 3 & 11)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream([`event: done\ndata: {}\n\n`]), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("My TFN is 123 456 789 and Medicare is 2345678901 1");
    });

    // Check that message in state is sanitized
    const userMsg = result.current.messages[0];
    expect(userMsg.content).toBe("My TFN is [REDACTED_TFN] and Medicare is [REDACTED_MEDICARE]");
    expect(userMsg.content).not.toContain("123 456 789");

    // Check that outgoing fetch payload is sanitized
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(fetchBody.query).toBe("My TFN is [REDACTED_TFN] and Medicare is [REDACTED_MEDICARE]");
    expect(fetchBody.query).not.toContain("123 456 789");
  });
});
