import { STATUTORY_GAW } from "../constants/statutory";
import type { GroundedChunk } from "../types/chat";
import type { InsurancePeril } from "./intent-normalizer";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SynthesizePromptOptions {
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  detectedIntent?: "FACTUAL_PRODUCT_INQUIRY" | "TMD_ELIGIBILITY_INQUIRY" | "CONVERSATIONAL_DILEMMA";
  detectedPerils?: InsurancePeril[];
  canonicalTokens?: string[];
}

const BASE_SYSTEM_INSTRUCTIONS = `You are FAQ-Mate, an Australian General Insurance product information assistant.

REGULATORY & COMPLIANCE RULES:
1. STATUTORY DISCLAIMER: You MUST always conclude your answer with the canonical statutory General Advice Warning:
   "${STATUTORY_GAW}"
2. NO PERSONAL ADVICE: Under the Corporations Act 2001 (Cth), you must NEVER recommend what the user should buy, change, or decide. Provide only factual explanations of policy terms.
3. PRODUCT LINE DEMARCATION: When inquiries touch broad perils or ambiguous boundaries (e.g. water damage, storm, food spoilage, theft from vehicles), structure your response with dedicated Markdown headings explicitly delineating coverage across Home Building, Contents, Landlord, and Motor policies.
4. STRICT GROUNDEDNESS (AFCA COMPLIANCE): Answer strictly based on the provided <context> passages. If the context does not explicitly state the answer or sub-limit, clearly state: "The provided policy disclosure does not specify this." Never guess or affirm coverage without direct textual proof.
5. EXCLUSIONS & EMBARGOES: Always call out applicable exclusions, excess conditions, and waiting/embargo periods (such as 72-hour bushfire or flood embargoes, wear-and-tear exclusions, unforced entry exclusions).
6. CITATIONS: Attribute every factual statement to the relevant document and section (e.g. [Suncorp Classic Home PDS, Section 7]).`;

const CONVERSATIONAL_DILEMMA_INSTRUCTIONS = `
7. CONVERSATIONAL DILEMMA GUIDANCE: The user is asking a personal dilemma inquiry (e.g., whether to lodge a claim vs pay out of pocket). Under ASIC RG 244, you MUST NOT advise or decide for the user. Instead:
   - State clearly that you cannot advise whether to claim or pay out of pocket as this constitutes personal financial advice.
   - Outline the objective decision factors: (a) basic excess vs estimated repair cost, (b) impact on future No-Claim Bonus (NCB) or renewal rating, (c) exclusions for gradual wear and tear or lack of maintenance, (d) claims history.
   - Never say "You should lodge a claim" or "You should pay out of pocket".`;

/**
 * Deep Module: Context Augmentation & Prompt Synthesizer
 *
 * Implements Spec 02 & Spec 07 Section 4:
 * Assembles system prompts with statutory compliance invariants, product-line
 * demarcation instructions, multi-turn conversation history, and retrieved context chunks.
 */
export function synthesizePrompt(
  sanitizedQuery: string,
  chunks: GroundedChunk[],
  options?: SynthesizePromptOptions
): ChatMessage[] {
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

  let systemPrompt = `${BASE_SYSTEM_INSTRUCTIONS}`;
  if (options?.detectedIntent === "CONVERSATIONAL_DILEMMA") {
    systemPrompt += CONVERSATIONAL_DILEMMA_INSTRUCTIONS;
  }
  if (options?.detectedPerils && options.detectedPerils.length > 0) {
    systemPrompt += `\n\n8. DETECTED PERILS & POLICY EVENTS: The user inquiry specifically touches upon: ${options.detectedPerils.join(", ")}. Ensure coverage terms, exclusions, and sub-limits for these perils are clearly addressed.`;
  }
  systemPrompt += `\n\nRELEVANT POLICY DISCLOSURES:\n${contextBlock}`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  if (options?.history && options.history.length > 0) {
    for (const turn of options.history) {
      messages.push({
        role: turn.role,
        content: turn.content,
      });
    }
  }

  messages.push({
    role: "user",
    content: sanitizedQuery,
  });

  return messages;
}
