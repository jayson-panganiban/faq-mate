import type { GroundedChunk } from "../types/chat";
import type { InsurancePeril } from "./intent-normalizer";

interface SuggestionTopic {
  condition: (queryLower: string, chunks: GroundedChunk[], perils: InsurancePeril[]) => boolean;
  prompts: string[];
}

function isEligiblePrompt(prompt: string, queryLower: string, selected: string[]): boolean {
  const pLower = prompt.toLowerCase().trim();
  const qTrimmed = queryLower.trim();

  // Do not suggest identical prompt or already selected
  if (pLower === qTrimmed || selected.includes(prompt)) {
    return false;
  }

  // Avoid echoing prompt when query is a full sentence containing or contained in prompt
  if (qTrimmed.length > 20 && pLower.includes(qTrimmed)) {
    return false;
  }
  if (pLower.length > 20 && qTrimmed.includes(pLower)) {
    return false;
  }

  return true;
}

/**
 * Canonical statutory follow-up prompt literals (Spec 07 Section 6)
 */
export const STATUTORY_PROMPTS = {
  EMBARGO_72_HOUR: "What is the 72-hour flood embargo?",
  EMBARGO_RENEWAL: "Does the 72-hour waiting period apply to policy renewals?",
  ESCAPE_DIFF_RUNOFF: "How does escape of liquid differ from storm run-off?",
  BURST_PIPE_REPAIR: "Does home insurance cover repairing the burst pipe itself?",
  BUILDING_VS_CONTENTS_WATER: "What is the difference between building and contents water cover?",
  JEWELRY_SUBLIMITS: "What sub-limits apply to jewelry and valuables?",
  SPECIFY_VALUABLES: "How do I specify high-value items on my certificate of insurance?",
  PORTABLE_CONTENTS: "Does accidental loss away from home require portable contents cover?",
  THEFT_FORCIBLE_ENTRY: "What counts as violent and forcible entry for theft claims?",
  THEFT_OPEN_DRIVEWAY: "Are items stolen from an open driveway or carport covered?",
  THEFT_POLICE_REPORT: "What evidence is required when reporting a theft to police?",
  FOOD_SPOILAGE_DEMARCATION: "Is food spoilage covered under home building or contents only?",
  FOOD_SPOILAGE_SUBLIMIT: "What is the dollar sub-limit for refrigerated food spoilage?",
  FOOD_SPOILAGE_EXCESS: "Do I have to pay an excess for a food spoilage claim?",
  SCOOTER_CAPACITY_LIMITS: "What engine capacity limits apply to overseas scooter rentals?",
  SCOOTER_LICENCE: "Do I need an Australian motorcycle licence to ride overseas?",
  SCOOTER_MEDICAL: "Are medical expenses covered if I crash a rental moped?",
  BASIC_VS_UNLISTED_EXCESS:
    "What is the difference between basic excess and unlisted driver excess?",
  UNLICENSED_DRIVER: "Does car insurance cover an unlicensed or suspended driver?",
  NO_CLAIM_BONUS: "How does a no-claim bonus affect my annual renewal premium?",
  BASIC_EXCESS_CLAIM: "How does basic excess work when lodging a claim?",
  BUILDING_VS_CONTENTS: "What is the difference between building and contents insurance?",
} as const;

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
          c.content.toLowerCase().includes("72-hour") || c.content.toLowerCase().includes("embargo")
      ),
    prompts: [
      STATUTORY_PROMPTS.EMBARGO_72_HOUR,
      STATUTORY_PROMPTS.EMBARGO_RENEWAL,
      STATUTORY_PROMPTS.ESCAPE_DIFF_RUNOFF,
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
      STATUTORY_PROMPTS.ESCAPE_DIFF_RUNOFF,
      STATUTORY_PROMPTS.BURST_PIPE_REPAIR,
      STATUTORY_PROMPTS.BUILDING_VS_CONTENTS_WATER,
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
      STATUTORY_PROMPTS.JEWELRY_SUBLIMITS,
      STATUTORY_PROMPTS.SPECIFY_VALUABLES,
      STATUTORY_PROMPTS.PORTABLE_CONTENTS,
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
      STATUTORY_PROMPTS.THEFT_FORCIBLE_ENTRY,
      STATUTORY_PROMPTS.THEFT_OPEN_DRIVEWAY,
      STATUTORY_PROMPTS.THEFT_POLICE_REPORT,
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
      STATUTORY_PROMPTS.FOOD_SPOILAGE_DEMARCATION,
      STATUTORY_PROMPTS.FOOD_SPOILAGE_SUBLIMIT,
      STATUTORY_PROMPTS.FOOD_SPOILAGE_EXCESS,
    ],
  },
  {
    condition: (q, chunks, perils) =>
      perils.includes("MOTORCYCLE_TRAVEL") ||
      q.includes("scooter") ||
      q.includes("moped") ||
      q.includes("travel insurance"),
    prompts: [
      STATUTORY_PROMPTS.SCOOTER_CAPACITY_LIMITS,
      STATUTORY_PROMPTS.SCOOTER_LICENCE,
      STATUTORY_PROMPTS.SCOOTER_MEDICAL,
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
      STATUTORY_PROMPTS.BASIC_VS_UNLISTED_EXCESS,
      STATUTORY_PROMPTS.UNLICENSED_DRIVER,
      STATUTORY_PROMPTS.NO_CLAIM_BONUS,
    ],
  },
];

const DEFAULT_SUGGESTIONS: readonly string[] = [
  STATUTORY_PROMPTS.EMBARGO_72_HOUR,
  STATUTORY_PROMPTS.ESCAPE_DIFF_RUNOFF,
  STATUTORY_PROMPTS.JEWELRY_SUBLIMITS,
  STATUTORY_PROMPTS.BASIC_EXCESS_CLAIM,
  STATUTORY_PROMPTS.BUILDING_VS_CONTENTS,
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
  detectedPerils: InsurancePeril[] = []
): string[] {
  const queryLower = query.toLowerCase().trim();
  const selected: string[] = [];

  for (const topic of TOPIC_SUGGESTIONS) {
    if (topic.condition(queryLower, chunks, detectedPerils)) {
      for (const prompt of topic.prompts) {
        if (isEligiblePrompt(prompt, queryLower, selected)) {
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
    if (isEligiblePrompt(fallback, queryLower, selected)) {
      selected.push(fallback);
    }
  }

  return selected.slice(0, 3);
}
