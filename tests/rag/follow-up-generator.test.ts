import { describe, expect, it } from "vitest";
import { generateFollowUpSuggestions } from "../../src/rag/follow-up-generator";
import type { GroundedChunk } from "../../src/types/chat";

describe("Dynamic Follow-Up Prompt Suggestions Generator (Ticket 05 & Spec 07)", () => {
  const floodChunk: GroundedChunk = {
    id: "SUNCORP-flood-01",
    relevanceScore: 0.9,
    content: "Flood cover is subject to a 72-hour embargo from policy commencement.",
    source: {
      insurer: "SUNCORP",
      product: "Classic Home",
      docType: "PDS",
      section: "Flood Exclusion & Embargo",
    },
  };

  const liquidChunk: GroundedChunk = {
    id: "SUNCORP-liquid-01",
    relevanceScore: 0.88,
    content: "Escape of liquid covers sudden discharge from fixed internal apparatus.",
    source: {
      insurer: "SUNCORP",
      product: "Classic Home",
      docType: "PDS",
      section: "Escape of Liquid",
    },
  };

  it("generates 2-3 contextual statutory chips for water and flood inquiries", () => {
    const suggestions = generateFollowUpSuggestions(
      "What is the flood definition?",
      [floodChunk, liquidChunk],
      ["RAINWATER_RUNOFF"]
    );

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    // Should include statutory distinctions like 72-hour embargo or escape of liquid
    const hasStatutoryTopic = suggestions.some(
      (s) =>
        s.includes("72-hour") ||
        s.includes("embargo") ||
        s.includes("escape of liquid") ||
        s.includes("storm run-off")
    );
    expect(hasStatutoryTopic).toBe(true);
  });

  it("generates jewelry and valuables sub-limit suggestions for theft inquiries", () => {
    const jewelryChunk: GroundedChunk = {
      id: "ALLIANZ-jewel-01",
      relevanceScore: 0.92,
      content: "Jewelry is capped at $2,500 total and $1,000 per item under standard contents.",
      source: {
        insurer: "ALLIANZ",
        product: "Home Contents",
        docType: "PDS",
        section: "Valuables Sub-limits",
      },
    };

    const suggestions = generateFollowUpSuggestions(
      "Someone stole my watch",
      [jewelryChunk],
      ["THEFT_FORCIBLE_ENTRY", "JEWELRY_SUBLIMIT"]
    );

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    const hasJewelryOrValuables = suggestions.some(
      (s) => s.toLowerCase().includes("sub-limit") || s.toLowerCase().includes("forcible")
    );
    expect(hasJewelryOrValuables).toBe(true);
  });

  it("does not repeat the user's current question as a suggestion", () => {
    const suggestions = generateFollowUpSuggestions(
      "What is the 72-hour flood embargo?",
      [floodChunk],
      ["EMBARGO_72_HOUR"]
    );

    for (const s of suggestions) {
      expect(s.toLowerCase()).not.toBe("what is the 72-hour flood embargo?");
    }
  });

  it("returns fallback statutory suggestions when chunks are empty", () => {
    const suggestions = generateFollowUpSuggestions("General insurance question", []);

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
