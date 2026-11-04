import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getCanonicalPdsSources,
  getSharedUnderwriterInfo,
  PRIMARY_INSURERS,
  toInsurerSlug,
} from "../../src/constants/insurers";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import { App } from "../../src/frontend/App";
import { PolicyComparisonView } from "../../src/frontend/components/PolicyComparisonView";
import type { GroundedChunk } from "../../src/frontend/types/chat-ui";

function createSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
}

describe("Adversarial Verification: R1 (Canonical PDS Sources) & Policy Comparison Invariants", () => {
  // =========================================================================
  // 1. Stress Testing Canonical PDS Sources Across Unusual Insurer Codes
  // =========================================================================

  describe("1. Canonical PDS Generation Robustness across Insurer Codes", () => {
    it("generates verified canonical PDS sources for all 39 primary insurers", () => {
      expect(PRIMARY_INSURERS).toHaveLength(39);

      for (const profile of PRIMARY_INSURERS) {
        const expectedId = `canonical-pds-${toInsurerSlug(profile.code)}`;

        // Test by primary uppercase code
        const chunksByCode = getCanonicalPdsSources(profile.code);
        expect(
          chunksByCode.length,
          `Expected canonical PDS source for insurer code ${profile.code}`
        ).toBe(4);

        const chunk = chunksByCode[0];
        expect(chunk.id).toBe(expectedId);
        expect(chunk.relevanceScore).toBe(1.0);
        expect(chunk.source.docType).toBe("PDS");
        expect(chunk.source.product).toBeTruthy();
        expect(chunk.source.section).toBeTruthy();
        expect(chunk.source.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect((chunk.source as { underwriter?: string }).underwriter).toBeTruthy();
        expect(chunk.content).toContain(STATUTORY_GAW);
        expect(chunk.content).toContain(profile.name);

        // Verify remaining dimension clauses are present and valid
        expect(chunksByCode[1].id).toBe(`${expectedId}-jewellery`);
        expect(chunksByCode[2].id).toBe(`${expectedId}-accidental`);
        expect(chunksByCode[3].id).toBe(`${expectedId}-runoff`);

        // Test by lowercase slug
        const chunksBySlug = getCanonicalPdsSources(profile.slug);
        expect(chunksBySlug.length).toBe(4);
        expect(chunksBySlug[0].id).toBe(chunk.id);

        // Test by exact name
        const chunksByName = getCanonicalPdsSources(profile.name);
        expect(chunksByName.length).toBe(4);
        expect(chunksByName[0].id).toBe(chunk.id);
      }
    });

    it("correctly resolves unusual travel and life insurer codes (SCTI, SOUTHERN_CROSS, TID, TRAVEL_INSURANCE_DIRECT, NEOS, PPS_MUTUAL, ACENDA, 1COVER)", () => {
      const unusualCases = [
        {
          input: "SCTI",
          expectedCodeSlug: "scti",
          expectedName: "Southern Cross Travel Insurance",
        },
        {
          input: "SOUTHERN_CROSS",
          expectedCodeSlug: "scti",
          expectedName: "Southern Cross Travel Insurance",
        },
        {
          input: "southern_cross",
          expectedCodeSlug: "scti",
          expectedName: "Southern Cross Travel Insurance",
        },
        { input: "TID", expectedCodeSlug: "tid", expectedName: "Travel Insurance Direct" },
        {
          input: "TRAVEL_INSURANCE_DIRECT",
          expectedCodeSlug: "tid",
          expectedName: "Travel Insurance Direct",
        },
        {
          input: "travel_insurance_direct",
          expectedCodeSlug: "tid",
          expectedName: "Travel Insurance Direct",
        },
        { input: "NEOS", expectedCodeSlug: "neos", expectedName: "NEOS" },
        { input: "neos", expectedCodeSlug: "neos", expectedName: "NEOS" },
        { input: "PPS_MUTUAL", expectedCodeSlug: "pps-mutual", expectedName: "PPS Mutual" },
        { input: "pps-mutual", expectedCodeSlug: "pps-mutual", expectedName: "PPS Mutual" },
        { input: "ACENDA", expectedCodeSlug: "acenda", expectedName: "Acenda" },
        { input: "acenda", expectedCodeSlug: "acenda", expectedName: "Acenda" },
        { input: "1COVER", expectedCodeSlug: "1cover", expectedName: "1Cover" },
        { input: "1cover", expectedCodeSlug: "1cover", expectedName: "1Cover" },
        { input: "RAC_WA", expectedCodeSlug: "rac-wa", expectedName: "RAC WA" },
        { input: "rac-wa", expectedCodeSlug: "rac-wa", expectedName: "RAC WA" },
        { input: "ASTERON_LIFE", expectedCodeSlug: "asteron-life", expectedName: "Asteron Life" },
        { input: "HCF_LIFE", expectedCodeSlug: "hcf-life", expectedName: "HCF Life" },
        { input: "GO_INSURANCE", expectedCodeSlug: "go-insurance", expectedName: "Go Insurance" },
        { input: "FAST_COVER", expectedCodeSlug: "fast-cover", expectedName: "Fast Cover" },
        { input: "COVER_MORE", expectedCodeSlug: "cover-more", expectedName: "Cover-More" },
        {
          input: "BUDGET_DIRECT",
          expectedCodeSlug: "budget-direct",
          expectedName: "Budget Direct",
        },
      ];

      for (const { input, expectedCodeSlug, expectedName } of unusualCases) {
        const sources = getCanonicalPdsSources(input);
        expect(sources.length, `Failed to resolve canonical PDS for ${input}`).toBe(4);
        expect(sources[0].id).toBe(`canonical-pds-${expectedCodeSlug}`);
        expect(sources[0].source.insurer).toBe(expectedName);
        expect(sources[0].source.docType).toBe("PDS");
      }
    });

    it("correctly resolves bancassurance and brand aliases to canonical target PDS sources", () => {
      const aliasCases = [
        { alias: "commbank", expectedTarget: "allianz" },
        { alias: "coles", expectedTarget: "cgu" },
        { alias: "everyday-insurance", expectedTarget: "budget-direct" },
        { alias: "mlc-life", expectedTarget: "acenda" },
        { alias: "world-nomads", expectedTarget: "tid" },
        { alias: "tick-travel-insurance", expectedTarget: "insureandgo" },
        { alias: "zoom-travel-insurance", expectedTarget: "zoom" },
      ];

      for (const { alias, expectedTarget } of aliasCases) {
        const sources = getCanonicalPdsSources(alias);
        expect(sources.length, `Expected canonical source for alias ${alias}`).toBe(4);
        expect(sources[0].id).toBe(`canonical-pds-${expectedTarget}`);
      }
    });

    it("handles adversarial inputs gracefully without throwing (empty string, whitespace, malformed, unknown)", () => {
      const maliciousInputs = [
        "",
        "   ",
        "\t\n",
        "UNKNOWN_INSURER_XYZ_999",
        "<script>alert(1)</script>",
        "../../etc/passwd",
        "SUNCORP; DROP TABLE insurers;--",
      ];

      for (const input of maliciousInputs) {
        expect(() => {
          const result = getCanonicalPdsSources(input);
          expect(Array.isArray(result)).toBe(true);
        }).not.toThrow();
      }
    });
  });

  // =========================================================================
  // 2. Chat Chunk Bleed Verification
  // =========================================================================

  describe("2. Zero Chat Chunk Bleed into Comparison View", () => {
    it("never renders arbitrary conversational chat chunks in the Policy sources list", () => {
      const hostileChatChunks: GroundedChunk[] = [
        {
          id: "chunk-chat-hostile-1",
          relevanceScore: 0.99,
          content: "ADVERSARIAL_BLEED_CONTENT_QBE_FLOOD_SPECIAL_POLICY",
          source: {
            insurer: "QBE",
            product: "QBE Comprehensive Car",
            docType: "PDS",
            section: "Section 9: Motor Exclusions",
          },
        },
        {
          id: "chunk-chat-hostile-2",
          relevanceScore: 0.98,
          content: "ADVERSARIAL_BLEED_CONTENT_ALLIANZ_HOME_WATER_DAMAGE",
          source: {
            insurer: "Allianz",
            product: "Allianz Home",
            docType: "PDS",
            section: "Section 3: Storm Run-off",
          },
        },
        {
          id: "chunk-chat-hostile-3",
          relevanceScore: 0.95,
          content: "ADVERSARIAL_BLEED_CONTENT_SUNCORP_CONVERSATIONAL_SNIPPET",
          source: {
            insurer: "SUNCORP",
            product: "Suncorp Ad-hoc Chat Answer",
            docType: "FAQ",
            section: "Conversational Turn 4",
          },
        },
      ];

      render(<PolicyComparisonView chunks={hostileChatChunks} />);

      // Policy sources header must exist
      const sourcesSection = screen.getByRole("region", { name: "Policy sources" });
      expect(sourcesSection).toBeInTheDocument();

      // Policy sources must show strictly Suncorp and NRMA verified canonical PDS sources
      expect(within(sourcesSection).getByText("Suncorp sources")).toBeInTheDocument();
      expect(within(sourcesSection).getByText("NRMA sources")).toBeInTheDocument();

      // NONE of the hostile chat chunks should appear in the sources section
      expect(within(sourcesSection).queryByText(/ADVERSARIAL_BLEED/)).not.toBeInTheDocument();
      expect(within(sourcesSection).queryByText(/QBE/)).not.toBeInTheDocument();
      expect(within(sourcesSection).queryByText(/Allianz/)).not.toBeInTheDocument();
      expect(
        within(sourcesSection).queryByText(/Suncorp Ad-hoc Chat Answer/)
      ).not.toBeInTheDocument();
      expect(within(sourcesSection).queryByText(/Conversational Turn 4/)).not.toBeInTheDocument();
    });

    it("never shows 'No sources yet' even when chunks prop is empty or undefined", () => {
      const { rerender } = render(<PolicyComparisonView chunks={[]} />);
      expect(screen.queryByText(/no sources yet/i)).not.toBeInTheDocument();
      expect(screen.getByText("Suncorp sources")).toBeInTheDocument();
      expect(screen.getByText("NRMA sources")).toBeInTheDocument();

      rerender(<PolicyComparisonView chunks={undefined} />);
      expect(screen.queryByText(/no sources yet/i)).not.toBeInTheDocument();
      expect(screen.getByText("Suncorp sources")).toBeInTheDocument();
      expect(screen.getByText("NRMA sources")).toBeInTheDocument();
    });

    it("preserves canonical source isolation in full App state across chat turns and comparison toggle", async () => {
      // 1. Setup mock SSE response containing a retrieved QBE chat chunk
      const qbeChatChunk: GroundedChunk = {
        id: "retrieved-qbe-chunk-chat",
        relevanceScore: 0.88,
        content: "QBE travel cancellation covers natural disasters including severe floods.",
        source: {
          insurer: "QBE",
          product: "QBE Travel Protection",
          docType: "PDS",
          section: "Section 4: Trip Cancellation",
        },
      };

      const ssePayload = [
        `event: metadata\ndata: ${JSON.stringify({ chunks: [qbeChatChunk], latencyMs: 25 })}\n\n`,
        `event: token\ndata: ${JSON.stringify({ text: "Here is your QBE travel information." })}\n\n`,
        `event: done\ndata: ${JSON.stringify({ finish_reason: "stop" })}\n\n`,
      ];

      global.fetch = vi.fn().mockResolvedValue(
        new Response(createSseStream(ssePayload), {
          status: 200,
          headers: new Headers({ "Content-Type": "text/event-stream" }),
        })
      );

      render(<App />);

      // 2. Send a chat query to populate allChunks with the QBE chunk
      const input = screen.getByTestId("chat-input-textarea");
      fireEvent.change(input, { target: { value: "Tell me about QBE travel cover" } });
      await act(async () => {
        fireEvent.click(screen.getByTestId("send-button"));
      });

      // Confirm chat has completed and QBE response is rendered
      expect(await screen.findByText("Here is your QBE travel information.")).toBeInTheDocument();

      // 3. Switch to Policy Comparison View
      fireEvent.click(screen.getByTestId("comparison-toggle"));
      const comparisonView = screen.getByTestId("policy-comparison-view");
      expect(comparisonView).toBeInTheDocument();

      // 4. Verify Policy sources contains ONLY Suncorp and NRMA canonical PDS, and NOT QBE chat chunk
      const policySourcesSection = within(comparisonView).getByRole("region", {
        name: "Policy sources",
      });
      expect(within(policySourcesSection).getByText("Suncorp sources")).toBeInTheDocument();
      expect(within(policySourcesSection).getByText("NRMA sources")).toBeInTheDocument();
      expect(
        within(policySourcesSection).queryByText(/QBE Travel Protection/)
      ).not.toBeInTheDocument();
      expect(
        within(policySourcesSection).queryByText(/Section 4: Trip Cancellation/)
      ).not.toBeInTheDocument();

      // 5. Click the Suncorp canonical source button
      const suncorpBtn = within(policySourcesSection).getAllByRole("button", {
        name: /read source: suncorp.*pds/i,
      })[0];
      await act(async () => {
        fireEvent.click(suncorpBtn);
      });

      // 6. Verify CitationDrawer opens showing the canonical Suncorp document and statutory underwriter
      const drawer = await screen.findByRole("dialog", { name: /policy sources/i });
      expect(drawer).toBeInTheDocument();
      expect(within(drawer).getByText("Suncorp Classic Home PDS")).toBeInTheDocument();
      expect(within(drawer).getByTestId("statutory-underwriter-trail")).toHaveTextContent(
        /AAI Limited/i
      );
    });
  });

  // =========================================================================
  // =========================================================================
  // 3. Quick Swap Button Absence & Insurer Switching Parity
  // =========================================================================

  describe("3. Quick Swap Button Absence & Parity Invariant", () => {
    it("ensures quick swap button is completely omitted from the interface", () => {
      render(<PolicyComparisonView />);

      expect(screen.queryByTestId("swap-insurers-button")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /swap primary and comparison insurers/i,
        })
      ).not.toBeInTheDocument();
    });

    it("switches correctly when custom unusual insurers are selected (SCTI vs NEOS)", () => {
      render(<PolicyComparisonView />);

      // Select SCTI in A
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "Southern Cross Travel Insurance" }));
      expect(screen.getByTestId("insurer-a-trigger")).toHaveTextContent(
        "Southern Cross Travel Insurance"
      );

      // Select NEOS in B
      fireEvent.click(screen.getByTestId("insurer-b-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "NEOS" }));
      expect(screen.getByTestId("insurer-b-trigger")).toHaveTextContent("NEOS");

      // Sources reflect selected state
      expect(screen.getByText("Southern Cross Travel Insurance sources")).toBeInTheDocument();
      expect(screen.getByText("NEOS sources")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Counterpart Collision Disabling Across Menu Selections
  // =========================================================================

  describe("4. Counterpart Collision Disabling Across Selections", () => {
    it("dynamically flips disabled counterpart state across insurer selections", () => {
      render(<PolicyComparisonView />);

      // State 1: A = Suncorp, B = NRMA
      // Open A's menu: NRMA must be aria-disabled="true"
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));
      const menuA = screen.getByTestId("insurer-a-menu");
      const optionNrmaInA = within(menuA).getByRole("option", { name: "NRMA" });
      expect(optionNrmaInA).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(optionNrmaInA); // click should be ignored
      expect(screen.getByTestId("insurer-a-trigger")).toHaveTextContent("Suncorp");

      // Close menu A by clicking trigger A
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));

      // Open B's menu: Suncorp must be aria-disabled="true"
      fireEvent.click(screen.getByTestId("insurer-b-trigger"));
      const menuB = screen.getByTestId("insurer-b-menu");
      const optionSuncorpInB = within(menuB).getByRole("option", { name: "Suncorp" });
      expect(optionSuncorpInB).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(optionSuncorpInB); // click should be ignored
      expect(screen.getByTestId("insurer-b-trigger")).toHaveTextContent("NRMA");

      // Select Allianz in B
      fireEvent.click(within(menuB).getByRole("option", { name: "Allianz" }));
      expect(screen.getByTestId("insurer-b-trigger")).toHaveTextContent("Allianz");

      // Now open A: Allianz must be disabled, NRMA must be enabled
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));
      const menuAUpdated = screen.getByTestId("insurer-a-menu");
      expect(within(menuAUpdated).getByRole("option", { name: "Allianz" })).toHaveAttribute(
        "aria-disabled",
        "true"
      );
      expect(within(menuAUpdated).getByRole("option", { name: "NRMA" })).not.toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });
  });

  // =========================================================================
  // 5. Comparative Prompt Launching Across Insurer Selections
  // =========================================================================

  describe("5. Comparative Prompt Launching Across Selections", () => {
    it("dynamically updates all prompt queries and labels to match selected insurer order", () => {
      const handleSelectQuery = vi.fn();
      render(<PolicyComparisonView onSelectQuery={handleSelectQuery} />);

      // Initial: Suncorp vs NRMA
      let floodPrompt = screen.getByRole("button", {
        name: "Compare flood definitions between Suncorp and NRMA",
      });
      let jewelleryPrompt = screen.getByRole("button", {
        name: "What are jewellery sub-limits under Suncorp vs NRMA?",
      });
      let damagePrompt = screen.getByRole("button", {
        name: "How does accidental damage compare between Suncorp and NRMA?",
      });
      expect(floodPrompt).toBeInTheDocument();
      expect(jewelleryPrompt).toBeInTheDocument();
      expect(damagePrompt).toBeInTheDocument();

      // Click flood prompt
      fireEvent.click(floodPrompt);
      expect(handleSelectQuery).toHaveBeenCalledWith(
        "Compare flood definitions between SUNCORP and NRMA"
      );

      handleSelectQuery.mockClear();

      // Change Primary to Allianz
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "Allianz" }));

      floodPrompt = screen.getByRole("button", {
        name: "Compare flood definitions between Allianz and NRMA",
      });
      jewelleryPrompt = screen.getByRole("button", {
        name: "What are jewellery sub-limits under Allianz vs NRMA?",
      });
      damagePrompt = screen.getByRole("button", {
        name: "How does accidental damage compare between Allianz and NRMA?",
      });
      expect(floodPrompt).toBeInTheDocument();
      expect(jewelleryPrompt).toBeInTheDocument();
      expect(damagePrompt).toBeInTheDocument();

      // Click each updated prompt
      fireEvent.click(floodPrompt);
      expect(handleSelectQuery).toHaveBeenCalledWith(
        "Compare flood definitions between ALLIANZ and NRMA"
      );

      fireEvent.click(jewelleryPrompt);
      expect(handleSelectQuery).toHaveBeenCalledWith(
        "What are jewellery sub-limits under ALLIANZ vs NRMA?"
      );

      fireEvent.click(damagePrompt);
      expect(handleSelectQuery).toHaveBeenCalledWith(
        "How does accidental damage compare between ALLIANZ and NRMA?"
      );
    });
  });

  // =========================================================================
  // 6. Underwriter Group Transparency Badge Invariants
  // =========================================================================

  describe("6. Underwriter Group Transparency Badge Invariants", () => {
    it("renders badge for multi-brand groups (Suncorp & AAMI)", () => {
      render(<PolicyComparisonView />);

      // Select AAMI in B
      fireEvent.click(screen.getByTestId("insurer-b-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "AAMI" }));

      const badge = screen.getByTestId("underwriter-transparency-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/AAI Limited \(Suncorp Group\)/i);
    });

    it("renders badge for Life insurer groups (NobleOak & NEOS & PPS Mutual)", () => {
      render(<PolicyComparisonView />);

      // Select NobleOak in A
      fireEvent.click(screen.getByTestId("insurer-a-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "NobleOak" }));

      // Select NEOS in B
      fireEvent.click(screen.getByTestId("insurer-b-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "NEOS" }));

      let badge = screen.getByTestId("underwriter-transparency-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/NobleOak Life Limited/i);

      // Change B to PPS Mutual (also underwritten by NobleOak)
      fireEvent.click(screen.getByTestId("insurer-b-trigger"));
      fireEvent.click(screen.getByRole("option", { name: "PPS Mutual" }));

      badge = screen.getByTestId("underwriter-transparency-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/NobleOak Life Limited/i);
    });

    it("does not render badge when insurers belong to different groups", () => {
      render(<PolicyComparisonView />);

      // Suncorp and NRMA: no badge
      expect(screen.queryByTestId("underwriter-transparency-badge")).not.toBeInTheDocument();
    });

    it("verifies full matrix of corporate group relationships and self-comparison null invariant", () => {
      // 1. Same insurer compared against itself must strictly return null
      for (const profile of PRIMARY_INSURERS) {
        expect(
          getSharedUnderwriterInfo(profile.code, profile.code),
          `Self-comparison for ${profile.code} must return null`
        ).toBeNull();
      }

      // 2. Multi-brand groups must accurately resolve across all members
      const sharedPairs = [
        // Suncorp Group
        ["SUNCORP", "AAMI", "suncorp-group"],
        ["SUNCORP", "GIO", "suncorp-group"],
        ["AAMI", "APIA", "suncorp-group"],
        ["GIO", "SHANNONS", "suncorp-group"],
        ["BINGLE", "VERO", "suncorp-group"],
        // IAG Group
        ["NRMA", "CGU", "iag-group"],
        ["NRMA", "RACV", "iag-group"],
        ["CGU", "RACV", "iag-group"],
        // Allianz Australia Group
        ["ALLIANZ", "TIO", "allianz-group"],
        ["ALLIANZ", "FAST_COVER", "allianz-group"],
        // MSIG Group
        ["1COVER", "INSUREANDGO", "msig-group"],
        ["1COVER", "ZOOM", "msig-group"],
        ["INSUREANDGO", "ZOOM", "msig-group"],
        // NobleOak Group
        ["NOBLEOAK", "NEOS", "nobleoak-group"],
        ["NOBLEOAK", "PPS_MUTUAL", "nobleoak-group"],
        ["NEOS", "PPS_MUTUAL", "nobleoak-group"],
        // TAL Group
        ["TAL", "ASTERON_LIFE", "tal-group"],
        // Zurich Group
        ["ZURICH", "COVER_MORE", "zurich-group"],
      ];

      for (const [codeA, codeB, expectedGroup] of sharedPairs) {
        const infoAB = getSharedUnderwriterInfo(codeA, codeB);
        expect(infoAB, `Pair (${codeA}, ${codeB}) should share corporate group`).not.toBeNull();
        expect(infoAB?.groupId).toBe(expectedGroup);
        expect(infoAB?.isShared).toBe(true);

        // Symmetric check (B, A)
        const infoBA = getSharedUnderwriterInfo(codeB, codeA);
        expect(
          infoBA,
          `Reverse pair (${codeB}, ${codeA}) should share corporate group`
        ).not.toBeNull();
        expect(infoBA?.groupId).toBe(expectedGroup);
      }

      // 3. Different corporate groups must return null
      const nonSharedPairs = [
        ["SUNCORP", "NRMA"],
        ["ALLIANZ", "QBE"],
        ["SCTI", "TID"],
        ["YOUI", "BUDGET_DIRECT"],
        ["NEOS", "TAL"],
        ["ZURICH", "AIA"],
        ["CHALLENGER", "CLEARVIEW"],
      ];

      for (const [codeA, codeB] of nonSharedPairs) {
        expect(
          getSharedUnderwriterInfo(codeA, codeB),
          `Pair (${codeA}, ${codeB}) must NOT share group`
        ).toBeNull();
      }
    });
  });

  // =========================================================================
  // 7. Sequential CitationDrawer Opening Across Insurers
  // =========================================================================

  describe("7. Sequential CitationDrawer Opening Across Insurers", () => {
    it("smoothly opens CitationDrawer for both insurers in sequence", async () => {
      render(<App />);

      fireEvent.click(screen.getByTestId("comparison-toggle"));
      const comparisonView = screen.getByTestId("policy-comparison-view");
      expect(comparisonView).toBeInTheDocument();

      // 1. Open Primary source (Suncorp)
      const suncorpBtn = within(comparisonView).getAllByRole("button", {
        name: /read source: suncorp.*pds/i,
      })[0];
      await act(async () => {
        fireEvent.click(suncorpBtn);
      });
      let drawer = await screen.findByRole("dialog", { name: /policy sources/i });
      expect(within(drawer).getByText("Suncorp Classic Home PDS")).toBeInTheDocument();
      expect(within(drawer).getByTestId("statutory-underwriter-trail")).toHaveTextContent(
        /AAI Limited/i
      );

      // Close drawer
      await act(async () => {
        fireEvent.click(screen.getByTestId("citation-drawer-backdrop"));
      });
      expect(screen.queryByRole("dialog", { name: /policy sources/i })).not.toBeInTheDocument();

      // 2. Open Comparison source (NRMA)
      const nrmaBtn = within(comparisonView).getAllByRole("button", {
        name: /read source: nrma.*pds/i,
      })[0];
      await act(async () => {
        fireEvent.click(nrmaBtn);
      });
      drawer = await screen.findByRole("dialog", { name: /policy sources/i });
      expect(within(drawer).getByText("NRMA Home & Contents PDS")).toBeInTheDocument();
      expect(within(drawer).getByTestId("statutory-underwriter-trail")).toHaveTextContent(
        /Insurance Australia Limited/i
      );

      // Close drawer
      await act(async () => {
        fireEvent.click(screen.getByTestId("citation-drawer-backdrop"));
      });
      expect(screen.queryByRole("dialog", { name: /policy sources/i })).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 8. Quick Swap Button Absence Verification
  // =========================================================================

  describe("8. Quick Swap Button Absence Verification", () => {
    it("verifies no swap button or swap attributes exist in the comparison interface", () => {
      render(<PolicyComparisonView />);

      expect(screen.queryByTestId("swap-insurers-button")).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: /swap primary and comparison insurers/i,
        })
      ).toBeNull();
    });
  });
});
