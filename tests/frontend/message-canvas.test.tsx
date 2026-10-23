import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import React from "react";
import { UserMessage } from "../../src/frontend/components/UserMessage";
import { AssistantMessage } from "../../src/frontend/components/AssistantMessage";
import type { GroundedChunk } from "../../src/types/chat";
import { STATUTORY_GAW } from "../../src/constants/statutory";

describe("UserMessage Component (Ticket 5)", () => {
  it("renders user query text accurately", () => {
    render(
      <UserMessage query="What is the sub-limit for jewellery under Suncorp Classic Home?" />
    );

    expect(
      screen.getByText("What is the sub-limit for jewellery under Suncorp Classic Home?")
    ).toBeInTheDocument();
  });

  it("renders specific insurer badge when provided", () => {
    render(
      <UserMessage
        query="Does NRMA cover flood damage?"
        insurer="NRMA"
      />
    );

    expect(screen.getByText("NRMA")).toBeInTheDocument();
  });

  it("renders 'All Insurers' badge when insurer is undefined or empty", () => {
    const { rerender } = render(
      <UserMessage query="What is standard flood cover?" />
    );
    expect(screen.getByText("All Insurers")).toBeInTheDocument();

    rerender(<UserMessage query="What is standard flood cover?" insurer="" />);
    expect(screen.getByText("All Insurers")).toBeInTheDocument();
  });

  it("renders timestamp when provided", () => {
    render(
      <UserMessage
        query="Is storm surge covered?"
        insurer="Suncorp"
        timestamp="10:42 AM"
      />
    );

    expect(screen.getByText("10:42 AM")).toBeInTheDocument();
  });

  it("has accessible container semantics and user avatar icon", () => {
    render(<UserMessage query="Testing accessibility" />);

    const article = screen.getByRole("article", { name: /user message/i });
    expect(article).toBeInTheDocument();
    // User icon is rendered within the avatar container
    const avatar = article.querySelector('[data-testid="user-avatar"]');
    expect(avatar).toBeInTheDocument();
  });
});

