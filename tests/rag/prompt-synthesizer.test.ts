import { describe, expect, it } from "vitest";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import { synthesizePrompt } from "../../src/rag/prompt-synthesizer";
import type { GroundedChunk } from "../../src/types/chat";

describe("Product-Line Disambiguation & Prompt Synthesis (Ticket 04 & Spec 07)", () => {
  const dummyChunk: GroundedChunk = {
    id: "SUNCORP-home-pds-01",
    relevanceScore: 0.95,
    content: "Escape of liquid covers sudden discharge from fixed internal pipes.",
    source: {
      insurer: "SUNCORP",
      product: "Classic Home",
      docType: "PDS",
      section: "Insured Event 4",
    },
  };

  it("includes STATUTORY_GAW, product demarcation, and advice rules in system prompt", () => {
    const messages = synthesizePrompt("What does escape of liquid cover?", [dummyChunk]);

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain(STATUTORY_GAW);
    expect(messages[0].content).toContain("PRODUCT LINE DEMARCATION");
    expect(messages[0].content).toContain("NO PERSONAL ADVICE");
    expect(messages[0].content).toContain("Escape of liquid covers sudden discharge");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toBe("What does escape of liquid cover?");
  });

  it("injects multi-turn conversation history chronologically before active query", () => {
    const history = [
      {
        role: "user" as const,
        content: "What does Suncorp cover for storm damage?",
      },
      {
        role: "assistant" as const,
        content: "Suncorp covers storm damage to your home building and contents.",
      },
    ];

    const messages = synthesizePrompt(
      "Does that include flood or rainwater run-off?",
      [dummyChunk],
      {
        history,
      }
    );

    expect(messages.length).toBe(4);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toBe("What does Suncorp cover for storm damage?");
    expect(messages[2].role).toBe("assistant");
    expect(messages[2].content).toBe(
      "Suncorp covers storm damage to your home building and contents."
    );
    expect(messages[3].role).toBe("user");
    expect(messages[3].content).toBe("Does that include flood or rainwater run-off?");
  });

  it("adds conversational dilemma guidance when intent is CONVERSATIONAL_DILEMMA", () => {
    const messages = synthesizePrompt("Should I claim or pay out of pocket?", [dummyChunk], {
      detectedIntent: "CONVERSATIONAL_DILEMMA",
    });

    expect(messages[0].content).toContain("CONVERSATIONAL DILEMMA");
    expect(messages[0].content).toContain("objective decision factors");
  });

  it("enforces the 5-Part Australian Insurance Specialist Response Anatomy and bans meta-RAG phrasing (Spec 08)", () => {
    const messages = synthesizePrompt("What is flood definition for NRMA?", [dummyChunk]);
    const sys = messages[0].content;

    expect(sys).toContain("1. DIRECT DEFINITION OR COVERAGE POSITION");
    expect(sys).toContain("2. RELATED EVENT & PRODUCT LINE DEMARCATION");
    expect(sys).toContain("3. CRITICAL EXCLUSIONS, WAITING PERIODS & SUB-LIMITS");
    expect(sys).toContain("4. CERTIFICATE OF INSURANCE (POLICY SCHEDULE) CONTEXT");
    expect(sys).toContain("5. PROVENANCE CITATIONS, NO PERSONAL ADVICE & STATUTORY DISCLAIMER");
    expect(sys).toContain('Never use tentative or meta-RAG phrasing ("in the provided context"');
  });

  it("injects off-topic override when query is unrelated to insurance and no chunks are retrieved", () => {
    const messages = synthesizePrompt("What is adobo?", []);
    const sys = messages[0].content;

    expect(sys).toContain("OFF-TOPIC / NON-INSURANCE INQUIRY DETECTED");
    expect(sys).toContain("DO NOT apply the 5-part insurance anatomy above");
  });
});
