import { describe, expect, it } from "vitest";
import { evaluateAdviceBoundary } from "../../src/guardrails/advice-gatekeeper";

describe("ASIC RG 244 & Conversational Dilemma Guardrail (Ticket 02 & Spec 07)", () => {
  describe("Prohibited Personal Advice (Deterministic Safe-Harbor Refusal)", () => {
    it("refuses personal budget switching prompt 'Which insurer is better for my budget?'", () => {
      const verdict = evaluateAdviceBoundary("Which insurer is better for my budget?");
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
        expect(verdict.refusalMessage).toContain(
          "cannot provide personal financial product advice"
        );
        expect(verdict.refusalMessage).toContain("General Advice Warning");
      }
    });

    it("refuses policy recommendation prompt 'Which policy is best for my budget?'", () => {
      const verdict = evaluateAdviceBoundary("Which policy is best for my budget?");
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
      }
    });

    it("refuses brand switching recommendation 'Should I switch to Allianz or keep Suncorp?'", () => {
      const verdict = evaluateAdviceBoundary("Should I switch to Allianz or keep Suncorp?");
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
      }
    });

    it("refuses compound dilemma with switching trap 'Should I claim or switch to Allianz?'", () => {
      const verdict = evaluateAdviceBoundary("Should I claim or switch to Allianz?");
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
        expect(verdict.refusalMessage).toContain(
          "cannot provide personal financial product advice"
        );
      }
    });
  });

  describe("Conversational Dilemma Inquiries (Permitted Decision-Factor Framing)", () => {
    it("classifies 'Should I claim or pay out of pocket?' as CONVERSATIONAL_DILEMMA", () => {
      const verdict = evaluateAdviceBoundary("Should I claim or pay out of pocket?");
      expect(verdict.allowed).toBe(true);
      if (verdict.allowed) {
        expect(verdict.detectedIntent).toBe("CONVERSATIONAL_DILEMMA");
      }
    });

    it("classifies complex repair vs excess dilemma as CONVERSATIONAL_DILEMMA", () => {
      const query =
        "My roof is leaking and the repair quote is $3,500 while my excess is $1,000. Should I lodge a claim or just pay out of pocket?";
      const verdict = evaluateAdviceBoundary(query);
      expect(verdict.allowed).toBe(true);
      if (verdict.allowed) {
        expect(verdict.detectedIntent).toBe("CONVERSATIONAL_DILEMMA");
      }
    });

    it("classifies 'Is it worth claiming on insurance or should I pay myself?' as CONVERSATIONAL_DILEMMA", () => {
      const verdict = evaluateAdviceBoundary(
        "Is it worth claiming on insurance or should I pay myself?"
      );
      expect(verdict.allowed).toBe(true);
      if (verdict.allowed) {
        expect(verdict.detectedIntent).toBe("CONVERSATIONAL_DILEMMA");
      }
    });
  });

  describe("Permitted Factual Comparisons and Inquiries", () => {
    it("permits multi-insurer factual comparison 'How do Suncorp and Allianz treat storm surge?'", () => {
      const verdict = evaluateAdviceBoundary("How do Suncorp and Allianz treat storm surge?");
      expect(verdict.allowed).toBe(true);
      if (verdict.allowed) {
        expect(verdict.detectedIntent).toBe("FACTUAL_PRODUCT_INQUIRY");
      }
    });

    it("permits standard policy excess query 'What is the excess for flood damage?'", () => {
      const verdict = evaluateAdviceBoundary("What is the excess for flood damage?");
      expect(verdict.allowed).toBe(true);
      if (verdict.allowed) {
        expect(verdict.detectedIntent).toBe("FACTUAL_PRODUCT_INQUIRY");
      }
    });
  });
});
