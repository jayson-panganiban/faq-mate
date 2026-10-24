import type { GroundedChunk } from "../types/chat";

interface SuggestionTopic {
  condition: (queryLower: string, chunks: GroundedChunk[], perils: string[]) => boolean;
  prompts: string[];
}

/**
 * Topic mapping rules for generating grounded statutory follow-up prompt chips (Spec 07 Section 6)
 */
const TOPIC_SUGGESTIONS: readonly SuggestionTopic[] = [
  {
    condition: (q, chunks, perils) =>
      perils.includes("EMBARGO_72_HOUR") ||
      q.includes("flood") ||
      q.includes("bushfire") ||
      chunks.some(
        (c) =>
          c.content.toLowerCase().includes("72-hour") ||
          c.content.toLowerCase().includes("embargo")
      ),
    prompts: [
      "What is the 72-hour flood embargo?",
      "Does the 72-hour waiting period apply to policy renewals?",
      "How does escape of liquid differ from storm run-off?",
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("ESCAPE_OF_LIQUID") ||
      perils.includes("RAINWATER_RUNOFF") ||
      q.includes("burst pipe") ||
      q.includes("water damage") ||
      chunks.some((c) => c.content.toLowerCase().includes("escape of liquid")),
    prompts: [
      "How does escape of liquid differ from storm run-off?",
      "Does home insurance cover repairing the burst pipe itself?",
      "What is the difference between building and contents water cover?",
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("JEWELRY_SUBLIMIT") ||
      q.includes("jewelry") ||
      q.includes("jewellery") ||
      q.includes("ring") ||
      q.includes("watch") ||
      chunks.some(
        (c) =>
          c.content.toLowerCase().includes("jewelry") ||
          c.content.toLowerCase().includes("sub-limit")
      ),
    prompts: [
      "What sub-limits apply to jewelry and valuables?",
      "How do I specify high-value items on my certificate of insurance?",
      "Does accidental loss away from home require portable contents cover?",
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("THEFT_FORCIBLE_ENTRY") ||
      q.includes("theft") ||
      q.includes("stolen") ||
      q.includes("break in") ||
      chunks.some((c) => c.content.toLowerCase().includes("forcible")),
    prompts: [
      "What counts as violent and forcible entry for theft claims?",
      "Are items stolen from an open driveway or carport covered?",
      "What evidence is required when reporting a theft to police?",
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("FOOD_SPOILAGE") ||
      q.includes("blackout") ||
      q.includes("food") ||
      q.includes("fridge") ||
      chunks.some((c) => c.content.toLowerCase().includes("spoilage")),
    prompts: [
      "Is food spoilage covered under home building or contents only?",
      "What is the dollar sub-limit for refrigerated food spoilage?",
      "Do I have to pay an excess for a food spoilage claim?",
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("MOTORCYCLE_TRAVEL") ||
      q.includes("scooter") ||
      q.includes("moped") ||
      q.includes("travel insurance"),
    prompts: [
      "What engine capacity limits apply to overseas scooter rentals?",
      "Do I need an Australian motorcycle licence to ride overseas?",
      "Are medical expenses covered if I crash a rental moped?",
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("UNLICENSED_DRIVER") ||
      q.includes("unlicensed") ||
      q.includes("driver") ||
      q.includes("car insurance") ||
      q.includes("excess"),
    prompts: [
      "What is the difference between basic excess and unlisted driver excess?",
      "Does car insurance cover an unlicensed or suspended driver?",
      "How does a no-claim bonus affect my annual renewal premium?",
    ],
  },
];

const DEFAULT_SUGGESTIONS: readonly string[] = [
  "What is the 72-hour flood embargo?",
  "How does escape of liquid differ from storm run-off?",
  "What sub-limits apply to jewelry and valuables?",
  "How does basic excess work when lodging a claim?",
  "What is the difference between building and contents insurance?",
];

/**
 * Deep Module: Dynamic Follow-Up Prompt Suggestions Generator
 *
 * Implements Spec 07 Section 6:
 * Deterministically generates 2–3 contextual statutory follow-up prompt chips
 * derived from retrieved chunk metadata, peril tags, and policy carve-outs.
 */
export function generateFollowUpSuggestions(
  query: string,
  chunks: GroundedChunk[],
  detectedPerils: string[] = []
): string[] {
  const queryLower = query.toLowerCase().trim();
  const selected: string[] = [];

  for (const topic of TOPIC_SUGGESTIONS) {
    if (topic.condition(queryLower, chunks, detectedPerils)) {
      for (const prompt of topic.prompts) {
        if (
          prompt.toLowerCase() !== queryLower &&
          !selected.includes(prompt) &&
          !prompt.toLowerCase().includes(queryLower) &&
          !queryLower.includes(prompt.toLowerCase())
        ) {
          selected.push(prompt);
          if (selected.length === 3) break;
        }
      }
    }
    if (selected.length === 3) break;
  }

  // Backfill with default statutory suggestions to ensure 2-3 suggestions
  for (const fallback of DEFAULT_SUGGESTIONS) {
    if (selected.length >= 3) break;
    if (
      fallback.toLowerCase() !== queryLower &&
      !selected.includes(fallback) &&
      !fallback.toLowerCase().includes(queryLower) &&
      !queryLower.includes(fallback.toLowerCase())
    ) {
      selected.push(fallback);
    }
  }

  return selected.slice(0, 3);
}
