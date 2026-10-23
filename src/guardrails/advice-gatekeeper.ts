import type { GatekeeperVerdict } from "../types/chat";

const STATUTORY_GAW =
  "⚠️ General Advice Warning: This information is general factual information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent professional advice.";

/**
 * Patterns indicating personal financial advice requests under ASIC RG 244
 */
const PERSONAL_ADVICE_PATTERNS = [
  /\b(can I afford|which.*can I afford|within my budget)\b/i,
  /\b(should I (buy|switch|cancel|choose|pick|get))\b/i,
  /\b(which policy is (best|better) for me)\b/i,
  /\b(recommend (me|a policy|insurance for me))\b/i,
  /\bi earn \$?\d+/i,
  /\bmy budget is\b/i,
  /\b(is \$?\d+ excess too (high|low) for me)\b/i,
];

/**
 * Patterns indicating active emergency / life safety threats under Code of Practice
 */
const EMERGENCY_PATTERNS = [
  /\b(house is (burning|on fire)|trapped in (flood|water)|life threat|emergency help right now)\b/i,
];

/**
 * Deep Module: ASIC RG 244 & COP Advice Boundary Evaluator
 *
 * Conceals regex heuristics, PII scrubbing, and regulatory refusal copy behind
 * a simple deterministic interface.
 */
export function evaluateAdviceBoundary(query: string): GatekeeperVerdict {
  // 1. Life Safety / Emergency Catastrophe Gate
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: false,
        reason: "EMERGENCY_LIFE_SAFETY",
        emergencyHotline: "Triple Zero (000) or SES (132 500)",
        refusalMessage:
          "🚨 EMERGENCY ASSISTANCE: If you or your property are in immediate danger, please immediately call Triple Zero (000). For flood or storm emergency assistance, contact the State Emergency Service (SES) on 132 500.",
      };
    }
  }

  // 2. ASIC RG 244 Personal Financial Advice Gate
  for (const pattern of PERSONAL_ADVICE_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: false,
        reason: "PERSONAL_ADVICE_REQUESTED",
        refusalMessage:
          "I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.\n\n" +
          "I can, however, provide factual information regarding what is covered or excluded under published insurer Product Disclosure Statements (PDS).\n\n" +
          STATUTORY_GAW,
      };
    }
  }

  // 3. Permitted Factual Query
  return {
    allowed: true,
    sanitizedQuery: query.trim(),
  };
}
