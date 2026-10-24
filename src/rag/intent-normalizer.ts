/**
 * Deep Module: Edge Colloquial Intent & Voice Normalizer
 *
 * Implements Spec 07 Section 3:
 * Sub-millisecond deterministic AST/regex rule mapper operating directly at the edge
 * to clean voice transcription fillers and map colloquial consumer phrasing into
 * authoritative statutory insurance terminology.
 */

import { resolveInsurer } from "../constants/insurers";

export type InsurancePeril =
  | "ESCAPE_OF_LIQUID"
  | "THEFT_FORCIBLE_ENTRY"
  | "FOOD_SPOILAGE"
  | "MOTORCYCLE_TRAVEL"
  | "BOUNDARY_FENCE"
  | "RAINWATER_RUNOFF"
  | "ACTIONS_OF_THE_SEA"
  | "JEWELRY_SUBLIMIT"
  | "EMBARGO_72_HOUR"
  | "UNLICENSED_DRIVER";

export interface NormalizedIntent {
  rawQuery: string;
  cleanedQuery: string;
  canonicalTokens: string[];
  expandedTerms: string[];
  searchTokens: string[];
  detectedPerils: InsurancePeril[];
  durationMs: number;
}

interface ColloquialRule {
  id: string;
  pattern: RegExp;
  canonicalTokens: string[];
  expandedTerms: string[];
  peril: InsurancePeril;
}

/**
 * Common speech-to-text filler patterns (voice dictation noise)
 */
const VOICE_FILLER_PREFIX =
  /^(?:\s*(?:um+|uh+|er|ah|so\s+basically|basically|actually|you\s+know|i\s+mean|so\s+like|like)\b[,\s]*)+/i;

const VOICE_FILLER_MID =
  /\b(?:um+|uh+|er|ah|so\s+basically|basically|actually|you\s+know|i\s+mean)\b[,\s]*/gi;

/**
 * Domain rules mapping Australian colloquial expressions to statutory insurance concepts
 */
