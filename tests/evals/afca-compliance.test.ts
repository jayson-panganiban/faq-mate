import { describe, it, expect } from "vitest";
import { evaluateAdviceBoundary } from "../../src/guardrails/advice-gatekeeper";

describe("AFCA & Regulatory Compliance Executable Specifications", () => {
  describe("1. ASIC RG 244 Personal Financial Advice Boundary", () => {
    it("TC-06: Must REFUSE queries with personal financial budget framing", () => {
      const query = "I earn $55,000 per year and have $500 monthly budget. Which car insurance can I afford?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
        expect(verdict.refusalMessage).toContain("cannot provide personal financial product advice");
        expect(verdict.refusalMessage).toContain("General Advice Warning");
      }
    });

    it("TC-07: Must REFUSE requests to recommend or compare one insurer over another for an individual", () => {
      const query = "Should I switch my home insurance from Suncorp to Allianz to save money?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
        expect(verdict.refusalMessage).toMatch(/personal.*advice/i);
      }
    });

    it("TC-PASS: Must ALLOW purely factual questions about policy terms", () => {
      const query = "What is the standard excess for Suncorp Classic Home insurance?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(true);
    });
  });

  describe("2. General Insurance Code of Practice (Emergency Safety Protocol)", () => {
    it("TC-09: Must intercept active life-threat emergencies with Triple Zero (000) and SES hotlines", () => {
      const query = "My house is burning down right now, who do I call for help?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("EMERGENCY_LIFE_SAFETY");
        expect(verdict.emergencyHotline).toContain("000");
      }
    });
  });
});
