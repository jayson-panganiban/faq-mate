import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import { App } from "../../src/frontend/App";
import type { GroundedChunk } from "../../src/types/chat";

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function expectFooterWarning() {
  const warnings = screen.getAllByTestId("statutory-gaw");
  expect(warnings).toHaveLength(1);
  expect(screen.getByRole("contentinfo")).toContainElement(warnings[0]);
  expect(warnings[0]).toHaveTextContent(STATUTORY_GAW);
}

const SAMPLE_CHUNK: GroundedChunk = {
  id: "suncorp-classic-home-pds#sec-1",
  relevanceScore: 0.94,
  content: "Flood cover is included as standard under Suncorp Classic Home Insurance policies.",
  source: {
    insurer: "Suncorp",
    product: "Classic Home",
    docType: "PDS",
    section: "Section 1 - Cover Details",
    effectiveDate: "2024-03-01",
  },
};

const SAMPLE_ALLIANZ_CHUNK: GroundedChunk = {
  id: "allianz-home-pds#sec-4",
  relevanceScore: 0.91,
  content:
    "Jewelry sub-limits are capped at $2,500 per item unless specifically listed on your policy schedule.",
  source: {
    insurer: "Allianz",
    product: "Home and Contents",
    docType: "PDS",
    section: "Section 4 - Valuable Items and Sub-limits",
    effectiveDate: "2024-01-15",
  },
};

