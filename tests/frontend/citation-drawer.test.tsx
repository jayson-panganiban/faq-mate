import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import React, { useState } from "react";
import { CitationPill } from "../../src/frontend/components/CitationPill";
import { CitationDrawer } from "../../src/frontend/components/CitationDrawer";
import type { GroundedChunk } from "../../src/types/chat";

const mockChunk1: GroundedChunk = {
  id: "chunk-suncorp-01",
  relevanceScore: 0.96,
  content: "Flood cover is included as standard under Section 1 for loss or damage caused by flood.",
  source: {
    insurer: "SUNCORP",
    product: "Suncorp Classic Home",
    docType: "PDS",
    section: "Section 1",
    clauseId: "1.4.2",
    effectiveDate: "1 March 2024",
  },
};

const mockChunk2: GroundedChunk = {
  id: "chunk-nrma-02",
  relevanceScore: 0.88,
  content: "Accidental damage optional cover provides protection for unexpected damage caused by a sudden event.",
  source: {
    insurer: "NRMA",
    product: "NRMA Home Building",
    docType: "PDS",
    section: "Section 4",
    effectiveDate: "15 November 2023",
  },
};

const mockChunkWithoutOptional: GroundedChunk = {
  id: "chunk-qbe-03",
  relevanceScore: 0.75,
  content: "General exclusions apply to intentional damage.",
  source: {
    insurer: "QBE",
    product: "QBE Comprehensive Car",
    docType: "PDS",
    section: "General Exclusions",
  },
};

describe("CitationPill Component", () => {
  it("renders formatted pill text from a GroundedChunk", () => {
    render(<CitationPill chunk={mockChunk1} />);
    
    // Expect text containing product, docType, and section
    expect(screen.getByText(/Suncorp Classic Home PDS, Section 1/i)).toBeInTheDocument();
  });

  it("renders custom label when provided", () => {
    render(
      <CitationPill
        label="[Source: Suncorp Classic Home PDS, Section 1]"
        chunk={mockChunk1}
      />
    );
    expect(screen.getByText("[Source: Suncorp Classic Home PDS, Section 1]")).toBeInTheDocument();
  });

  it("renders an icon representing document or source", () => {
    const { container } = render(<CitationPill chunk={mockChunk1} />);
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("triggers onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<CitationPill chunk={mockChunk1} onClick={handleClick} />);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("triggers onSelect with chunkId when clicked", () => {
    const handleSelect = vi.fn();
    render(<CitationPill chunk={mockChunk1} onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(handleSelect).toHaveBeenCalledWith("chunk-suncorp-01");
  });

  it("is accessible with keyboard focus and button semantics", () => {
    render(<CitationPill chunk={mockChunk1} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toBeEnabled();
  });
});

describe("CitationDrawer Component", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onSelectChunk: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onSelectChunk = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render dialog content when isOpen is false", () => {
    render(
      <CitationDrawer
        isOpen={false}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with accessible attributes when isOpen is true", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    if (labelId) {
      expect(document.getElementById(labelId)).toBeInTheDocument();
    }
  });

  it("calls onClose when the close button is clicked", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop overlay is clicked", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    const backdrop = screen.getByTestId("citation-drawer-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders operative section breadcrumb", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    // Breadcrumb: product/docType > section inside the breadcrumb navigation
    const breadcrumbNav = screen.getByRole("navigation", { name: /operative section breadcrumb/i });
    expect(within(breadcrumbNav).getByText(/Suncorp Classic Home PDS/i)).toBeInTheDocument();
    expect(within(breadcrumbNav).getByText("Section 1")).toBeInTheDocument();
  });

  it("renders relevance confidence score pill", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    // 0.96 relevance score should show 96% Match or Score: 0.96
    expect(screen.getByText(/96% Match/i)).toBeInTheDocument();
  });

  it("renders chunk ID and docType badges", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    expect(screen.getByText(/chunk-suncorp-01/i)).toBeInTheDocument();
    expect(screen.getByText("PDS")).toBeInTheDocument();
  });

  it("renders operative markdown/text excerpt viewer", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    expect(screen.getByText(mockChunk1.content)).toBeInTheDocument();
  });

  it("renders effective date when present, and handles when absent", () => {
    const { rerender } = render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    expect(screen.getByText(/1 March 2024/i)).toBeInTheDocument();

    // Rerender with chunk without effectiveDate
    rerender(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunkWithoutOptional]}
      />
    );

    expect(screen.queryByText(/1 March 2024/i)).not.toBeInTheDocument();
    expect(screen.getByText(mockChunkWithoutOptional.content)).toBeInTheDocument();
  });

  it("supports switching between multiple chunks via tabs/list", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1, mockChunk2]}
        selectedChunkId="chunk-suncorp-01"
        onSelectChunk={onSelectChunk}
      />
    );

    // Initially displaying mockChunk1
    expect(screen.getByText(mockChunk1.content)).toBeInTheDocument();
    expect(screen.queryByText(mockChunk2.content)).not.toBeInTheDocument();

    // Find tab or button for chunk 2
    const chunk2Tab = screen.getByRole("tab", { name: /NRMA Home Building/i });
    fireEvent.click(chunk2Tab);

    expect(onSelectChunk).toHaveBeenCalledWith("chunk-nrma-02");
  });

  it("displays empty state when chunks array is empty", () => {
    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[]}
      />
    );

    expect(screen.getByText(/no citations available/i)).toBeInTheDocument();
  });

  it("copies excerpt to clipboard when copy button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(
      <CitationDrawer
        isOpen={true}
        onClose={onClose}
        chunks={[mockChunk1]}
      />
    );

    const copyBtn = screen.getByRole("button", { name: /copy/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith(mockChunk1.content);
  });
});

describe("Pill and Drawer Integration Flow", () => {
  function TestIntegration() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedChunkId, setSelectedChunkId] = useState<string>("chunk-suncorp-01");

    return (
      <div>
        <CitationPill
          chunk={mockChunk1}
          onClick={() => {
            setSelectedChunkId(mockChunk1.id);
            setIsOpen(true);
          }}
        />
        <CitationDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          chunks={[mockChunk1, mockChunk2]}
          selectedChunkId={selectedChunkId}
          onSelectChunk={setSelectedChunkId}
        />
      </div>
    );
  }

  it("opens citation drawer and displays chunk excerpt when pill is clicked", () => {
    render(<TestIntegration />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const pill = screen.getByRole("button", { name: /Suncorp Classic Home PDS/i });
    fireEvent.click(pill);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(mockChunk1.content)).toBeInTheDocument();
  });
});
