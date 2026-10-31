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

    // Legacy native selects are purged: every dropdown in the app composes
    // GlobalFilterDropdown, so the OS "heavy blue selection" list is gone.
    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelector("option")).toBeNull();
    expect(screen.getByTestId("insurer-a-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("insurer-b-trigger")).toBeInTheDocument();
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

    const openMenu = (triggerId: string) => {
      fireEvent.click(screen.getByTestId(triggerId));
      return screen.getByRole("dialog");
    };

    const menuB = openMenu("insurer-b-trigger");
    // The approved shared internal UI is present on the comparison picker too.
    expect(menuB.querySelector("[data-testid='insurer-b-search']")).not.toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Allianz" }));
    expect(
      within(screen.getByRole("region", { name: "Flood Definition" })).getByText("Allianz")
    ).toBeInTheDocument();

    openMenu("insurer-b-trigger");
    fireEvent.click(screen.getByRole("option", { name: "AAMI" }));
    expect(
      within(screen.getByRole("region", { name: "Flood Definition" })).getByText("AAMI")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/AAI Limited/i).length).toBeGreaterThan(0);
  });

  it("keeps the desktop picker visible and selectable when it opens near the scroll viewport top", () => {
    const originalMatchMedia = window.matchMedia;
    const originalInnerHeight = window.innerHeight;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    window.matchMedia = () => Object.assign(new EventTarget(), { matches: true }) as MediaQueryList;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.getAttribute("data-testid") === "insurer-a-trigger")
        return new DOMRect(474, 221, 104, 44);
      if (this.getAttribute("data-testid") === "insurer-b-trigger")
        return new DOMRect(859, 650, 104, 44);
      if (
        this.getAttribute("data-testid") === "insurer-a-menu" ||
        this.getAttribute("data-testid") === "insurer-b-menu"
      ) {
        const top = Number.parseFloat(this.style.top) || -101;
        return new DOMRect(474, top, 320, 322);
      }
      return originalGetBoundingClientRect.call(this);
    };

    const { unmount } = render(<PolicyComparisonView />);
    try {
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));

      const menu = screen.getByTestId("insurer-a-menu");
      expect(menu.parentElement).toBe(document.body);
      expect(menu).toHaveClass("fixed");
      expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
      expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
      expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(322);
      expect(menu).toHaveAttribute("data-placement", "below");
      fireEvent.click(screen.getByRole("option", { name: "GIO" }));
      expect(screen.getByTestId("insurer-a-trigger")).toHaveTextContent("GIO");

      fireEvent.click(screen.getByTestId("insurer-b-trigger"));
      const comparisonMenu = screen.getByTestId("insurer-b-menu");
      expect(comparisonMenu.parentElement).toBe(document.body);
      expect(comparisonMenu.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
      expect(comparisonMenu.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
      expect(comparisonMenu).toHaveAttribute("data-placement", "above");
      fireEvent.click(screen.getByRole("option", { name: "Allianz" }));
      expect(screen.getByTestId("insurer-b-trigger")).toHaveTextContent("Allianz");
    } finally {
      unmount();
      window.matchMedia = originalMatchMedia;
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it("disables the counterpart insurer so the two pickers cannot collide", () => {
    render(<PolicyComparisonView />);

    fireEvent.click(screen.getByTestId("insurer-a-trigger"));
    const counterpart = screen.getByRole("option", { name: "NRMA" });
    expect(counterpart).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(counterpart);
    // The disabled row never commits; the menu stays open and the pairing is intact.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
