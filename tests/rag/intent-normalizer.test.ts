import { describe, expect, it } from "vitest";
import { normalizeIntent } from "../../src/rag/intent-normalizer";

describe("Sub-ms Voice & Colloquial Intent Normalizer (Ticket 03 & Spec 07)", () => {
  describe("Speech-to-Text Verbal Filler Stripping", () => {
    it("strips conversational fillers from mobile voice input", () => {
      const input = "Um so like my fence blew down in the wind yesterday what do I do";
      const result = normalizeIntent(input);

      expect(result.cleanedQuery.toLowerCase()).not.toContain("um");
      expect(result.cleanedQuery.toLowerCase()).not.toContain("so like");
      expect(result.cleanedQuery.toLowerCase()).toContain("fence blew down in the wind");
    });

    it("strips mid-sentence fillers ('you know', 'actually', 'basically')", () => {
      const input = "A pipe burst in my ensuite, like, basically ruined the floorboards, actually";
      const result = normalizeIntent(input);

      expect(result.cleanedQuery).not.toMatch(/\bbasically\b/i);
      expect(result.cleanedQuery).not.toMatch(/\bactually\b/i);
      expect(result.cleanedQuery).toContain("pipe burst in my ensuite");
    });
  });

  describe("Colloquial to Statutory Peril Token Mapping", () => {
    it("maps burst pipe and soaked floorboards to Escape of Liquid", () => {
      const input = "A pipe burst in my ensuite while I was on holiday and ruined the floorboards";
      const result = normalizeIntent(input);

      expect(result.canonicalTokens).toContain("Escape of Liquid");
      expect(result.canonicalTokens).toContain("Fixed Apparatus");
      expect(result.detectedPerils).toContain("ESCAPE_OF_LIQUID");
      expect(result.expandedTerms.some((t) => t.toLowerCase().includes("escape of liquid"))).toBe(true);
    });

    it("maps driveway car theft to Violent and Forcible Entry & Common Property", () => {
      const input = "Someone smashed my passenger window parked outside my flat and took my laptop";
      const result = normalizeIntent(input);

      expect(result.canonicalTokens).toContain("Theft");
      expect(result.canonicalTokens).toContain("Violent and Forcible Entry");
      expect(result.detectedPerils).toContain("THEFT_FORCIBLE_ENTRY");
    });

    it("maps blackout food spoilage to Food Spoilage & Contents Insurance", () => {
      const input = "Does Suncorp cover spoiled food if the power goes out during a blackout?";
      const result = normalizeIntent(input);

      expect(result.canonicalTokens).toContain("Food Spoilage");
      expect(result.canonicalTokens).toContain("Contents Insurance");
      expect(result.detectedPerils).toContain("FOOD_SPOILAGE");
    });

    it("maps overseas moped/scooter rental to Motorcycle Endorsement and License terms", () => {
      const input = "Does travel insurance cover me if I crash a rental moped in Thailand?";
      const result = normalizeIntent(input);

      expect(result.canonicalTokens).toContain("Motorcycle Endorsement");
      expect(result.canonicalTokens).toContain("Engine Capacity Sub-limit");
      expect(result.detectedPerils).toContain("MOTORCYCLE_TRAVEL");
    });

    it("maps fence blew down to Boundary Fence and Storm", () => {
      const input = "My dividing fence blew down in the storm yesterday";
      const result = normalizeIntent(input);

      expect(result.canonicalTokens).toContain("Boundary Fence");
      expect(result.canonicalTokens).toContain("Storm");
      expect(result.detectedPerils).toContain("BOUNDARY_FENCE");
    });

    it("maps rainwater run-off vs riverine flood queries", () => {
      const input = "Is water run-off coming down the hill covered under storm or flood?";
      const result = normalizeIntent(input);

      expect(result.canonicalTokens).toContain("Rainwater Run-off");
      expect(result.canonicalTokens).toContain("Riverine Flood Disambiguation");
      expect(result.detectedPerils).toContain("RAINWATER_RUNOFF");
    });
  });

  describe("Sub-Millisecond Edge Performance Invariant", () => {
    it("normalizes queries in well under 1 millisecond", () => {
      const input = "Um so like a pipe burst in my ensuite and ruined the floorboards, what do I do?";
      const start = performance.now();
      const result = normalizeIntent(input);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1.0); // Strict sub-ms invariant
      expect(result.durationMs).toBeLessThan(1.0);
    });
  });
});