describe("Full Application Assembly & E2E Integration (Spec 05 Ticket 7)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    sessionStorage.clear();
  });

  it("renders the initial view with empty state, starter prompts, and persistent regulatory header/footer", () => {
    render(<App />);

    // Brand and header telemetry presence
    expect(screen.getByRole("heading", { name: "FAQ-Mate" })).toBeInTheDocument();
    expect(screen.queryByTestId("cf-pop-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("rate-limit-badge")).toBeInTheDocument();
    expect(screen.getByTestId("reset-chat-button")).toBeInTheDocument();

    // Starter query prompt cards in empty state
    expect(screen.getByText(/What is Suncorp's flood definition\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Explain jewelry sub-limits under Allianz/i)).toBeInTheDocument();
    expect(screen.getByText(/Does NRMA cover rainwater run-off\?/i)).toBeInTheDocument();

    // Input bar ready
    expect(screen.getByTestId("chat-input-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("insurer-filter-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("send-button")).toBeDisabled();

    // Persistent Section 949A GAW in footer
    expectFooterWarning();
    fireEvent.click(screen.getByRole("button", { name: /view general advice warning/i }));
    expectFooterWarning();
    expect(screen.getByTestId("pii-assurance-badge")).toBeInTheDocument();
  });

  it("sends a query when clicking a starter prompt card", async () => {
    const mockSse = [
      `event: metadata\ndata: ${JSON.stringify({ latency_ms: 32, retrieved_chunks: [SAMPLE_CHUNK] })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: "Suncorp defines flood as the covering of normally dry land by water." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-RateLimit-Reset": "55",
          "cf-ray": "900abcde-SYD",
        }),
      })
    );

    render(<App />);

    const suncorpPrompt = screen.getByText(/What is Suncorp's flood definition\?/i);
    await act(async () => {
      fireEvent.click(suncorpPrompt);
    });

    // Check user message is rendered with query and Suncorp insurer badge
    await waitFor(() => {
      expect(
        within(screen.getByRole("log")).getByText("What is Suncorp's flood definition?")
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("insurer-badge")).toHaveTextContent("SUNCORP");

    // Check streaming response completes
    await waitFor(() => {
      expect(
        screen.getByText(/Suncorp defines flood as the covering of normally dry land by water/i)
      ).toBeInTheDocument();
    });

    // Verify fetch call payload
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"insurer":"SUNCORP"'),
      })
    );
  });

  it("handles a complete streaming Q&A flow with markdown tables, inline citation pills, and telemetry badges", async () => {
    const markdownResponse =
      "### Allianz Jewelry Sub-Limits Schedule\n\n" +
      "| Category | Limit per Item | Total Collection Limit |\n" +
      "| :--- | :--- | :--- |\n" +
      "| Rings & Necklaces | $2,500 | $10,000 |\n" +
      "| Watches | $2,000 | $5,000 |\n\n" +
      "Review operative terms in [Source: Allianz Home and Contents PDS, Section 4].";

    const mockSse = [
      `event: metadata\ndata: ${JSON.stringify({ latency_ms: 28, retrieved_chunks: [SAMPLE_ALLIANZ_CHUNK] })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: markdownResponse })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop", total_tokens: 45 })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "7",
          "X-RateLimit-Reset": "40",
          "cf-ray": "900fffff-MEL",
        }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    const sendButton = screen.getByTestId("send-button");

    fireEvent.change(input, {
      target: { value: "What are the jewelry limits under Allianz?" },
    });
    expect(sendButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(sendButton);
    });

    // Verify input clears immediately
    expect(input).toHaveValue("");

    // Verify markdown table rendered properly
    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Category")).toBeInTheDocument();
    expect(within(table).getByText("Rings & Necklaces")).toBeInTheDocument();
    expect(within(table).getByText("$2,500")).toBeInTheDocument();

    // Verify citation pill rendered
    const citationPill = screen.getByTestId("citation-pill");
    expect(citationPill).toBeInTheDocument();
    expect(citationPill).toHaveTextContent(/Allianz Home and Contents PDS/i);

    expectFooterWarning();

    // Verify telemetry header updated
    expect(screen.queryByTestId("retrieval-latency-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cf-pop-badge")).not.toBeInTheDocument();
  });

  it("opens CitationDrawer with matching chunk when citation pill is clicked, and closes on backdrop/escape", async () => {
    const mockSse = [
      `event: metadata\ndata: ${JSON.stringify({ latency_ms: 25, retrieved_chunks: [SAMPLE_CHUNK] })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: "Flood details: [Source: Suncorp Classic Home PDS, Section 1]." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-RateLimit-Reset": "60",
          "cf-ray": "90123456-SYD",
        }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, { target: { value: "Tell me about Suncorp flood" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("citation-pill")).toBeInTheDocument();
    });

    // Drawer should not be open initially
    expect(screen.queryByRole("dialog", { name: /policy sources/i })).not.toBeInTheDocument();

    // Click the citation pill
    const pill = screen.getByTestId("citation-pill");
    await act(async () => {
      fireEvent.click(pill);
    });

    // Drawer opens
    const drawer = await screen.findByRole("dialog", { name: /policy sources/i });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("Policy sources")).toBeInTheDocument();
    expect(within(drawer).getByText(/94% Match/i)).toBeInTheDocument();
    expect(within(drawer).getByText(SAMPLE_CHUNK.content)).toBeInTheDocument();

    // Close via backdrop click
    const backdrop = screen.getByTestId("citation-drawer-backdrop");
    await act(async () => {
      fireEvent.click(backdrop);
    });

    expect(screen.queryByRole("dialog", { name: /policy sources/i })).not.toBeInTheDocument();

    // Re-open and close via Escape key
    await act(async () => {
      fireEvent.click(screen.getByTestId("citation-pill"));
    });
    expect(screen.getByRole("dialog", { name: /policy sources/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog", { name: /policy sources/i })).not.toBeInTheDocument();
  });

  it("handles ASIC RG 244 advice boundary violation by displaying RefusalCard", async () => {
    const refusalMessage =
      "I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.";

    const mockSse = [
      `event: error\ndata: ${JSON.stringify({
        code: "ADVICE_BOUNDARY_VIOLATION",
        message: refusalMessage,
        reason: "Personal advice intent detected (budget recommendation request)",
      })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "8",
          "X-RateLimit-Reset": "50",
        }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, {
      target: { value: "I have a budget of $1,500/year, which car insurance should I buy?" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    // Verify RefusalCard is rendered
    await waitFor(() => {
      expect(screen.getByTestId("refusal-card")).toBeInTheDocument();
    });

    expectFooterWarning();
    const refusalCard = screen.getByTestId("refusal-card");
    expect(within(refusalCard).getByText("ASIC RG 244 Safe Harbor")).toBeInTheDocument();
    expect(
      within(refusalCard).getByText(/Personal Financial Advice Boundary/i)
    ).toBeInTheDocument();
    expect(within(refusalCard).getByText(refusalMessage)).toBeInTheDocument();
    expect(within(refusalCard).getByText(/Need Personal Advice\?/i)).toBeInTheDocument();
  });

  it("handles emergency prompt by immediately rendering EmergencyBanner with 000, 132 500, 1800 018 444", async () => {
    const emergencyMessage =
      "If you or your property are in immediate life danger, please immediately call Triple Zero (000). Automated insurance policy search is paused during active emergencies.";

    const mockSse = [
      `event: error\ndata: ${JSON.stringify({
        code: "EMERGENCY_INTERCEPTION",
        message: emergencyMessage,
        emergencyHotline: ["000", "132 500", "1800 018 444"],
      })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "8",
          "X-RateLimit-Reset": "45",
        }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, {
      target: { value: "My house is on fire right now, what does Suncorp cover?" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("emergency-banner")).toBeInTheDocument();
    });

    const banner = screen.getByTestId("emergency-banner");
    expect(within(banner).getByText("Immediate Danger Interception")).toBeInTheDocument();
    expect(within(banner).getByText(emergencyMessage)).toBeInTheDocument();

    // Verify dial links
    const zeroLink = within(banner).getByRole("link", { name: /triple zero/i });
    expect(zeroLink).toHaveAttribute("href", "tel:000");

    const sesLink = within(banner).getByRole("link", { name: /state emergency service/i });
    expect(sesLink).toHaveAttribute("href", "tel:132500");

    const disasterLink = within(banner).getByRole("link", { name: /disaster welfare services/i });
    expect(disasterLink).toHaveAttribute("href", "tel:1800018444");
  });

  it("handles HTTP 429 rate limit response and throttles input bar", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: new Headers({
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "45",
        }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, { target: { value: "Quick query 1" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    // Check throttled badge
    await waitFor(() => {
      expect(screen.getByText(/Rate Limited/i)).toBeInTheDocument();
    });

    // Check input is disabled
    expect(input).toBeDisabled();
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("passes selected insurer filter to the chat API", async () => {
    const mockSse = [
      `event: token\ndata: ${JSON.stringify({ text: "NRMA rainwater answer." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    render(<App />);

    fireEvent.click(screen.getByTestId("insurer-filter-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "NRMA" }));
    expect(screen.getByTestId("insurer-filter-trigger")).toHaveAccessibleDescription(
      "Selected insurer: NRMA"
    );

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, { target: { value: "Does NRMA cover rainwater run-off?" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toBe("/api/chat");
    const payload = JSON.parse(callArgs[1].body);
    expect(payload).toMatchObject({
      query: "Does NRMA cover rainwater run-off?",
      filters: { insurer: "NRMA" },
      turnstileToken: "cf-turnstile-verified",
    });
  });

  it("resets conversation and clears history when clicking New Chat button", async () => {
    const mockSse = [
      `event: token\ndata: ${JSON.stringify({ text: "Here is your policy answer." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, { target: { value: "Sample query" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Here is your policy answer.")).toBeInTheDocument();
    });

    // Click New Chat
    const resetButton = screen.getByTestId("reset-chat-button");
    await act(async () => {
      fireEvent.click(resetButton);
    });

    // Should return to empty state with starter prompts
    expect(screen.queryByText("Here is your policy answer.")).not.toBeInTheDocument();
    expect(screen.getByText(/What is Suncorp's flood definition\?/i)).toBeInTheDocument();
  });

  it("shows loading indicator during CONNECTING and METADATA_RECEIVED state before tokens arrive", async () => {
    let controllerRef!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controllerRef = c;
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    render(<App />);

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, { target: { value: "Waiting for answer" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    // In CONNECTING state before tokens, loading skeleton/indicator should be displayed
    await waitFor(() => {
      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
    });

    // Enqueue metadata
    await act(async () => {
      controllerRef.enqueue(
        new TextEncoder().encode(
          `event: metadata\ndata: ${JSON.stringify({ latency_ms: 30, retrieved_chunks: [SAMPLE_CHUNK] })}\n\n`
        )
      );
    });

    // Still in METADATA_RECEIVED (no tokens yet) -> loading indicator still present
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
    // Enqueue first token
    await act(async () => {
      controllerRef.enqueue(
        new TextEncoder().encode(
          `event: token\ndata: ${JSON.stringify({ text: "Here is your response text." })}\n\n`
        )
      );
    });

    // Once token arrives, loading indicator is replaced with the assistant message
    await waitFor(() => {
      expect(screen.queryByTestId("loading-indicator")).not.toBeInTheDocument();
      expect(screen.getByText("Here is your response text.")).toBeInTheDocument();
    });

    // Clean up stream
    await act(async () => {
      controllerRef.close();
    });
  });

  it("handles stream anchoring and scroll to bottom when user scrolls up", async () => {
    render(<App />);

    // Scrolling starter questions must not suggest jumping to a nonexistent conversation.
    const emptyFeed = screen.getByTestId("chat-scroll-container");
    Object.defineProperty(emptyFeed, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(emptyFeed, "clientHeight", { value: 300, configurable: true });
    fireEvent.scroll(emptyFeed);
    expect(screen.queryByTestId("scroll-to-bottom-button")).not.toBeInTheDocument();

    const mockSse = [
      `event: token\ndata: ${JSON.stringify({ text: "Long policy explanation..." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream(mockSse), {
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      })
    );

    const input = screen.getByTestId("chat-input-textarea");
    fireEvent.change(input, { target: { value: "Tell me about flood" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("Long policy explanation...")).toBeInTheDocument();
    });

    const scrollContainer = screen.getByTestId("chat-scroll-container");
    expect(scrollContainer).toBeInTheDocument();

    // Simulate user scrolling up (scrollHeight: 1000, clientHeight: 400, scrollTop: 200 -> distance: 400px > 80px)
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollContainer, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, "scrollTop", {
      value: 200,
      writable: true,
      configurable: true,
    });

    fireEvent.scroll(scrollContainer);

    // Scroll to bottom button appears
    await waitFor(() => {
      expect(screen.getByTestId("scroll-to-bottom-button")).toBeInTheDocument();
    });

    // Click scroll to bottom
    const scrollButton = screen.getByTestId("scroll-to-bottom-button");
    fireEvent.click(scrollButton);

    // Button disappears
    expect(screen.queryByTestId("scroll-to-bottom-button")).not.toBeInTheDocument();
  });

  it("persists chat session to sessionStorage and restores on mount", async () => {
    const initialSession = [
      {
        id: "msg-1",
        role: "user",
        content: "What is my excess for flood?",
        timestamp: Date.now() - 5000,
        insurer: "NRMA",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Standard excess is $500 as noted in your policy schedule.",
        timestamp: Date.now() - 4000,
      },
    ];

    sessionStorage.setItem("faq_mate_chat_session", JSON.stringify(initialSession));

    render(<App />);

    // Check that persisted messages are loaded
    expect(
      within(screen.getByRole("log")).getByText("What is my excess for flood?")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Standard excess is $500 as noted in your policy schedule.")
    ).toBeInTheDocument();
  });

  it("keeps one warning in the footer for a multi-turn conversation", () => {
    sessionStorage.setItem(
      "faq_mate_chat_session",
      JSON.stringify([
        { id: "u1", role: "user", content: "What is flood cover?", timestamp: Date.now() },
        {
          id: "a1",
          role: "assistant",
          content: `First answer.\n\n${STATUTORY_GAW}`,
          timestamp: Date.now(),
        },
        { id: "u2", role: "user", content: "What about excess?", timestamp: Date.now() },
        {
          id: "a2",
          role: "assistant",
          content: `Second answer.\n\n${STATUTORY_GAW}`,
          timestamp: Date.now(),
        },
      ])
    );
    render(<App />);
    expect(screen.getByText("First answer.")).toBeInTheDocument();
    expect(screen.getByText("Second answer.")).toBeInTheDocument();
    expectFooterWarning();
  });

  it("toggles between chat view and policy comparison view via comparison toggle (Spec 05 US-15)", () => {
    render(<App />);

    expect(screen.queryByTestId("policy-comparison-view")).not.toBeInTheDocument();

    // Click comparison toggle
    const toggleBtn = screen.getByTestId("comparison-toggle");
    fireEvent.click(toggleBtn);

    // Verify comparison matrix is rendered
    expect(screen.getByTestId("policy-comparison-view")).toBeInTheDocument();
    expectFooterWarning();
    expect(screen.getByText("Compare Policies")).toBeInTheDocument();

    // Return to chat through sidebar navigation
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.queryByTestId("policy-comparison-view")).not.toBeInTheDocument();
  });
});

describe("history deletion persistence", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });
  it("persists deletion and restores cleared history with undo", async () => {
    sessionStorage.setItem(
      "faq_mate_chat_session",
      JSON.stringify([
        { id: "u1", role: "user", content: "First question", timestamp: 1 },
        { id: "a1", role: "assistant", content: "First answer", timestamp: 2 },
        { id: "u2", role: "user", content: "Second question", timestamp: 3 },
        { id: "a2", role: "assistant", content: "Second answer", timestamp: 4 },
      ])
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("history-delete-u1"));
    await waitFor(() =>
      expect(
        JSON.parse(sessionStorage.getItem("faq_mate_chat_session") || "[]").map(
          (m: { id: string }) => m.id
        )
      ).toEqual(["u2", "a2"])
    );
    expect(screen.queryByText("First answer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all history"));
    expect(screen.getByText("Your questions will appear here.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Undo deletion"));
    expect(screen.getByText("Second answer")).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem("faq_mate_chat_session") || "[]")).toHaveLength(2)
    );
  });
});
