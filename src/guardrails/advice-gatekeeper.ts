import type { GatekeeperVerdict } from "../types/chat";

const STATUTORY_SAFE_HARBOR_REFUSAL =
  "I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.\n" +
  "I can, however, provide factual information regarding what is covered or excluded under published Product Disclosure Statements (PDS).\n\n" +
  "⚠️ General Advice Warning: Any information provided is general factual information only and does not consider your personal objectives, financial situation, or needs. Please review the relevant PDS and TMD before making a decision.";

/**
 * Heuristics indicating personal financial advice requests under ASIC RG 244 & Corporations Act 2001
 */
const PERSONAL_ADVICE_PATTERNS = [
  /\b(can I afford|which.*can I afford|within my budget)\b/i,
  /\b(should I (buy|switch|cancel|choose|pick|get))\b/i,
  /\b(which policy is (best|better) for me)\b/i,
  /\b(is (suncorp|nrma|allianz|qbe|youi) (better|best) (than|for))\b/i,
  /\b(recommend (me|a policy|insurance for me))\b/i,
  /\bi earn \$?\d+/i,
  /\bmy budget is\b/i,
  /\b(is \$?\d+ excess too (high|low) for me)\b/i,
  /\bwhich policy suits (me|my budget|my car|my situation)\b/i,
  /\bwhich (policy|cover) should I (buy|take|choose)\b/i,
];

/**
 * Patterns indicating active emergency / life safety threats under Code of Practice (COP)
 */
const EMERGENCY_PATTERNS = [
  /\b(house is (burning|on fire)|trapped in (flood|floodwater|water)|life threat|emergency help right now|emergency shelter|active bushfire at my house)\b/i,
];

/**
 * Deep Module: ASIC RG 244 & COP Advice Boundary Evaluator
 *
 * Implements Spec 03 (Section 1 & 2):
 * Conceals regex heuristics, emergency escalation, and regulatory safe harbor copy.
 */
export function evaluateAdviceBoundary(query: string): GatekeeperVerdict {
  // 1. Life Safety / Emergency Catastrophe Gate (Spec 03 Section 2)
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: false,
        reason: "EMERGENCY_LIFE_SAFETY",
        emergencyHotline: "Triple Zero (000), SES (132 500), or Disaster Welfare Services (1800 018 444)",
        refusalMessage:
          "🚨 EMERGENCY ASSISTANCE: If you or your property are in immediate life danger, please immediately call Triple Zero (000).\n" +
          "• For storm or flood emergency assistance, contact the State Emergency Service (SES) on 132 500.\n" +
          "• For emergency accommodation and disaster support, contact Disaster Welfare Services on 1800 018 444.",
      };
    }
  }

  // 2. ASIC RG 244 Personal Financial Advice Gate (Spec 03 Section 1)
  for (const pattern of PERSONAL_ADVICE_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: false,
        reason: "PERSONAL_ADVICE_REQUESTED",
        refusalMessage: STATUTORY_SAFE_HARBOR_REFUSAL,
      };
    }
  }

  // 3. Permitted Factual Query
  return {
    allowed: true,
    sanitizedQuery: query.trim(),
  };
}
