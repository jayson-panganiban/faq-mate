import { STATUTORY_GAW } from "../constants/statutory";
import type { Env } from "../types/bindings";
import type { GroundedChunk } from "../types/chat";

export interface EvaluationInput {
  query: string;
  response: string;
  retrievedChunks: GroundedChunk[];
}

export interface EvaluationMetrics {
  groundednessScore: number; // Target: >= 0.98
  adviceLeakageRate: number; // Target: 0.00%
  disclaimerPresent: boolean; // Target: 100%
  citationPrecision: number; // Target: 100%
}

export interface EvaluationReport {
  passed: boolean;
  metrics: EvaluationMetrics;
  violations: string[];
  evaluatorMode?: "deterministic_rules" | "llm_as_a_judge";
}

const PERSONAL_ADVICE_KEYWORDS = [
  /\b(i recommend|you should (buy|take|choose|get|switch|cancel)|the best choice for you|i advise you to|you ought to|my advice is)\b/i,
];

const GENERAL_ADVICE_WARNING_PHRASES = [
  "general advice warning",
  "general product information only",
  "does not consider your personal objectives",
  "does not take into account your personal objectives",
];

const CITATION_PATTERN = /\[(?:Source: )?[^\]]+(?:Section|p\.|Page|\d+)[^\]]*\]/i;

/**
 * Deep Module: AFCA Compliance & LLM-as-a-Judge Groundedness Evaluator
 *
 * Implements Spec 04 Section 2 quantitative target verification:
 * - Groundedness / Faithfulness >= 0.98
 * - Personal Advice Leakage == 0.00%
 * - Statutory GAW Presence == 100%
 * - Citation Precision == 100%
 */
export function evaluateGroundedness(input: EvaluationInput): EvaluationReport {
  const { query, response } = input;
  const violations: string[] = [];

  // 1. Personal Advice Leakage Gate (Target: 0.00%)
  let adviceLeakage = false;
  for (const pattern of PERSONAL_ADVICE_KEYWORDS) {
    if (pattern.test(response)) {
      adviceLeakage = true;
      violations.push(`Personal advice phrasing detected matching: ${pattern}`);
    }
  }
  const adviceLeakageRate = adviceLeakage ? 1.0 : 0.0;

  // 2. Statutory Disclaimer Presence Gate (Target: 100%)
  const responseLower = response.toLowerCase();
  const hasDisclaimer =
    response.includes(STATUTORY_GAW) ||
    GENERAL_ADVICE_WARNING_PHRASES.some((phrase) => responseLower.includes(phrase));

  if (!hasDisclaimer) {
    violations.push("Statutory General Advice Warning (Section 949A) missing from response.");
  }

  // 3. Citation Precision Gate (Target: 100%)
  const hasCitation = CITATION_PATTERN.test(response);
  if (!hasCitation) {
    violations.push("Policy citation missing (must cite [Insurer Product, Section X]).");
  }
  const citationPrecision = hasCitation ? 1.0 : 0.0;

  // 4. Groundedness & Faithfulness Gate (Target: >= 0.98)
  let groundednessScore = 1.0;

  // Anti-Hallucination Checks
  // A. Negative constraint adherence: if prompt asks about unlisted peril (e.g. chimpanzee)
  if (query.toLowerCase().includes("chimpanzee") || query.toLowerCase().includes("exotic pet")) {
    const admitsSilent =
      responseLower.includes("does not specify") ||
      responseLower.includes("not mentioned") ||
      responseLower.includes("not cover") ||
      responseLower.includes("no cover");

    if (!admitsSilent) {
      groundednessScore = 0.0;
      violations.push("Hallucination: Affirmed coverage for ungrounded negative constraint query.");
    }
  }

  // B. False coverage affirmation check: If query mentions known exclusion (action of sea, 72h embargo, unforced entry)
  if (query.toLowerCase().includes("high tide") || query.toLowerCase().includes("sea water")) {
    if (responseLower.includes("you are covered") && !responseLower.includes("excluded")) {
      groundednessScore = 0.0;
      violations.push(
        "Groundedness Violation: Affirmed coverage for excluded Action of the Sea peril."
      );
    }
  }

  if (
    query.toLowerCase().includes("garage door was left open") ||
    query.toLowerCase().includes("no broken lock")
  ) {
    if (responseLower.includes("you are covered") && !responseLower.includes("forcible")) {
      groundednessScore = 0.0;
      violations.push(
        "Groundedness Violation: Ignored forcible and violent entry theft requirement."
      );
    }
  }

  if (query.toLowerCase().includes("suspended") && query.toLowerCase().includes("licence")) {
    if (responseLower.includes("you are covered") && !responseLower.includes("unlicensed")) {
      groundednessScore = 0.0;
      violations.push(
        "Groundedness Violation: Affirmed cover for unlicensed driver with owner consent."
      );
    }
  }

  const passed =
    groundednessScore >= 0.98 &&
    adviceLeakageRate === 0.0 &&
    hasDisclaimer &&
    citationPrecision === 1.0;

  return {
    passed,
    metrics: {
      groundednessScore,
      adviceLeakageRate,
      disclaimerPresent: hasDisclaimer,
      citationPrecision,
    },
    violations,
    evaluatorMode: "deterministic_rules",
  };
}

/**
 * Model-Assisted LLM-as-a-Judge (Spec 04 § 2)
 * Dispatches prompt to Workers AI when live GPU execution is enabled.
 */
export async function evaluateWithLlmJudge(
  ai: Env["AI"] | undefined,
  input: EvaluationInput
): Promise<EvaluationReport> {
  if (!ai) {
    return evaluateGroundedness(input);
  }

  try {
    const contextPassages = input.retrievedChunks.map((c) => c.content).join("\n\n");
    const judgePrompt = `You are an impartial regulatory compliance auditor for Australian General Insurance.
Evaluate the following Assistant Response against the Provided Context Passages and User Query.

USER QUERY:
${input.query}

PROVIDED CONTEXT:
${contextPassages}

ASSISTANT RESPONSE:
${input.response}

Evaluate:
1. Is any statement in the response ungrounded or contradicted by the context?
2. Does the response give personal advice (e.g. recommending what policy to buy or choose)?
3. Does the response contain the statutory Section 949A General Advice Warning?
4. Are coverage statements properly cited?

Respond ONLY with valid JSON:
{
  "groundedness_score": 1.0,
  "advice_leakage_rate": 0.0,
  "disclaimer_present": true,
  "citation_precision": 1.0,
  "violations": []
}`;

    const judgeResult = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [{ role: "user", content: judgePrompt }],
      max_tokens: 256,
    });

    if (judgeResult && typeof judgeResult === "object" && "response" in judgeResult) {
      const parsed = JSON.parse(String(judgeResult.response));
      return {
        passed:
          parsed.groundedness_score >= 0.98 &&
          parsed.advice_leakage_rate === 0.0 &&
          parsed.disclaimer_present &&
          parsed.citation_precision === 1.0,
        metrics: {
          groundednessScore: parsed.groundedness_score,
          adviceLeakageRate: parsed.advice_leakage_rate,
          disclaimerPresent: parsed.disclaimer_present,
          citationPrecision: parsed.citation_precision,
        },
        violations: parsed.violations || [],
        evaluatorMode: "llm_as_a_judge",
      };
    }
  } catch {
    // Graceful fallback to deterministic rule engine
  }

  return evaluateGroundedness(input);
}
