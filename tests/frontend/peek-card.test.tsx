import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CitationPill } from "../../src/frontend/components/CitationPill";
import { PeekCard } from "../../src/frontend/components/PeekCard";
import type { GroundedChunk } from "../../src/types/chat";

const mockChunk: GroundedChunk = {
  id: "chunk-nrma-home-1",
  relevanceScore: 0.96,
  content:
    "We cover loss or damage caused by storm, rainwater run-off, or flood up to the sum insured.",
  source: {
    insurer: "NRMA",
    product: "Home Building Insurance",
    docType: "PDS",
    section: "Section 4: What is covered",
    clauseId: "4.1",
    effectiveDate: "2024-03-01",
  },
};

describe("PeekCard Component (EasyUI)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders trigger and displays peek popover upon hover", () => {
    render(
      <PeekCard content={<div>Peek content preview</div>}>
        <button type="button">Hover me</button>
      </PeekCard>
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
    expect(screen.queryByTestId("peek-card-popover")).not.toBeInTheDocument();

    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);

    // Before timer advances
    expect(screen.queryByTestId("peek-card-popover")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByTestId("peek-card-popover")).toBeInTheDocument();
    expect(screen.getByText("Peek content preview")).toBeInTheDocument();

    // Mouse leave triggers closing timer
    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByTestId("peek-card-popover")).not.toBeInTheDocument();
  });

  it("dismisses on Escape key press", () => {
    render(
      <PeekCard content={<div>Escapeable peek</div>}>
        <button type="button">Trigger</button>
      </PeekCard>
    );

    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId("peek-card-popover")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("peek-card-popover")).not.toBeInTheDocument();
  });
});

describe("CitationPill with PeekCard Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces clause excerpt, underwriter, and relevance score in peek popover on hover", () => {
    const onSelect = vi.fn();
    const onClick = vi.fn();

    render(<CitationPill index={1} chunk={mockChunk} onClick={onClick} onSelect={onSelect} />);

    const pill = screen.getByTestId("citation-pill");
    expect(pill).toBeInTheDocument();
    expect(screen.getByTestId("citation-index-badge")).toHaveTextContent("[1]");

    // Hover over the pill button directly
    fireEvent.mouseEnter(pill);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    const popover = screen.getByTestId("peek-card-popover");
    expect(popover).toBeInTheDocument();

    // Inspect content inside peek card
    expect(screen.getByText("NRMA")).toBeInTheDocument();
    expect(screen.getByText("PDS")).toBeInTheDocument();
    expect(screen.getByText("96% match")).toBeInTheDocument();
    expect(screen.getByText("Home Building Insurance")).toBeInTheDocument();
    expect(screen.getByText("Section 4: What is covered")).toBeInTheDocument();
    expect(screen.getByText(/We cover loss or damage caused by storm/)).toBeInTheDocument();
    expect(screen.getByText("Eff. 2024-03-01")).toBeInTheDocument();
    expect(screen.getByText("View in drawer")).toBeInTheDocument();

    // Clicking popover triggers drawer selection
    fireEvent.click(popover);
    expect(onClick).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("chunk-nrma-home-1");
  });
});
