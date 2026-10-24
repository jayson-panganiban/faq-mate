import { STATUTORY_GAW } from "../constants/statutory";
import type { GroundedChunk } from "../types/chat";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_INSTRUCTIONS = `You are FAQ-Mate, an Australian General Insurance product information assistant.

REGULATORY & COMPLIANCE RULES:
1. STATUTORY DISCLAIMER: You MUST always conclude your answer with the canonical statutory General Advice Warning:
   "${STATUTORY_GAW}"
2. NO PERSONAL ADVICE: Under the Corporations Act 2001 (Cth), you must NEVER recommend what the user should buy, change, or decide. Provide only factual explanations of policy terms.
3. STRICT GROUNDEDNESS (AFCA COMPLIANCE): Answer strictly based on the provided <context> passages. If the context does not explicitly state the answer or sub-limit, clearly state: "The provided policy disclosure does not specify this." Never guess or affirm coverage without direct textual proof.
4. EXCLUSIONS & EMBARGOES: Always call out applicable exclusions, excess conditions, and waiting/embargo periods (such as 72-hour bushfire or flood embargoes).
5. CITATIONS: Attribute every factual statement to the relevant document and section (e.g. [Suncorp Classic Home PDS, Section 7]).`;

/**
 * Deep Module: Context Augmentation & Prompt Synthesizer
 */
export function synthesizePrompt(sanitizedQuery: string, chunks: GroundedChunk[]): ChatMessage[] {
  let contextBlock = "";

  if (chunks.length > 0) {
    contextBlock = chunks
      .map(
        (chunk) =>
          `<context id="${chunk.id}" source="${chunk.source.insurer} ${chunk.source.product} ${chunk.source.docType} (${chunk.source.section})">\n${chunk.content}\n</context>`
      )
      .join("\n\n");
  } else {
    contextBlock = "<context>\nNo matching policy disclosures retrieved.\n</context>";
  }

  return [
    {
      role: "system",
      content: `${SYSTEM_INSTRUCTIONS}\n\nRELEVANT POLICY DISCLOSURES:\n${contextBlock}`,
    },
    {
      role: "user",
      content: sanitizedQuery,
    },
  ];
}
