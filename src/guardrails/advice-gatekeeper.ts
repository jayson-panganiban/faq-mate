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
  /\b(should I (buy|switch|cancel|choose|pick|get|go with))\b/i,
  /\bshould I\b.*\b(switch|cancel)\b/i,
  /\bwhich\s+(?:policy|insurer|insurance(?:\s+company)?|brand|cover)\s+is\s+(?:best|better|cheaper|preferable)\s+(?:for\s+)?(?:me|my\s+budget|my\s+situation)\b/i,
  /\b(which policy is (best|better) for me)\b/i,
  BRAND_COMPARISON_ADVICE_REGEX,
  /\b(recommend (me|a policy|an insurer|insurance for me))\b/i,
  /\bi earn \$?\d+/i,
  /\bmy budget is\b/i,
  /\b(is \$?\d+ excess too (high|low) for me)\b/i,
  /\bwhich policy suits (me|my budget|my car|my situation)\b/i,
  /\bwhich (policy|cover) should I (buy|take|choose|pick)\b/i,
  /\b(is\s+it\s+better\s+for\s+me\s+to\s+(?:switch|buy|choose))\b/i,
  /\b(help\s+me\s+choose\s+(?:a\s+policy|between))\b/i,
];

/**
 * Patterns indicating conversational dilemmas (e.g. claim vs out-of-pocket, excess vs repair quote)
 * Under ASIC RG 244, these are permitted but reframed into objective decision criteria.
 */
const CONVERSATIONAL_DILEMMA_PATTERNS = [
  /\bshould I\s+(?:lodge\s+a\s+claim|make\s+a\s+claim|claim|file\s+a\s+claim)\s+or\s+(?:just\s+)?(?:pay\s+(?:out\s+of\s+pocket|myself|cash|for\s+it\s+myself|the\s+repairs\s+myself))\b/i,
  /\b(?:is\s+it\s+worth\s+claiming|worth\s+(?:lodging|making)\s+a\s+claim)\s+(?:on\s+insurance\s+)?(?:or|instead of)\s+(?:should I\s+)?(?:pay\s+(?:myself|out\s+of\s+pocket)|pay\s+it\s+myself)\b/i,
  /\b(?:is\s+it\s+worth\s+claiming|worth\s+(?:lodging|making)\s+a\s+claim)\b/i,
  /\bclaim\s+vs\s+pay\s+(?:out\s+of\s+pocket|myself)\b/i,
  /\b(?:should I|whether to)\s+(?:claim|lodge\s+a\s+claim)\s+(?:or|instead of)\b/i,
  /\b(?:repair\s+quote|repair\s+cost|excess)\b.*\b(?:pay\s+(?:out\s+of\s+pocket|myself)|repair\s+quote|excess)\b.*\b(?:claim|should I)\b/i,
  /\bshould I\s+(?:lodge\s+a\s+claim|make\s+a\s+claim|claim)\b.*\b(?:excess|repair\s+quote|out\s+of\s+pocket)\b/i,
];

/**
 * TMD / Eligibility Inquiry Patterns (PRD § 5.3)
 */
const TMD_ELIGIBILITY_PATTERNS = [
  /\b(who is this policy for|target market determination|tmd|am I eligible|eligibility criteria)\b/i,
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
 * Implements Spec 03 (Section 1 & 2) & Spec 07 (Section 4):
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

  // 2. ASIC RG 244 Personal Financial Advice Gate (Spec 03 Section 1 & Spec 07 Section 4)
  // Evaluated before dilemma matching to prevent compound switching traps (e.g. "claim or switch to Allianz")
  for (const pattern of PERSONAL_ADVICE_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: false,
        reason: "PERSONAL_ADVICE_REQUESTED",
        refusalMessage: STATUTORY_SAFE_HARBOR_REFUSAL,
      };
    }
  }

  // 3. Conversational Dilemma Gate (Spec 07 Section 4): Reframe to objective decision factors
  for (const pattern of CONVERSATIONAL_DILEMMA_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: true,
        sanitizedQuery: query.trim(),
        detectedIntent: "CONVERSATIONAL_DILEMMA",
      };
    }
  }

  // 4. TMD / Eligibility Factual Inquiry (PRD § 5.3)
  for (const pattern of TMD_ELIGIBILITY_PATTERNS) {
    if (pattern.test(query)) {
      return {
        allowed: true,
        sanitizedQuery: query.trim(),
        detectedIntent: "TMD_ELIGIBILITY_INQUIRY",
      };
    }
  }

  // 5. Permitted Factual Query
  return {
    allowed: true,
    sanitizedQuery: query.trim(),
    detectedIntent: "FACTUAL_PRODUCT_INQUIRY",
  };
}