const COLLOQUIAL_RULES: readonly ColloquialRule[] = [
  {
    id: "escape-of-liquid",
    pattern:
      /\b(?:(?:burst|broken|ruptured|leaking|leaky)\s+(?:pipe|shower|sink|tap|toilet|hose|internal\s+apparatus)|(?:pipe|shower|sink|tap|toilet|hose)\s+(?:burst|broke|ruptured|leaked|leaking)|soaked\s+(?:floor|carpet|floorboards)|ruined\s+(?:the\s+)?floorboards|flooded\s+(?:bathroom|ensuite|kitchen|laundry)|water\s+damage\s+from\s+(?:a\s+)?pipe)\b/i,
    canonicalTokens: ["Escape of Liquid", "Gradual Deterioration", "Fixed Apparatus"],
    expandedTerms: [
      "escape of liquid",
      "fixed internal apparatus",
      "burst pipe",
      "gradual deterioration",
    ],
    peril: "ESCAPE_OF_LIQUID",
  },
  {
    id: "theft-forcible-entry",
    pattern:
      /\b(?:break[- ]?in|broken\s+into|smashed\s+(?:my\s+)?(?:passenger\s+)?window|stolen\s+(?:items\s+)?from\s+(?:my\s+)?(?:car|driveway|flat|garage|carport)|took\s+my\s+laptop\s+from\s+car|car\s+(?:vandalized|vandalised|broken\s+into)|theft\s+from\s+car)\b/i,
    canonicalTokens: ["Theft", "Violent and Forcible Entry", "Common Property Exclusion"],
    expandedTerms: [
      "forcible and violent entry",
      "theft exclusion",
      "common property",
      "unforced entry",
    ],
    peril: "THEFT_FORCIBLE_ENTRY",
  },
  {
    id: "food-spoilage",
    pattern:
      /\b(?:blackout|power\s+outage|power\s+(?:cut|failure|interruption|goes\s+out)|fridge\s+(?:stopped|died|broke|broke\s+down)|spoiled\s+(?:food|meat)|food\s+spoilage)\b/i,
    canonicalTokens: ["Food Spoilage", "Power Interruption", "Contents Insurance"],
    expandedTerms: [
      "food spoilage",
      "failure of public electricity supply",
      "insured event 11",
      "contents insurance",
    ],
    peril: "FOOD_SPOILAGE",
  },
  {
    id: "motorcycle-travel",
    pattern:
      /\b(?:hired\s+scooter|scooter\s+hire|rental\s+(?:moped|scooter)|moped\s+crash|crash(?:ed)?\s+(?:a\s+)?(?:rental\s+)?(?:moped|scooter))\b/i,
    canonicalTokens: ["Motorcycle Endorsement", "Engine Capacity Sub-limit", "License Requirement"],
    expandedTerms: [
      "motorcycle endorsement",
      "engine capacity",
      "50cc",
      "125cc",
      "motorcycle license",
    ],
    peril: "MOTORCYCLE_TRAVEL",
  },
  {
    id: "boundary-fence",
    pattern:
      /\b(?:fence\s+blew\s+down|blown\s+down\s+fence|boundary\s+fence|dividing\s+fence|storm\s+damage\s+to\s+fence)\b/i,
    canonicalTokens: ["Boundary Fence", "Storm", "Dividing Fence"],
    expandedTerms: ["dividing fences", "boundary fence", "storm damage", "neighbour contribution"],
    peril: "BOUNDARY_FENCE",
  },
  {
    id: "rainwater-runoff",
    pattern:
      /\b(?:rainwater\s+run[- ]?off|water\s+run[- ]?off|run[- ]?off\s+coming|water\s+coming\s+down\s+(?:the\s+)?hill|surface\s+water)\b/i,
    canonicalTokens: ["Rainwater Run-off", "Storm", "Riverine Flood Disambiguation"],
    expandedTerms: [
      "rainwater run-off",
      "surface run-off",
      "prescribed flood definition",
      "riverine flood",
    ],
    peril: "RAINWATER_RUNOFF",
  },
  {
    id: "actions-of-the-sea",
    pattern:
      /\b(?:king\s+tide|high\s+tide|actions?\s+of\s+the\s+sea|sea\s+rise|tidal\s+wave|storm\s+surge)\b/i,
    canonicalTokens: ["Actions of the Sea", "Storm Surge Exclusion"],
    expandedTerms: ["actions of the sea", "tidal wave", "storm surge", "permanent sea rise"],
    peril: "ACTIONS_OF_THE_SEA",
  },
  {
    id: "jewelry-sublimit",
    pattern:
      /\b(?:lost|stolen|damaged)\s+(?:diamond\s+ring|ring|watch|jewelry|jewellery|necklace|earrings|engagement\s+ring)\b/i,
    canonicalTokens: ["Jewelry Sub-limit", "Accidental Loss", "Certificate Listing"],
    expandedTerms: [
      "jewelry sub-limit",
      "$2,500 total",
      "$1,000 individual",
      "certificate listing",
    ],
    peril: "JEWELRY_SUBLIMIT",
  },
  {
    id: "embargo-72-hour",
    pattern:
      /\b(?:72[- ]?hour|embargo|second\s+day\s+after\s+buying|just\s+bought\s+policy|newly\s+purchased|waiting\s+period\s+for\s+bushfire)\b/i,
    canonicalTokens: ["72-Hour Catastrophe Embargo", "Inception Period", "Bushfire and Flood"],
    expandedTerms: [
      "72-hour embargo",
      "commencement of insurance",
      "flood embargo",
      "bushfire embargo",
    ],
    peril: "EMBARGO_72_HOUR",
  },
  {
    id: "unlicensed-driver",
    pattern:
      /\b(?:unlicensed\s+driver|suspended\s+licen[sc]e|learner\s+unsupervised|disqualified\s+driver)\b/i,
    canonicalTokens: ["Unlicensed Driver Exclusion", "Motor Vehicle PDS"],
    expandedTerms: ["unlicensed driver", "licence cancelled or suspended", "authorized driver"],
    peril: "UNLICENSED_DRIVER",
  },
];

