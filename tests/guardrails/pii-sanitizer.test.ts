import { describe, expect, it } from "vitest";
import { getDailySalt, sanitizePii } from "../../src/guardrails/pii-sanitizer";

describe("PII Sanitizer & Multi-Turn History Scrubbing (Spec 07 & APP 3/11)", () => {
  it("scrubs PII from a single query string", async () => {
    const dirty = "My TFN is 123 456 789 and my mobile is 0412 345 678";
    const res = await sanitizePii(dirty);

    expect(res.wasRedacted).toBe(true);
    expect(res.sanitized).toContain("[REDACTED_TFN]");
    expect(res.sanitized).toContain("[REDACTED_PHONE]");
    expect(res.sanitized).not.toContain("123 456 789");
    expect(res.sanitized).not.toContain("0412 345 678");
    expect(res.queryHash).toHaveLength(64);
  });

  it("scrubs PII across multi-turn conversation history while hashing only the latest query", async () => {
    const multiTurnInput = {
      query: "Does this policy cover my rental car excess?",
      history: [
        {
          role: "user" as const,
          content:
            "Hi, my name is John and my licence is NSW licence 12345678, medicare 21234567891",
        },
        {
          role: "assistant" as const,
          content:
            "Hello John, I can provide factual information on policy coverage. How can I help?",
        },
        {
          role: "user" as const,
          content: "I paid with credit card 4532 1234 5678 9010 and had an accident.",
        },
      ],
    };

    const res = await sanitizePii(multiTurnInput);

    expect(res.wasRedacted).toBe(true);
    expect(res.sanitizedQuery).toBe("Does this policy cover my rental car excess?");
    expect(res.sanitizedHistory).toHaveLength(3);
    expect(res.sanitizedHistory[0].content).toContain("[REDACTED_LICENCE]");
    expect(res.sanitizedHistory[0].content).toContain("[REDACTED_MEDICARE]");
    expect(res.sanitizedHistory[0].content).not.toContain("12345678");
    expect(res.sanitizedHistory[2].content).toContain("[REDACTED_CARD]");
    expect(res.sanitizedHistory[2].content).not.toContain("4532 1234 5678 9010");

    // Invariant: queryHash must only hash the latest sanitized query with daily salt
    const standaloneRes = await sanitizePii("Does this policy cover my rental car excess?");
    expect(res.queryHash).toBe(standaloneRes.queryHash);
  });

  it("handles multi-turn input with empty or omitted history", async () => {
    const res = await sanitizePii({
      query: "What is the excess for storm damage?",
    });

    expect(res.wasRedacted).toBe(false);
    expect(res.sanitizedQuery).toBe("What is the excess for storm damage?");
    expect(res.sanitizedHistory).toEqual([]);
    expect(res.queryHash).toHaveLength(64);
  });

  it("detects redaction if query is dirty even if history is clean", async () => {
    const res = await sanitizePii({
      query: "Call me on 02 9876 5432 regarding my claim",
      history: [{ role: "user", content: "Hello" }],
    });

    expect(res.wasRedacted).toBe(true);
    expect(res.sanitizedQuery).toContain("[REDACTED_PHONE]");
  });
});
