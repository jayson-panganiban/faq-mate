import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import { AppShell } from "../../src/frontend/components/AppShell";
import { InputBar } from "../../src/frontend/components/InputBar";
import { PiiAssuranceBadge } from "../../src/frontend/components/PiiAssuranceBadge";
import { RateLimitBadge } from "../../src/frontend/components/RateLimitBadge";
import type { RateLimitInfo } from "../../src/frontend/types/chat-ui";

describe("Telemetry Header, Abuse Shield & Input Bar (Ticket 6)", () => {
  describe("RateLimitBadge Component", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("displays remaining requests when remaining > 5 with green indicator", () => {
      const rateLimit: RateLimitInfo = { limit: 10, remaining: 9, resetSeconds: 60 };
      render(<RateLimitBadge rateLimit={rateLimit} />);

      const badge = screen.getByTestId("rate-limit-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("9/10 requests");

      const indicator = badge.querySelector("[data-status='green']");
      expect(indicator).toBeInTheDocument();
    });

    it("displays amber indicator when remaining requests is between 1 and 4", () => {
      const rateLimit: RateLimitInfo = { limit: 10, remaining: 3, resetSeconds: 45 };
      render(<RateLimitBadge rateLimit={rateLimit} />);

      const badge = screen.getByTestId("rate-limit-badge");
      expect(badge).toHaveTextContent("3/10 requests");

      const indicator = badge.querySelector("[data-status='amber']");
      expect(indicator).toBeInTheDocument();
    });

    it("displays red indicator when remaining requests is 0", () => {
      const rateLimit: RateLimitInfo = { limit: 10, remaining: 0, resetSeconds: 30 };
      render(<RateLimitBadge rateLimit={rateLimit} />);

      const badge = screen.getByTestId("rate-limit-badge");
      expect(badge).toBeInTheDocument();

      const indicator = badge.querySelector("[data-status='red']");
      expect(indicator).toBeInTheDocument();
    });

    it("displays countdown timer when throttled", () => {
      const rateLimit: RateLimitInfo = { limit: 10, remaining: 0, resetSeconds: 45 };
      render(<RateLimitBadge rateLimit={rateLimit} isThrottled={true} />);

      const badge = screen.getByTestId("rate-limit-badge");
      expect(badge).toHaveTextContent(/Rate Limited: Resets in 45s/i);

      // Advance timer by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(badge).toHaveTextContent(/Rate Limited: Resets in 40s/i);
    });

    it("has accessible role and attributes for assistive technology", () => {
      const rateLimit: RateLimitInfo = { limit: 10, remaining: 8, resetSeconds: 60 };
      render(<RateLimitBadge rateLimit={rateLimit} />);

      const badge = screen.getByRole("status");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("aria-label");
    });

    it("renders gracefully with default rate limit when no props are provided", () => {
      render(<RateLimitBadge />);

      const badge = screen.getByTestId("rate-limit-badge");
      expect(badge).toHaveTextContent("10/10 requests");
      expect(badge.querySelector("[data-status='green']")).toBeInTheDocument();
    });
  });

  describe("PiiAssuranceBadge Component", () => {
    it("renders client-side privacy protection badge asserting APP 3/11 compliance", () => {
      render(<PiiAssuranceBadge />);

      const badge = screen.getByTestId("pii-assurance-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Your privacy/i);
    });

    it("reveals disclosure explaining TFN, Medicare, and Card sanitization on interaction", async () => {
      render(<PiiAssuranceBadge />);

      const trigger = screen.getByTestId("pii-assurance-trigger");
      fireEvent.click(trigger);

      const popover = await screen.findByTestId("pii-assurance-popover");
      expect(popover).toBeInTheDocument();
      expect(popover).toHaveTextContent(/Tax File Number|TFN/i);
      expect(popover).toHaveTextContent(/Medicare/i);
      expect(popover).toHaveTextContent(/Card|PAN/i);
      expect(popover).toHaveTextContent(/Raw questions are not stored/i);
    });

    it("supports keyboard toggle via Enter or Space key", () => {
      render(<PiiAssuranceBadge />);

      const trigger = screen.getByTestId("pii-assurance-trigger");
      fireEvent.keyDown(trigger, { key: "Enter" });

      expect(screen.getByTestId("pii-assurance-popover")).toBeInTheDocument();

      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByTestId("pii-assurance-popover")).not.toBeInTheDocument();
    });

    it("closes popover when clicking outside the component", () => {
      render(
        <div>
          <div data-testid="outside-area">Outside</div>
          <PiiAssuranceBadge defaultExpanded={true} />
        </div>
      );

      expect(screen.getByTestId("pii-assurance-popover")).toBeInTheDocument();
      fireEvent.mouseDown(screen.getByTestId("outside-area"));
      expect(screen.queryByTestId("pii-assurance-popover")).not.toBeInTheDocument();
    });
  });

  describe("AppShell Component", () => {
    it("renders brand header with FAQ-Mate Edge RAG title", () => {
      render(
        <AppShell>
          <div data-testid="chat-content">Chat Content</div>
        </AppShell>
      );

      expect(screen.getByRole("heading", { name: "FAQ-Mate" })).toBeInTheDocument();
      expect(screen.getByTestId("chat-content")).toBeInTheDocument();
    });

    it("does not expose technical telemetry in the header", () => {
      render(
        <AppShell telemetry={{ popLocation: "SYD", latencyMs: 24, ttftMs: 185 }}>
          <div>Body</div>
        </AppShell>
      );
      expect(screen.queryByTestId("cf-pop-badge")).not.toBeInTheDocument();
      expect(screen.queryByTestId("retrieval-latency-badge")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ttft-badge")).not.toBeInTheDocument();
    });

    it("renders reset / new chat button and triggers onReset when clicked", () => {
      const handleReset = vi.fn();
      render(
        <AppShell onReset={handleReset}>
          <div>Body</div>
        </AppShell>
      );

      const resetButton = screen.getByTestId("reset-chat-button");
      expect(resetButton).toBeInTheDocument();
      fireEvent.click(resetButton);
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it("renders comparison toggle button when onToggleComparison is provided and fires callback", () => {
      const handleToggle = vi.fn();
      const { rerender } = render(
        <AppShell onToggleComparison={handleToggle} isComparisonMode={false}>
          <div>Body</div>
        </AppShell>
      );

      const toggleBtn = screen.getByTestId("comparison-toggle");
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent("Compare");

      fireEvent.click(toggleBtn);
      expect(handleToggle).toHaveBeenCalledTimes(1);

      rerender(
        <AppShell onToggleComparison={handleToggle} isComparisonMode={true}>
          <div>Body</div>
        </AppShell>
      );
      expect(screen.getByTestId("comparison-toggle")).toHaveAttribute("aria-pressed", "true");
    });

    it("renders persistent statutory Section 949A GAW and PII badge in footer", () => {
      render(
        <AppShell>
          <div>Body</div>
        </AppShell>
      );

      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();

      const gaw = screen.getByTestId("statutory-gaw");
      expect(gaw).toBeInTheDocument();
      expect(gaw).toHaveTextContent(STATUTORY_GAW);

      const piiBadge = screen.getByTestId("pii-assurance-badge");
      expect(piiBadge).toBeInTheDocument();
    });
  });

  it("expands and collapses the inline legal and privacy disclosures", () => {
    render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );
    const warning = screen.getByTestId("statutory-gaw");
    const legal = screen.getByRole("button", { name: /view general advice warning/i });
    expect(within(warning).getByText(STATUTORY_GAW)).toHaveClass("sr-only");
    fireEvent.click(legal);
    expect(screen.getByRole("button", { name: /hide general advice warning/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(within(warning).getByText(STATUTORY_GAW)).not.toHaveClass("sr-only");
    fireEvent.click(screen.getByRole("button", { name: /your privacy/i }));
    expect(screen.getByRole("region", { name: /privacy details/i })).toHaveTextContent(
      /removed in your browser/i
    );
    expect(within(warning).getByText(STATUTORY_GAW)).toHaveClass("sr-only");
    fireEvent.click(screen.getByRole("button", { name: /your privacy/i }));
    expect(screen.queryByRole("region", { name: /privacy details/i })).not.toBeInTheDocument();
  });

  describe("InputBar Component", () => {
    it("renders insurer selector with All Insurers, NRMA, SUNCORP, ALLIANZ, QBE, YOUI options", () => {
      render(<InputBar onSend={vi.fn()} isLoading={false} isThrottled={false} />);

      const select = screen.getByTestId("insurer-select") as unknown as HTMLSelectElement;
      expect(select).toBeInTheDocument();

      const options = Array.from(select.options).map((opt) => opt.value);
      expect(options).toContain("");
      expect(options).toContain("NRMA");
      expect(options).toContain("SUNCORP");
      expect(options).toContain("ALLIANZ");
      expect(options).toContain("QBE");
      expect(options).toContain("YOUI");
    });

    it("renders query textarea with accessible placeholder", () => {
      render(<InputBar onSend={vi.fn()} isLoading={false} isThrottled={false} />);

      const textarea = screen.getByTestId("chat-input-textarea");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute("placeholder");
    });

    it("submits the longest insurer option as a filter", () => {
      const onSend = vi.fn();
      render(<InputBar onSend={onSend} isLoading={false} isThrottled={false} />);
      const select = screen.getByTestId("insurer-select");
      expect(
        screen.getByRole("option", { name: "Southern Cross Travel Insurance" })
      ).toBeInTheDocument();
      fireEvent.change(select, { target: { value: "SCTI" } });
      fireEvent.change(screen.getByTestId("chat-input-textarea"), {
        target: { value: "What is covered?" },
      });
      fireEvent.click(screen.getByTestId("send-button"));
      expect(onSend).toHaveBeenCalledWith(
        "What is covered?",
        expect.objectContaining({ insurer: "SCTI" })
      );
    });

    it("renders real Turnstile container element when turnstileSiteKey is provided and window.turnstile exists", () => {
      const renderMock = vi.fn((_container, options) => {
        options.callback("mock-real-turnstile-token");
        return "widget-123";
      });
      const removeMock = vi.fn();

      (window as any).turnstile = {
        render: renderMock,
        remove: removeMock,
      };

      const handleSend = vi.fn();
      const { unmount } = render(
        <InputBar
          onSend={handleSend}
          isLoading={false}
          isThrottled={false}
          turnstileSiteKey="0x4AAAAAAAMockSiteKey"
        />
      );

      const turnstileContainer = screen.getByTestId("turnstile-widget");
      expect(turnstileContainer).toHaveAttribute("id", "cf-turnstile-container");
      expect(renderMock).toHaveBeenCalledWith(
        "#cf-turnstile-container",
        expect.objectContaining({ sitekey: "0x4AAAAAAAMockSiteKey" })
      );

      // Submit a query and verify the real turnstile token was included
      const textarea = screen.getByTestId("chat-input-textarea");
      fireEvent.change(textarea, { target: { value: "Test query" } });
      const sendButton = screen.getByTestId("send-button");
      fireEvent.click(sendButton);

      expect(handleSend).toHaveBeenCalledWith(
        "Test query",
        expect.objectContaining({ turnstileToken: "mock-real-turnstile-token" })
      );

      unmount();
      expect(removeMock).toHaveBeenCalledWith("widget-123");
      delete (window as any).turnstile;
    });

    it("disables send button when textarea is empty or whitespace only", () => {
      render(<InputBar onSend={vi.fn()} isLoading={false} isThrottled={false} />);

      const sendButton = screen.getByTestId("send-button");
      expect(sendButton).toBeDisabled();

      const textarea = screen.getByTestId("chat-input-textarea");
      fireEvent.change(textarea, { target: { value: "   " } });
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when text is entered and triggers onSend on submit", () => {
      const handleSend = vi.fn();
      render(<InputBar onSend={handleSend} isLoading={false} isThrottled={false} />);

      const textarea = screen.getByTestId("chat-input-textarea") as unknown as HTMLTextAreaElement;
      const select = screen.getByTestId("insurer-select") as unknown as HTMLSelectElement;
      const sendButton = screen.getByTestId("send-button");

      fireEvent.change(select, { target: { value: "SUNCORP" } });
      fireEvent.change(textarea, { target: { value: "Does Suncorp cover flood damage?" } });

      expect(sendButton).not.toBeDisabled();
      fireEvent.click(sendButton);

      expect(handleSend).toHaveBeenCalledWith(
        "Does Suncorp cover flood damage?",
        expect.objectContaining({
          insurer: "SUNCORP",
        })
      );

      // Textarea resets after submission
      expect(textarea.value).toBe("");
    });

    it("submits query when Enter key is pressed without Shift", () => {
      const handleSend = vi.fn();
      render(<InputBar onSend={handleSend} isLoading={false} isThrottled={false} />);

      const textarea = screen.getByTestId("chat-input-textarea");
      fireEvent.change(textarea, { target: { value: "What is NRMA accidental damage limit?" } });

      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

      expect(handleSend).toHaveBeenCalledWith(
        "What is NRMA accidental damage limit?",
        expect.any(Object)
      );
    });

    it("does not submit query when Shift+Enter is pressed (inserts newline)", () => {
      const handleSend = vi.fn();
      render(<InputBar onSend={handleSend} isLoading={false} isThrottled={false} />);

      const textarea = screen.getByTestId("chat-input-textarea");
      fireEvent.change(textarea, { target: { value: "Line 1" } });

      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

      expect(handleSend).not.toHaveBeenCalled();
    });

    it("does not submit Enter while an IME composition is active", () => {
      const onSend = vi.fn();
      render(<InputBar onSend={onSend} isLoading={false} isThrottled={false} />);
      const textarea = screen.getByTestId("chat-input-textarea");
      fireEvent.change(textarea, { target: { value: "Composition" } });
      fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
      expect(onSend).not.toHaveBeenCalled();
      expect(textarea).toHaveValue("Composition");
    });

    it("disables send button and input elements when isLoading is true", () => {
      render(<InputBar onSend={vi.fn()} isLoading={true} isThrottled={false} />);

      const textarea = screen.getByTestId("chat-input-textarea");
      const sendButton = screen.getByTestId("send-button");

      fireEvent.change(textarea, { target: { value: "Query while loading" } });
      expect(sendButton).toBeDisabled();
    });

    it("disables send button when isThrottled is true", () => {
      render(<InputBar onSend={vi.fn()} isLoading={false} isThrottled={true} />);

      const textarea = screen.getByTestId("chat-input-textarea");
      const sendButton = screen.getByTestId("send-button");

      fireEvent.change(textarea, { target: { value: "Query while throttled" } });
      expect(sendButton).toBeDisabled();
    });

    it("enforces mobile touch targets and iOS auto-zoom prevention classes", () => {
      render(<InputBar onSend={vi.fn()} isLoading={false} isThrottled={false} />);

      const textarea = screen.getByTestId("chat-input-textarea");
      const select = screen.getByTestId("insurer-select");
      const sendButton = screen.getByTestId("send-button");

      // Verify text-base on mobile to prevent iOS Safari auto-zoom (<16px triggers zoom)
      expect(textarea.className).toContain("text-base");
      expect(select.className).toContain("h-11");
      expect(select.className).toContain("w-11");
      expect(select).toHaveAccessibleDescription("Selected insurer: All Insurers (39)");

      // Verify 44x44px minimum tap target for finger tap
      expect(sendButton.className).toContain("min-h-[44px]");
      expect(sendButton.className).toContain("min-w-[44px]");
    });
  });
});
