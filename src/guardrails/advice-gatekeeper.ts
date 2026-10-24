import { BRAND_COMPARISON_ADVICE_REGEX } from "../constants/insurers";
import {
  EMERGENCY_HOTLINES,
  EMERGENCY_REFUSAL_MESSAGE,
  STATUTORY_SAFE_HARBOR_REFUSAL,
} from "../constants/statutory";
import type { GatekeeperVerdict } from "../types/chat";

/**
 * Heuristics indicating personal financial advice requests under ASIC RG 244 & Corporations Act 2001
 */
const PERSONAL_ADVICE_PATTERNS = [
  /\b(can I afford|which.*can I afford|within my budget)\b/i,
  /\b(should I (buy|switch|cancel|choose|pick|get))\b/i,
  /\b(which policy is (best|better) for me)\b/i,
  BRAND_COMPARISON_ADVICE_REGEX,
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
        emergencyHotline: EMERGENCY_HOTLINES.summary,
        refusalMessage: EMERGENCY_REFUSAL_MESSAGE,
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
