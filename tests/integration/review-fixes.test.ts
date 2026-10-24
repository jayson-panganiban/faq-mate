import { describe, expect, it } from "vitest";
import { sanitizePii } from "../../src/guardrails/pii-sanitizer";
import { generateFollowUpSuggestions } from "../../src/rag/follow-up-generator";
import {
  enrichRetrievalQuery,
  extractInsurerFromQuery,
  normalizeIntent,
} from "../../src/rag/intent-normalizer";
import type { GroundedChunk } from "../../src/types/chat";

describe("Review Findings Regression Suite (Spec & Standards Fixes)", () => {
  describe("1. Multi-Insurer Query Disambiguation (Spec Issue 1)", () => {
    it("returns single insurer when only one brand is mentioned", () => {
      expect(extractInsurerFromQuery("What does Suncorp cover for flood?")).toBe("suncorp");
      expect(extractInsurerFromQuery("Coles car insurance coverage")).toBe("cgu");
    });

    it("returns undefined for multi-brand comparison queries to prevent biased single-insurer filtering", () => {
      // Comparison queries must retrieve chunks across all mentioned insurers
      const result = extractInsurerFromQuery("How do Suncorp and Allianz treat storm surge?");
      expect(result).toBeUndefined();
    });
  });

  describe("2. Mid-Sentence Voice Filler Stripping (Spec Issue 2)", () => {
    it("strips mid-sentence 'like' speech-to-text filler words", () => {
      const normalized = normalizeIntent("The pipe was like ruined by water");
      expect(normalized.cleanedQuery).toBe("The pipe was ruined by water");
    });

    it("strips compound voice fillers mid-sentence", () => {
      const normalized = normalizeIntent("The roof was so basically like leaking yesterday");
      expect(normalized.cleanedQuery).toBe("The roof was leaking yesterday");
    });
  });

  describe("3. Follow-Up Generator Substring Eligibility (Spec Issue 3)", () => {
    const mockChunks: GroundedChunk[] = [
      {
        id: "chunk-excess",
        relevanceScore: 0.9,
        content:
          "Basic excess applies to all building claims. An unlisted driver excess applies for motor claims.",
        source: {
          insurer: "Suncorp",
          product: "Comprehensive Home & Motor",
          docType: "PDS",
          section: "Excess Structure",
        },
      },
    ];

    it("does not reject relevant follow-up prompts merely because they contain a query keyword like 'excess'", () => {
      const suggestions = generateFollowUpSuggestions("excess", mockChunks);
      expect(suggestions).toContain(
        "What is the difference between basic excess and unlisted driver excess?"
      );
    });

    it("still filters out suggestions that are identical or virtually identical to the query", () => {
      const suggestions = generateFollowUpSuggestions(
        "What is the difference between basic excess and unlisted driver excess?",
        mockChunks
      );
      expect(suggestions).not.toContain(
        "What is the difference between basic excess and unlisted driver excess?"
      );
    });
  });

  describe("4. Context Enrichment Across Assistant Turns (Spec Issue 4)", () => {
    it("enriches follow-up pronoun inquiries using concepts introduced in assistant turns", () => {
      const history = [
        {
          role: "user" as const,
          content: "What is flood cover?",
        },
        {
          role: "assistant" as const,
          content:
            "Suncorp provides flood cover subject to a 72-hour embargo after policy purchase.",
        },
      ];

      const enriched = enrichRetrievalQuery("Does that 72-hour rule apply to renewals?", history);
      expect(enriched.toLowerCase()).toContain("72-hour embargo");
    });
  });

  describe("5. PII Sanitizer Multi-Turn Property Consistency (Standards Smell 5)", () => {
    it("provides both 'sanitized' and 'sanitizedQuery' consistently across overloads", async () => {
      const singleTurn = await sanitizePii("Hello from NSW licence 12345678");
      expect(singleTurn.sanitized).toBeDefined();

      const multiTurn = await sanitizePii({
        query: "What about my claim?",
        history: [{ role: "user", content: "My phone is 0412 345 678" }],
      });
      expect(multiTurn.sanitized).toBeDefined();
      expect(multiTurn.sanitizedQuery).toBeDefined();
      expect(multiTurn.sanitized).toBe(multiTurn.sanitizedQuery);
    });
  });
});
