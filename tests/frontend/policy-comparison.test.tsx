import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PolicyComparisonView } from "../../src/frontend/components/PolicyComparisonView";
import type { GroundedChunk } from "../../src/frontend/types/chat-ui";

describe("PolicyComparisonView Component (Spec 05 User Story 15)", () => {
  const mockChunks: GroundedChunk[] = [
    {
      id: "chunk-suncorp-flood",
      relevanceScore: 0.95,
      content:
        "Suncorp flood covers the covering of normally dry land by water escaping from a lake, river, or creek.",
      source: {
        insurer: "SUNCORP",
        product: "Suncorp Classic Home",
        docType: "PDS",
        section: "Section 2: Flood",
      },
    },
    {
      id: "chunk-nrma-flood",
      relevanceScore: 0.92,
      content: "NRMA covers flood damage under standard building cover.",
      source: {
        insurer: "NRMA",
        product: "NRMA Home Building",
        docType: "PDS",
        section: "Section 1: Insured Events",
      },
    },
  ];

  it("renders comparison view header and insurer selectors", () => {
    render(<PolicyComparisonView />);

    expect(screen.getByTestId("policy-comparison-view")).toBeInTheDocument();
    expect(screen.getByText("Compare Policies")).toBeInTheDocument();
    expect(screen.getByTestId("insurer-a-select")).toBeInTheDocument();
    expect(screen.getByTestId("insurer-b-select")).toBeInTheDocument();
  });

  it("renders stacked coverage comparisons", () => {
    render(<PolicyComparisonView />);

    expect(screen.getByText("Flood Definition")).toBeInTheDocument();
    expect(screen.getByText("Jewellery & Watches Sub-limit")).toBeInTheDocument();
    expect(screen.getByText("Accidental Damage")).toBeInTheDocument();
    expect(screen.getByText("Rainwater Run-off & Storm Surge")).toBeInTheDocument();
  });

  it("updates insurer labels and terms in each comparison when the selection changes", () => {
    render(<PolicyComparisonView />);

    const selectB = screen.getByTestId("insurer-b-select");
    fireEvent.change(selectB, { target: { value: "ALLIANZ" } });
    expect(
      within(screen.getByRole("region", { name: "Flood Definition" })).getByText("Allianz")
    ).toBeInTheDocument();

    fireEvent.change(selectB, { target: { value: "AAMI" } });
    expect(
      within(screen.getByRole("region", { name: "Flood Definition" })).getByText("AAMI")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/AAI Limited/i).length).toBeGreaterThan(0);
  });

  it("renders retrieved session disclosures when matching chunks are provided", () => {
    const handleSelectCitation = vi.fn();
    render(<PolicyComparisonView chunks={mockChunks} onSelectCitation={handleSelectCitation} />);

    expect(screen.getByText(/Policy sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Suncorp sources/i)).toBeInTheDocument();
    expect(screen.getByText(/NRMA sources/i)).toBeInTheDocument();

    // Click read source
    const inspectButtons = screen.getAllByRole("button", { name: /read source/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);
    expect(handleSelectCitation).toHaveBeenCalledWith(mockChunks[0]);
  });

  it("triggers comparative query when clicking quick launch prompt", () => {
    const handleSelectQuery = vi.fn();
    render(<PolicyComparisonView onSelectQuery={handleSelectQuery} />);

    const compareFloodButton = screen.getByRole("button", { name: /compare flood definitions/i });
    fireEvent.click(compareFloodButton);

    expect(handleSelectQuery).toHaveBeenCalledWith(
      "Compare flood definitions between SUNCORP and NRMA"
    );
  });

  it("triggers onClose callback when clicking Back link", () => {
    const handleClose = vi.fn();
    render(<PolicyComparisonView onClose={handleClose} />);

    const backButton = screen.getByTestId("close-comparison-button");
    fireEvent.click(backButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("stacks the primary insurer before the comparison insurer in every category", () => {
    render(<PolicyComparisonView />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const flood = screen.getByRole("region", { name: "Flood Definition" });
    const insurerNames = Array.from(flood.querySelectorAll("dt")).map((item) => item.textContent);
    expect(insurerNames).toEqual(["Suncorp", "NRMA"]);
    expect(flood.querySelectorAll("dd")).toHaveLength(2);
  });
});
