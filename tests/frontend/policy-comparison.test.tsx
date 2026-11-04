import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("renders canonical PDS document sources for both default insurers across comparison dimensions", () => {
    render(<PolicyComparisonView />);

    // Policy sources section must always be visible
    expect(screen.getByText("Policy sources")).toBeInTheDocument();
    expect(screen.getByText("Suncorp sources")).toBeInTheDocument();
    expect(screen.getByText("NRMA sources")).toBeInTheDocument();

    // "No sources yet" should never be rendered for canonical pairs
    expect(screen.queryByText(/no sources yet/i)).not.toBeInTheDocument();

    // Both canonical source buttons must be present with BookOpen icon and doc titles
    const suncorpSourceBtns = screen.getAllByRole("button", {
      name: /read source: suncorp.*pds/i,
    });
    expect(suncorpSourceBtns.length).toBe(4);
    expect(within(suncorpSourceBtns[0]).getByText(/suncorp.*pds/i)).toBeInTheDocument();

    const nrmaSourceBtns = screen.getAllByRole("button", {
      name: /read source: nrma.*pds/i,
    });
    expect(nrmaSourceBtns.length).toBe(4);
    expect(within(nrmaSourceBtns[0]).getByText(/nrma.*pds/i)).toBeInTheDocument();
  });

  it("renders direct 'View clause' actions on each comparison dimension cell", () => {
    const handleSelectCitation = vi.fn();
    render(<PolicyComparisonView onSelectCitation={handleSelectCitation} />);

    const viewClauseBtns = screen.getAllByRole("button", { name: /view .* source clause/i });
    expect(viewClauseBtns.length).toBe(8); // 4 dimensions x 2 insurers

    fireEvent.click(viewClauseBtns[0]);
    expect(handleSelectCitation).toHaveBeenCalledTimes(1);
  });

  it("does not bleed conversational chat history chunks into comparison sources list", () => {
    const adHocChatChunks: GroundedChunk[] = [
      {
        id: "chunk-chat-qbe-motor",
        relevanceScore: 0.9,
        content: "QBE Comprehensive Car Insurance covers accidental collision damage.",
        source: {
          insurer: "QBE",
          product: "QBE Comprehensive Car",
          docType: "PDS",
          section: "Section 3 - Accidental Damage",
        },
      },
    ];

    render(<PolicyComparisonView chunks={adHocChatChunks} />);

    // Policy sources must show Suncorp and NRMA canonical sources, NOT QBE
    expect(screen.getByText("Suncorp sources")).toBeInTheDocument();
    expect(screen.getByText("NRMA sources")).toBeInTheDocument();
    expect(screen.queryByText("QBE sources")).not.toBeInTheDocument();
    expect(screen.queryByText(/QBE Comprehensive Car/i)).not.toBeInTheDocument();
  });

  it("triggers onSelectCitation with canonical PDS chunk when clicking a source button", () => {
    const handleSelectCitation = vi.fn();
    render(<PolicyComparisonView onSelectCitation={handleSelectCitation} />);

    const suncorpSourceBtn = screen.getAllByRole("button", {
      name: /read source: suncorp.*pds/i,
    })[0];
    fireEvent.click(suncorpSourceBtn);

    expect(handleSelectCitation).toHaveBeenCalledTimes(1);
    const calledChunk = handleSelectCitation.mock.calls[0][0];
    expect(calledChunk).toMatchObject({
      source: expect.objectContaining({
        insurer: expect.stringMatching(/suncorp/i),
        docType: "PDS",
      }),
    });
  });

  it("updates canonical PDS sources dynamically when changing comparison insurer", () => {
    render(<PolicyComparisonView />);

    fireEvent.click(screen.getByTestId("insurer-b-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Allianz" }));

    expect(screen.getByText("Allianz sources")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /read source: allianz.*pds/i })[0]
    ).toBeInTheDocument();
    expect(screen.queryByText("NRMA sources")).not.toBeInTheDocument();
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

  it("applies responsive mobile spacing and compact card layout", () => {
    const handleQuery = vi.fn();
    render(
      <PolicyComparisonView chunks={mockChunks} onSelectQuery={handleQuery} onClose={vi.fn()} />
    );

    const view = screen.getByTestId("policy-comparison-view");
    expect(view.className).toContain("pb-12");
    expect(view.className).toContain("sm:pb-16");

    const flood = screen.getByRole("region", { name: "Flood Definition" });
    const dl = flood.querySelector("dl");
    expect(dl).not.toBeNull();
    expect(dl?.className).toContain("grid-cols-1");
    expect(dl?.className).toContain("sm:grid-cols-2");

    const followUpButtons = screen.getAllByRole("button", { name: /compare/i });
    expect(followUpButtons.length).toBeGreaterThan(0);
    for (const btn of followUpButtons) {
      expect(btn).toHaveAttribute("data-compact-action");
      expect(btn).toHaveAttribute("data-follow-up");
      expect(btn.className).toContain("citation-standalone");
    }
  });

  // =========================================================================
  // Quick Swap Button Removal Verification
  // =========================================================================

  it("does not render a Quick Swap button between Primary and Comparison pickers", () => {
    render(<PolicyComparisonView />);
    expect(screen.queryByTestId("swap-insurers-button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Swap primary and comparison insurers",
      })
    ).not.toBeInTheDocument();
  });

  it("preserves collision disabling for counterpart when changing insurer selection", () => {
    render(<PolicyComparisonView />);

    // Select Allianz in Primary
    fireEvent.click(screen.getByTestId("insurer-a-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Allianz" }));

    // Open Comparison: Allianz should be disabled as counterpart
    fireEvent.click(screen.getByTestId("insurer-b-trigger"));
    const counterpartInB = screen.getByRole("option", { name: "Allianz" });
    expect(counterpartInB).toHaveAttribute("aria-disabled", "true");
  });

  // =========================================================================
  // R3: Underwriter Group Transparency Badge Test Cases
  // =========================================================================

  it("renders underwriter transparency badge when insurers share corporate group / underwriter", () => {
    render(<PolicyComparisonView />);

    // Select AAMI for insurerB (both Suncorp & AAMI are under AAI Limited / Suncorp Group)
    fireEvent.click(screen.getByTestId("insurer-b-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "AAMI" }));

    const badge = screen.getByTestId("underwriter-transparency-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/AAI Limited/i);
    expect(badge).toHaveTextContent(/Suncorp Group/i);
    expect(badge).toHaveTextContent(/share common underwriting/i);
  });

  it("renders underwriter transparency badge for IAG brands (NRMA & CGU)", () => {
    render(<PolicyComparisonView />);

    // Set insurerB to CGU first (since NRMA is initially in B)
    fireEvent.click(screen.getByTestId("insurer-b-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "CGU" }));

    // Set insurerA to NRMA
    fireEvent.click(screen.getByTestId("insurer-a-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "NRMA" }));

    const badge = screen.getByTestId("underwriter-transparency-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/Insurance Australia Limited|IAG/i);
  });

  it("does NOT render underwriter transparency badge when insurers belong to different groups", () => {
    render(<PolicyComparisonView />);

    // Default is Suncorp (AAI Limited) and NRMA (Insurance Australia Limited)
    expect(screen.queryByTestId("underwriter-transparency-badge")).not.toBeInTheDocument();

    // Change to Allianz
    fireEvent.click(screen.getByTestId("insurer-b-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Allianz" }));
    expect(screen.queryByTestId("underwriter-transparency-badge")).not.toBeInTheDocument();
  });

  it("ensures transparency badge copy strictly complies with ASIC RG 244 factual non-advice standards", () => {
    render(<PolicyComparisonView />);

    fireEvent.click(screen.getByTestId("insurer-b-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "AAMI" }));

    const badge = screen.getByTestId("underwriter-transparency-badge");
    const text = badge.textContent || "";

    // Purely factual underwriter alignment: no recommendations or switching language
    expect(text).not.toMatch(
      /\b(recommend|better|best|cheaper|preferable|should choose|upgrade|switch)\b/i
    );
  });
});
