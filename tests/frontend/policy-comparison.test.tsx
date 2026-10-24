import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Broker Policy Comparison Matrix")).toBeInTheDocument();
    expect(screen.getByTestId("insurer-a-select")).toBeInTheDocument();
    expect(screen.getByTestId("insurer-b-select")).toBeInTheDocument();
  });

  it("renders benchmark matrix rows comparing core coverages", () => {
    render(<PolicyComparisonView />);

    expect(screen.getByText("Flood Definition")).toBeInTheDocument();
    expect(screen.getByText("Jewellery & Watches Sub-limit")).toBeInTheDocument();
    expect(screen.getByText("Accidental Damage")).toBeInTheDocument();
    expect(screen.getByText("Rainwater Run-off & Storm Surge")).toBeInTheDocument();
  });

  it("updates comparison table headers when selecting any of the 39 insurers", () => {
    render(<PolicyComparisonView />);

    const selectB = screen.getByTestId("insurer-b-select");
    fireEvent.change(selectB, { target: { value: "ALLIANZ" } });
    expect(screen.getByRole("columnheader", { name: /ALLIANZ Policy Terms/i })).toBeInTheDocument();

    fireEvent.change(selectB, { target: { value: "AAMI" } });
    expect(screen.getByRole("columnheader", { name: /AAMI Policy Terms/i })).toBeInTheDocument();
    expect(screen.getByText(/AAI Limited/i)).toBeInTheDocument();
  });

  it("renders retrieved session disclosures when matching chunks are provided", () => {
    const handleSelectCitation = vi.fn();
    render(<PolicyComparisonView chunks={mockChunks} onSelectCitation={handleSelectCitation} />);

    expect(
      screen.getByText(/Retrieved Operative PDS Disclosures in Current Session/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/SUNCORP Disclosures/i)).toBeInTheDocument();
    expect(screen.getByText(/NRMA Disclosures/i)).toBeInTheDocument();

    // Click inspect operative excerpt
    const inspectButtons = screen.getAllByRole("button", { name: /inspect operative excerpt/i });
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

  it("triggers onClose callback when clicking Back to Chat button", () => {
    const handleClose = vi.fn();
    render(<PolicyComparisonView onClose={handleClose} />);

    const backButton = screen.getByTestId("close-comparison-button");
    fireEvent.click(backButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