/**
 * Normalizes speech-to-text filler tokens and colloquial insurance phrases
 * into authoritative statutory tokens in < 1 ms.
 */
export function normalizeIntent(rawQuery: string): NormalizedIntent {
  const start = performance.now();

  // 1. Strip leading voice transcription fillers
  let cleaned = rawQuery.replace(VOICE_FILLER_PREFIX, "").trim();

  // 2. Strip mid-sentence conversational fillers
  cleaned = cleaned
    .replace(VOICE_FILLER_MID, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const canonicalTokens = new Set<string>();
  const expandedTerms = new Set<string>();
  const detectedPerils = new Set<InsurancePeril>();

  // 3. Match colloquial patterns across both raw and cleaned query
  for (const rule of COLLOQUIAL_RULES) {
    if (rule.pattern.test(rawQuery) || rule.pattern.test(cleaned)) {
      for (const token of rule.canonicalTokens) canonicalTokens.add(token);
      for (const term of rule.expandedTerms) expandedTerms.add(term);
      detectedPerils.add(rule.peril);
    }
  }

  // Pre-tokenize search tokens for retriever to prevent feature envy
  const searchTokensSet = new Set<string>();
  const cleanedTokens = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s$]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const t of cleanedTokens) searchTokensSet.add(t);

  for (const exp of expandedTerms) {
    const expSplit = exp
      .toLowerCase()
      .replace(/[^a-z0-9\s$]/g, " ")
      .split(/\s+/);
    for (const term of expSplit) {
      if (term.length > 2) searchTokensSet.add(term);
    }
  }

  const durationMs = performance.now() - start;

  return {
    rawQuery,
    cleanedQuery: cleaned,
    canonicalTokens: Array.from(canonicalTokens),
    expandedTerms: Array.from(expandedTerms),
    searchTokens: Array.from(searchTokensSet),
    detectedPerils: Array.from(detectedPerils),
    durationMs,
  };
}

/**
 * Extracts and resolves insurer brand / bancassurance alias directly from query text (Spec 07 US-13).
 */
export function extractInsurerFromQuery(query: string): string | undefined {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // 1. Single word match (e.g. "Coles", "Bingle", "Suncorp", "NRMA")
  for (const word of words) {
    const resolved = resolveInsurer(word);
    if (resolved) {
      return resolved.profile.name;
    }
  }

  // 2. Bigram match (e.g. "Virgin Money", "Budget Direct")
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    const resolved = resolveInsurer(bigram);
    if (resolved) {
      return resolved.profile.name;
    }
  }

  return undefined;
}

/**
 * Enriches follow-up turn queries with prior context to overcome context amnesia (Spec 07 Problem 2).
 */
export function enrichRetrievalQuery(
  currentQuery: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): string {
  if (!history || history.length === 0) return currentQuery;

  const currentLower = currentQuery.toLowerCase();
  const isFollowUp =
    /\b(what about|what if|how about|does that|does it|is that|is it|what if it|and if|second day|also)\b/i.test(
      currentLower
    ) || currentQuery.split(/\s+/).length <= 6;

  if (!isFollowUp) return currentQuery;

  // Retrieve previous user turn to extract topic/peril context
  const previousUserTurn = [...history]
    .reverse()
    .find((turn) => turn.role === "user" && turn.content.trim().length > 0);

  if (!previousUserTurn) return currentQuery;

  const prevNormalized = normalizeIntent(previousUserTurn.content);
  const contextTerms = [
    ...prevNormalized.canonicalTokens,
    ...prevNormalized.searchTokens.slice(0, 3),
  ].join(" ");

  return `${currentQuery} ${contextTerms}`.trim();
}