describe("AssistantMessage Component (Ticket 5)", () => {
  const mockChunks: GroundedChunk[] = [
    {
      id: "chunk-suncorp-jewellery",
      relevanceScore: 0.95,
      content: "Jewellery and watches are covered up to a standard sub-limit of $2,500 per item.",
      source: {
        insurer: "SUNCORP",
        product: "Suncorp Classic Home",
        docType: "PDS",
        section: "Section 3: Sub-limits",
      },
    },
    {
      id: "chunk-nrma-flood",
      relevanceScore: 0.91,
      content: "Flood cover is included as an insured event.",
      source: {
        insurer: "NRMA",
        product: "NRMA Home Building",
        docType: "PDS",
        section: "Section 1: Insured Events",
      },
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Markdown Parsing & Formatting", () => {
    it("renders bold text and headers", () => {
      const message = "### Coverage Details\n\nUnder this policy, **accidental damage** is optional.";
      render(<AssistantMessage message={message} isStreaming={false} />);

      // Header rendered
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("Coverage Details");

      // Bold text rendered in strong tag
      const strong = screen.getByText("accidental damage");
      expect(strong.tagName.toLowerCase()).toBe("strong");
    });

    it("renders bullet lists and numbered lists", () => {
      const message =
        "The following insured events are standard:\n" +
        "- Fire and explosion\n" +
        "- Storm and rainwater\n" +
        "- Water discharge\n\n" +
        "Steps to lodge a claim:\n" +
        "1. Ensure life safety\n" +
        "2. Contact claims hotline";

      render(<AssistantMessage message={message} isStreaming={false} />);

      expect(screen.getByText("Fire and explosion")).toBeInTheDocument();
      expect(screen.getByText("Storm and rainwater")).toBeInTheDocument();
      expect(screen.getByText("Ensure life safety")).toBeInTheDocument();
      expect(screen.getByText("Contact claims hotline")).toBeInTheDocument();
    });
  });

  describe("Sub-limit Table Renderer (Spec 05 US-6)", () => {
    it("parses markdown sub-limit table into styled HTML table with tabular-nums", () => {
      const message =
        "Here are the policy sub-limits for contents:\n\n" +
        "| Item Category | Standard Sub-Limit | Optional Increase |\n" +
        "| :--- | :--- | :---: |\n" +
        "| Jewellery and watches | $2,500 per item | Yes |\n" +
        "| Collections & Works of art | $5,000 in total | No |\n" +
        "| Tools of trade | $1,500 total | Yes |\n\n" +
        "Please check your schedule for applicable limits.";

      render(<AssistantMessage message={message} isStreaming={false} />);

      // Verify table element
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Verify table header cells
      expect(screen.getByRole("columnheader", { name: /item category/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /standard sub-limit/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /optional increase/i })).toBeInTheDocument();

      // Verify table data rows
      expect(screen.getByText("Jewellery and watches")).toBeInTheDocument();
      expect(screen.getByText("$2,500 per item")).toBeInTheDocument();
      expect(screen.getByText("Collections & Works of art")).toBeInTheDocument();
      expect(screen.getByText("$5,000 in total")).toBeInTheDocument();

      // Check tabular-nums class for monospace numeric alignment
      const tbody = table.querySelector("tbody");
      expect(tbody).toHaveClass("tabular-nums");

      // Verify responsive container
      const container = table.closest('[data-testid="table-container"]');
      expect(container).toHaveClass("overflow-x-auto");
    });
  });

  describe("Negative Constraint & Silent PDS Callout (Spec 05 US-16)", () => {
    it("detects silent PDS statement (chimpanzee/unlisted hazard) and renders Silent PDS Notice callout", () => {
      const message =
        "The provided policy disclosure does not specify or cover accidental damage caused by pet chimpanzees or unlisted exotic animals.\n\n" +
        "Under Australian General Insurance standards, unlisted domestic hazards not named in the insured events schedule are not covered.";

      render(<AssistantMessage message={message} isStreaming={false} />);

      // Callout banner is rendered
      const notice = screen.getByTestId("silent-pds-notice");
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveAttribute("role", "alert");

      // Notice badge
      expect(within(notice).getByText(/silent pds notice/i)).toBeInTheDocument();
      expect(
        within(notice).getByText(/does not specify or cover accidental damage caused by pet chimpanzees/i)
      ).toBeInTheDocument();
    });

    it("does not render Silent PDS Notice when policy covers standard events", () => {
      const message = "Suncorp Classic Home includes flood cover as standard up to the sum insured.";
      render(<AssistantMessage message={message} isStreaming={false} />);

      expect(screen.queryByTestId("silent-pds-notice")).not.toBeInTheDocument();
    });
  });

  describe("Inline Citation Pill Rendering & Selection (Spec 05 US-4)", () => {
    it("renders CitationPill component for inline citation tokens and passes matching chunk", () => {
      const onSelectCitation = vi.fn();
      const message =
        "Jewellery has a sub-limit of $2,500 [Source: Suncorp Classic Home PDS, Section 3: Sub-limits].";

      render(
        <AssistantMessage
          message={message}
          chunks={mockChunks}
          onSelectCitation={onSelectCitation}
          isStreaming={false}
        />
      );

      // Citation pill rendered
      const citationButton = screen.getByRole("button", {
        name: /view citation source/i,
      });
      expect(citationButton).toBeInTheDocument();
      expect(citationButton).toHaveTextContent(/Suncorp Classic Home PDS, Section 3: Sub-limits/i);

      // Clicking invokes onSelectCitation with the matched chunk
      fireEvent.click(citationButton);
      expect(onSelectCitation).toHaveBeenCalledWith(mockChunks[0]);
    });

    it("falls back to passing citation string to onSelectCitation if no chunk matches", () => {
      const onSelectCitation = vi.fn();
      const message =
        "General exclusions apply [Source: Unknown Policy PDS, Section 99].";

      render(
        <AssistantMessage
          message={message}
          chunks={mockChunks}
          onSelectCitation={onSelectCitation}
          isStreaming={false}
        />
      );

      const citationButton = screen.getByRole("button", {
        name: /view citation source/i,
      });
      fireEvent.click(citationButton);
      expect(onSelectCitation).toHaveBeenCalledWith(
        "[Source: Unknown Policy PDS, Section 99]"
      );
    });
  });

  describe("Streaming State & Blinking Cursor", () => {
    it("renders streaming cursor when isStreaming is true", () => {
      render(
        <AssistantMessage
          message="Calculating sub-limits"
          isStreaming={true}
        />
      );

      const cursor = screen.getByTestId("streaming-cursor");
      expect(cursor).toBeInTheDocument();
      expect(cursor).toHaveClass("animate-pulse");

      // GAW should not be rendered while streaming
      expect(screen.queryByTestId("statutory-gaw")).not.toBeInTheDocument();
    });

    it("does not render streaming cursor when isStreaming is false", () => {
      render(
        <AssistantMessage
          message="Finished response."
          isStreaming={false}
        />
      );

      expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
    });
  });

  describe("Statutory Section 949A GAW Invariant", () => {
    it("renders StatutoryGaw banner at the bottom of completed assistant response", () => {
      render(
        <AssistantMessage
          message="Flood cover is standard."
          isStreaming={false}
        />
      );

      const gaw = screen.getByTestId("statutory-gaw");
      expect(gaw).toBeInTheDocument();
      expect(gaw).toHaveTextContent("Corporations Act 2001 (Cth) s.949A");
      expect(gaw).toHaveTextContent(STATUTORY_GAW);
    });

    it("deduplicates raw statutory GAW copy from message body and renders cleanly via StatutoryGaw", () => {
      const message = `Flood cover is standard.\n\n${STATUTORY_GAW}`;
      render(
        <AssistantMessage
          message={message}
          isStreaming={false}
        />
      );

      // Only one GAW component
      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      // The raw text does not appear twice in the document
      const fullText = document.body.textContent ?? "";
      const count = (fullText.match(/Corporations Act 2001/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe("Copy Answer Button", () => {
    it("copies response content to clipboard and shows temporary 'Copied!' state", async () => {
      const onCopy = vi.fn();
      const message = "Suncorp flood excess is $500.";

      render(
        <AssistantMessage
          message={message}
          isStreaming={false}
          onCopy={onCopy}
        />
      );

      const copyButton = screen.getByRole("button", { name: /copy answer/i });
      expect(copyButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(message);
      expect(onCopy).toHaveBeenCalled();

      // Visual checkmark feedback
      expect(screen.getByText(/copied/i)).toBeInTheDocument();

      // After timer expires, returns to default Copy label
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
    });
  });
});
