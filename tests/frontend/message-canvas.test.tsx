import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import { AssistantMessage } from "../../src/frontend/components/AssistantMessage";
import { UserMessage } from "../../src/frontend/components/UserMessage";
import type { GroundedChunk } from "../../src/types/chat";

describe("UserMessage Component (Ticket 5)", () => {
  it("renders user query text accurately", () => {
    render(<UserMessage query="What is the sub-limit for jewellery under Suncorp Classic Home?" />);

    expect(
      screen.getByText("What is the sub-limit for jewellery under Suncorp Classic Home?")
    ).toBeInTheDocument();
  });

  it("renders specific insurer badge when provided", () => {
    render(<UserMessage query="Does NRMA cover flood damage?" insurer="NRMA" />);

    expect(screen.getByText("NRMA")).toBeInTheDocument();
  });

  it("renders 'All Insurers' badge when insurer is undefined or empty", () => {
    const { rerender } = render(<UserMessage query="What is standard flood cover?" />);
    expect(screen.getByText("All Insurers")).toBeInTheDocument();

    rerender(<UserMessage query="What is standard flood cover?" insurer="" />);
    expect(screen.getByText("All Insurers")).toBeInTheDocument();
  });

  it("renders timestamp when provided", () => {
    render(<UserMessage query="Is storm surge covered?" insurer="Suncorp" timestamp="10:42 AM" />);

    expect(screen.getByText("10:42 AM")).toBeInTheDocument();
  });

  it("has accessible container semantics without an avatar", () => {
    render(<UserMessage query="Testing accessibility" />);

    const article = screen.getByRole("article", { name: /user message/i });
    expect(article).toBeInTheDocument();
    const avatar = article.querySelector('[data-testid="user-avatar"]');
    expect(avatar).not.toBeInTheDocument();
  });

  it("sanitizes raw PII in user query and displays sanitized indicator badge", () => {
    render(<UserMessage query="My TFN is 123 456 789 and Medicare is 2345678901 1" />);

    expect(screen.getByTestId("pii-sanitized-badge")).toBeInTheDocument();
    expect(screen.getByText(/Sanitized/i)).toBeInTheDocument();
    expect(screen.getByText(/\[REDACTED_TFN\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[REDACTED_MEDICARE\]/)).toBeInTheDocument();
    expect(screen.queryByText(/123 456 789/)).not.toBeInTheDocument();
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
      const message =
        "### Coverage Details\n\nUnder this policy, **accidental damage** is optional.";
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
        within(notice).getByText(
          /does not specify or cover accidental damage caused by pet chimpanzees/i
        )
      ).toBeInTheDocument();
    });

    it("does not render Silent PDS Notice when policy covers standard events", () => {
      const message =
        "Suncorp Classic Home includes flood cover as standard up to the sum insured.";
      render(<AssistantMessage message={message} isStreaming={false} />);

      expect(screen.queryByTestId("silent-pds-notice")).not.toBeInTheDocument();
    });

    it("does not render false-positive Silent PDS Notice on known contractual exclusions ('not covered' / 'does not cover')", () => {
      const message =
        "Under the NRMA Home & Contents Insurance PDS, Flood means the covering of normally dry land by water escaping a natural watercourse.\n\n" +
        "Critical Exclusions:\n" +
        "Actions of the sea, high tide, and storm surge are not covered under standard policy terms. Furthermore, the policy does not cover flood or bushfire damage during the first 72 hours of inception.";
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
      const message = "General exclusions apply [Source: Unknown Policy PDS, Section 99].";

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
      expect(onSelectCitation).toHaveBeenCalledWith("[Source: Unknown Policy PDS, Section 99]");
    });

    it("renders citation index badge on inline pill when matching chunk exists in chunks list", () => {
      const message =
        "Jewellery sub-limit is $2,500 [Source: Suncorp Classic Home PDS, Section 3: Sub-limits].";

      render(<AssistantMessage message={message} chunks={mockChunks} isStreaming={false} />);

      const indexBadge = screen.getByTestId("citation-index-badge");
      expect(indexBadge).toBeInTheDocument();
      expect(indexBadge).toHaveTextContent("1");
    });

    it("binds trailing full stop directly to the citation pill without floating space", () => {
      const message =
        "Flood is covered under standard policy terms [Source: Suncorp Classic Home PDS, Section 1: Insured Events] . Next sentence.";

      render(<AssistantMessage message={message} chunks={mockChunks} isStreaming={false} />);

      const citationButton = screen.getByTestId("citation-pill");
      expect(citationButton).toBeInTheDocument();

      // Parent wrapper has whitespace-nowrap and binds the dot directly
      const wrapper = citationButton.closest("span");
      expect(wrapper).toHaveClass("whitespace-nowrap");
      expect(wrapper).toHaveTextContent(/\./);
      expect(wrapper?.textContent).not.toMatch(/\s+\./);
    });
  });

  it("submits a related question when selected", () => {
    const onSelectFollowUp = vi.fn();
    render(
      <AssistantMessage
        message="Policy response."
        showGaw={false}
        suggestedFollowUps={["What is covered?"]}
        onSelectFollowUp={onSelectFollowUp}
      />
    );
    expect(screen.getByText("Related questions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What is covered?" }));
    expect(onSelectFollowUp).toHaveBeenCalledWith("What is covered?");
  });

  describe("Standalone provenance references", () => {
    it("keeps citation-only list entries readable instead of reducing them to inline markers", () => {
      const onSelectCitation = vi.fn();
      render(
        <AssistantMessage
          message={[
            "### 5. PROVENANCE CITATIONS, NO PERSONAL ADVICE & STATUTORY DISCLAIMER",
            "- [Source: Suncorp Classic Home PDS, Section 3: Sub-limits]",
            "- [Source: Insurance Contracts Act 1984, Section 99]",
            "- Official Source URL: https://www.suncorp.com.au/home-contents-pds.pdf",
            "-",
          ].join("\n")}
          chunks={mockChunks}
          showGaw={false}
          onSelectCitation={onSelectCitation}
        />
      );
      const article = screen.getByRole("article", { name: "Assistant message" });
      const referenceList = within(article)
        .getByText(/Official Source URL:/)
        .closest("ul");
      if (!referenceList) throw new Error("Expected provenance reference list");
      const known = within(referenceList).getByRole("button", {
        name: "View source: Suncorp Classic Home PDS, Section 3: Sub-limits",
      });
      expect(known).toHaveTextContent(/^Suncorp Classic Home PDS$/);
      const unknown = within(referenceList).getByRole("button", {
        name: "View source: Insurance Contracts Act 1984, Section 99",
      });
      expect(unknown).toHaveTextContent(/^Insurance Contracts Act 1984, Section 99$/);
      fireEvent.click(known);
      expect(onSelectCitation).toHaveBeenCalledWith(mockChunks[0]);
      fireEvent.click(unknown);
      expect(onSelectCitation).toHaveBeenLastCalledWith(
        "[Source: Insurance Contracts Act 1984, Section 99]"
      );
      expect(
        within(article).getByRole("link", { name: "Suncorp Home & Contents PDS" })
      ).toBeInTheDocument();
      expect(within(article).queryByText(/^[-*+]$/)).not.toBeInTheDocument();
    });

    it("keeps citations embedded in prose compact and preserves the full sentence", () => {
      render(
        <AssistantMessage
          message="The policy defines flood in accordance with [Source: Suncorp Classic Home PDS, Section 3: Sub-limits]."
          chunks={mockChunks}
          showGaw={false}
        />
      );
      const marker = screen.getByRole("button", {
        name: "View citation source: Suncorp Classic Home PDS, Section 3: Sub-limits",
      });
      expect(marker.querySelector('[data-testid="citation-index-badge"]')).toHaveTextContent("[1]");
      expect(screen.getByText(/The policy defines flood in accordance with/)).toHaveTextContent(
        /accordance with.*\./
      );
    });
  });

  describe("Descriptive links", () => {
    it("renders bare document URLs and punctuation with their exact destination", () => {
      const url = "https://www.suncorp.com.au/docs/home-and-contents-pds.pdf?version=1&x=2";
      render(<AssistantMessage message={`Read ${url}.`} showGaw={false} />);
      expect(screen.getByRole("link", { name: "Suncorp Home & Contents PDS" })).toHaveAttribute(
        "href",
        url
      );
      expect(screen.getByText(/Read/).textContent).toContain("PDS.");
      expect(screen.getByText(/Read/).textContent).not.toContain(url);
    });

    it("recognizes markdown links before citations and renders links in tables", () => {
      const message =
        "**Cover** [Source: Suncorp Classic Home PDS, Section 3: Sub-limits] and [Suncorp PDS](https://suncorp.com.au/policy).\n\n| Document | Details |\n| --- | --- |\n| [Policy PDS](https://example.com/pds) | <https://example.com/doc> |";
      render(<AssistantMessage message={message} chunks={mockChunks} showGaw={false} />);
      expect(screen.getByRole("link", { name: "Suncorp PDS" })).toHaveAttribute(
        "href",
        "https://suncorp.com.au/policy"
      );
      expect(screen.getByRole("link", { name: "Policy PDS" })).toHaveAttribute(
        "href",
        "https://example.com/pds"
      );
      expect(screen.getByRole("link", { name: "example.com document" })).toHaveAttribute(
        "href",
        "https://example.com/doc"
      );
      expect(screen.getByTestId("citation-index-badge")).toHaveTextContent("[1]");
    });

    it("preserves emphasis around links and underscores in URLs", () => {
      const first = "https://www.suncorp.com.au/home-contents-pds.pdf";
      const second = "https://www.suncorp.com.au/home_contents_pds.pdf";
      render(
        <AssistantMessage
          message={`**[Suncorp Home & Contents PDS](${first})** and *${second}*.`}
          showGaw={false}
        />
      );
      const links = screen.getAllByRole("link", { name: "Suncorp Home & Contents PDS" });
      expect(links[0]).toHaveAttribute("href", first);
      expect(links[0].closest("strong")).toBeInTheDocument();
      expect(links[1]).toHaveAttribute("href", second);
      expect(links[1].closest("em")).toBeInTheDocument();
      expect(links[1].parentElement?.parentElement?.textContent).toContain("PDS.");
    });

    it("keeps document types accurate and replaces URL-containing link labels", () => {
      const url = "https://www.suncorp.com.au/home-contents-tmd.pdf";
      render(<AssistantMessage message={`[Read ${url}](${url})`} showGaw={false} />);
      const link = screen.getByRole("link", { name: "Suncorp Home & Contents TMD" });
      expect(link).toHaveAttribute("href", url);
      expect(link.textContent).not.toContain("https://");
    });

    it("rejects malformed explicit HTTP destinations", () => {
      render(<AssistantMessage message="[PDS](https://[invalid)" showGaw={false} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("does not turn unsafe destinations into links or mislabel lookalike hosts", () => {
      render(
        <AssistantMessage
          message="[PDS](javascript:alert(1)) https://suncorp.evil.example/home-contents-pds.pdf"
          showGaw={false}
        />
      );
      expect(screen.queryByRole("link", { name: "PDS" })).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "suncorp.evil.example document" })
      ).toBeInTheDocument();
    });
  });

  describe("Plain source list", () => {
    it("renders document links and excerpts without icons, counters or metadata badges", () => {
      const onSelectCitation = vi.fn();
      render(
        <AssistantMessage
          message="Policy response body."
          chunks={mockChunks}
          onSelectCitation={onSelectCitation}
          isStreaming={false}
        />
      );
      const shelf = screen.getByRole("region", { name: "Sources" });
      expect(within(shelf).getByRole("heading", { name: "Sources" })).toBeInTheDocument();
      expect(within(shelf).getAllByRole("listitem")).toHaveLength(2);
      expect(shelf.querySelector("svg")).not.toBeInTheDocument();
      expect(screen.queryByTestId("sources-count-badge")).not.toBeInTheDocument();
      expect(within(shelf).queryByText(/% match/)).not.toBeInTheDocument();
      expect(within(shelf).queryByText("SUNCORP")).not.toBeInTheDocument();
      const first = within(shelf).getByRole("button", {
        name: "View source: Suncorp Classic Home PDS, Section 3: Sub-limits",
      });
      expect(first).toHaveTextContent(mockChunks[0].content);
      fireEvent.click(first);
      expect(onSelectCitation).toHaveBeenCalledWith(mockChunks[0]);
      fireEvent.click(
        within(shelf).getByRole("button", {
          name: "View source: NRMA Home Building PDS, Section 1: Insured Events",
        })
      );
      expect(onSelectCitation).toHaveBeenLastCalledWith(mockChunks[1]);
    });

    it("turns Markdown snippets into readable plain text while keeping the original source intact", () => {
      const onSelectCitation = vi.fn();
      const chunk = {
        ...mockChunks[0],
        content:
          "### Cover details ###\n**Storm damage** and _glass_ terms. [Read the policy](https://example.com/policy).\n- Check `limits`.",
      };
      render(
        <AssistantMessage
          message="Answer."
          chunks={[chunk]}
          showGaw={false}
          onSelectCitation={onSelectCitation}
        />
      );
      const shelf = screen.getByRole("region", { name: "Sources" });
      expect(
        within(shelf).getByText(
          "Cover details Storm damage and glass terms. Read the policy. Check limits."
        )
      ).toBeInTheDocument();
      expect(shelf.textContent).not.toMatch(/###|\*\*|https:\/\//);
      fireEvent.click(within(shelf).getByRole("button"));
      expect(onSelectCitation).toHaveBeenCalledWith(chunk);
    });

    it("does not render Sources Shelf when chunks is undefined or empty", () => {
      const { rerender } = render(
        <AssistantMessage message="Policy response body without chunks." isStreaming={false} />
      );
      expect(screen.queryByTestId("sources-shelf")).not.toBeInTheDocument();

      rerender(
        <AssistantMessage
          message="Policy response with empty chunks."
          chunks={[]}
          isStreaming={false}
        />
      );
      expect(screen.queryByTestId("sources-shelf")).not.toBeInTheDocument();
    });
  });

  describe("Streaming State & Blinking Cursor", () => {
    it("renders streaming cursor when isStreaming is true", () => {
      render(<AssistantMessage message="Calculating sub-limits" isStreaming={true} />);

      const cursor = screen.getByTestId("streaming-cursor");
      expect(cursor).toBeInTheDocument();
      expect(cursor).toHaveClass("animate-pulse");

      // GAW should not be rendered while streaming
      expect(screen.queryByTestId("statutory-gaw")).not.toBeInTheDocument();
    });

    it("does not render streaming cursor when isStreaming is false", () => {
      render(<AssistantMessage message="Finished response." isStreaming={false} />);

      expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
    });
  });

  describe("Statutory Section 949A GAW Invariant", () => {
    it("renders StatutoryGaw banner at the bottom of completed assistant response", () => {
      render(<AssistantMessage message="Flood cover is standard." isStreaming={false} />);

      const gaw = screen.getByTestId("statutory-gaw");
      expect(gaw).toBeInTheDocument();
      expect(gaw).toHaveTextContent("Corporations Act 2001 (Cth) s.949A");
      expect(gaw).toHaveTextContent(STATUTORY_GAW);
    });

    it("deduplicates raw statutory GAW copy from message body and renders cleanly via StatutoryGaw", () => {
      const message = `Flood cover is standard.\n\n${STATUTORY_GAW}`;
      render(<AssistantMessage message={message} isStreaming={false} />);

      // Only one GAW component
      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      // The raw text does not appear twice in the document
      const fullText = document.body.textContent ?? "";
      const corpActCount = (fullText.match(/Corporations Act 2001/g) || []).length;
      expect(corpActCount).toBe(1);
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
    });

    it("deduplicates raw GAW when formatted without emoji", () => {
      const message =
        "Flood cover is standard.\n\nGeneral Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent professional advice.";
      render(<AssistantMessage message={message} isStreaming={false} />);

      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      const fullText = document.body.textContent ?? "";
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
    });

    it("deduplicates raw GAW with bold heading or markdown formatting", () => {
      const message =
        "Flood cover is standard.\n\n### General Advice Warning\nThis information is general product information only and does not take into account your personal objectives, financial situation, or needs.";
      render(<AssistantMessage message={message} isStreaming={false} />);

      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      const fullText = document.body.textContent ?? "";
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
    });

    it("deduplicates raw GAW preceded by horizontal rules without leaving trailing divider syntax", () => {
      const message = `Flood cover is standard.\n\n---\n\n${STATUTORY_GAW}`;
      const { container } = render(<AssistantMessage message={message} isStreaming={false} />);

      const fullText = document.body.textContent ?? "";
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);

      // Verify no dangling markdown hr or --- remains in body prose
      expect(container.querySelector("hr")).toBeNull();
      expect(fullText).not.toContain("---");
    });

    it("deduplicates repeated GAW occurrences at the end of the response", () => {
      const message = `Flood cover is standard.\n\n${STATUTORY_GAW}\n\n${STATUTORY_GAW}`;
      render(<AssistantMessage message={message} isStreaming={false} />);

      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      const fullText = document.body.textContent ?? "";
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
    });

    it("deduplicates bulleted or section-5 GAW items inside the markdown block parser while preserving citations", () => {
      const message =
        "### 1. Direct Definition\nFlood means the covering of normally dry land by water.\n\n" +
        "### 5. Provenance Citations & Statutory Disclaimer\n" +
        "- [Source: NRMA Home & Contents Insurance PDS (Definitions — Flood)]\n" +
        `- ${STATUTORY_GAW}`;
      render(<AssistantMessage message={message} isStreaming={false} />);

      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      const fullText = document.body.textContent ?? "";
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
      expect(fullText).toContain("NRMA Home & Contents Insurance PDS");
    });

    it("preserves informational explanations of General Advice Warning in message body while deduplicating trailing statutory disclaimer", () => {
      const message = `Under Section 949A of the Corporations Act 2001 (Cth), a General Advice Warning is required whenever general financial advice is given.\n\n[Source: ASIC RG 244, Section B]\n\n${STATUTORY_GAW}`;
      render(<AssistantMessage message={message} isStreaming={false} />);

      const gaws = screen.getAllByTestId("statutory-gaw");
      expect(gaws).toHaveLength(1);

      const fullText = document.body.textContent ?? "";
      // Explanatory body text is preserved
      expect(fullText).toContain(
        "Under Section 949A of the Corporations Act 2001 (Cth), a General Advice Warning is required"
      );
      // Corporations Act appears twice: once in the educational prose, once in <StatutoryGaw />
      const corpActCount = (fullText.match(/Corporations Act 2001/g) || []).length;
      expect(corpActCount).toBe(2);
      // General Advice Warning appears twice: once in educational prose ("a General Advice Warning is required"), once in <StatutoryGaw />
      const gawCount = (fullText.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(2);
    });
  });

  describe("Copy Answer Button", () => {
    it("copies response content to clipboard and shows temporary 'Copied!' state", async () => {
      const onCopy = vi.fn();
      const message = "Suncorp flood excess is $500.";

      render(<AssistantMessage message={message} isStreaming={false} onCopy={onCopy} />);

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

  describe("Fenced Code Block Support", () => {
    it("renders fenced code block with language badge, line numbers, and copy action", async () => {
      const codeSnippet = "```typescript\nconst excess = 500;\nconst isCovered = true;\n```";
      render(<AssistantMessage message={codeSnippet} isStreaming={false} />);

      const codeBlock = screen.getByTestId("code-block");
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock).toHaveTextContent("typescript");
      expect(codeBlock).toHaveTextContent("const excess = 500;");
      expect(codeBlock).toHaveTextContent("const isCovered = true;");

      const copyCodeBtn = screen.getByRole("button", { name: /copy code block/i });
      expect(copyCodeBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(copyCodeBtn);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "const excess = 500;\nconst isCovered = true;"
      );
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });

  describe("Ordered List Number Sequencing", () => {
    it("preserves sequential 1..5 numbering across blank lines, sub-headings, and tables", () => {
      const markdownWithInterruptedList = [
        "1. **DIRECT DEFINITION**: First point.",
        "",
        "2. **RELATED EVENT & PRODUCT LINE DEMARCATION**: Second point.",
        "",
        "### Summary Table",
        "| Type | Description |",
        "| --- | --- |",
        "| A | Alpha |",
        "",
        "3. **CRITICAL EXCLUSIONS**: Third point.",
        "",
        "4. **CERTIFICATE OF INSURANCE**: Fourth point.",
        "",
        "5. **PROVENANCE CITATIONS**: Fifth point.",
      ].join("\n");

      const { container } = render(
        <AssistantMessage message={markdownWithInterruptedList} isStreaming={false} />
      );

      const listItems = Array.from(container.querySelectorAll("ol > li"));
      expect(listItems).toHaveLength(5);
      expect(listItems.map((li) => li.getAttribute("value"))).toEqual(["1", "2", "3", "4", "5"]);

      const orderedLists = Array.from(container.querySelectorAll("ol"));
      expect(orderedLists).toHaveLength(2);
      expect(orderedLists[0].getAttribute("start")).toBe("1");
      expect(orderedLists[1].getAttribute("start")).toBe("3");
    });
  });

  describe("Assistant Message Feedback Affordance (Spec 05 G6 & ui-craft ai-chat)", () => {
    it("renders helpful and unhelpful feedback controls and fires onFeedback callback", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <AssistantMessage
          message="Flood is defined as the covering of normally dry land."
          isStreaming={false}
          onFeedback={onFeedback}
        />
      );

      const helpfulBtn = within(container).getByRole("button", { name: /^helpful response$/i });
      const unhelpfulBtn = within(container).getByRole("button", { name: /^unhelpful response$/i });

      expect(helpfulBtn).toBeInTheDocument();
      expect(unhelpfulBtn).toBeInTheDocument();

      fireEvent.click(helpfulBtn);
      expect(onFeedback).toHaveBeenCalledWith("positive");

      fireEvent.click(unhelpfulBtn);
      expect(onFeedback).toHaveBeenCalledWith("negative");
    });

    it("hides feedback controls while actively streaming", () => {
      const { container } = render(
        <AssistantMessage message="Generating policy explanation..." isStreaming={true} />
      );

      expect(
        within(container).queryByTestId("assistant-feedback-controls")
      ).not.toBeInTheDocument();
    });
  });
});
