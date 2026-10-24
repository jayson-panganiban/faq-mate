/**
 * Deep Module: Edge Colloquial Intent & Voice Normalizer
 *
 * Implements Spec 07 Section 3:
 * Sub-millisecond deterministic AST/regex rule mapper operating directly at the edge
 * to clean voice transcription fillers and map colloquial consumer phrasing into
 * authoritative statutory insurance terminology.
 */

export interface NormalizedIntent {
  rawQuery: string;
  cleanedQuery: string;
  canonicalTokens: string[];
  expandedTerms: string[];
  detectedPerils: string[];
  durationMs: number;
}

interface ColloquialRule {
  id: string;
  pattern: RegExp;
  canonicalTokens: string[];
  expandedTerms: string[];
  peril: string;
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
    canonicalTokens: [
      "Motorcycle Endorsement",
      "Engine Capacity Sub-limit",
      "License Requirement",
    ],
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
    expandedTerms: ["jewelry sub-limit", "$2,500 total", "$1,000 individual", "certificate listing"],
    peril: "JEWELRY_SUBLIMIT",
  },
  {
    id: "embargo-72-hour",
    pattern:
      /\b(?:72[- ]?hour|embargo|second\s+day\s+after\s+buying|just\s+bought\s+policy|newly\s+purchased|waiting\s+period\s+for\s+bushfire)\b/i,
    canonicalTokens: ["72-Hour Catastrophe Embargo", "Inception Period", "Bushfire and Flood"],
    expandedTerms: ["72-hour embargo", "commencement of insurance", "flood embargo", "bushfire embargo"],
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
  cleaned = cleaned.replace(VOICE_FILLER_MID, "").replace(/\s{2,}/g, " ").trim();

  const canonicalTokens = new Set<string>();
  const expandedTerms = new Set<string>();
  const detectedPerils = new Set<string>();

  // 3. Match colloquial patterns across both raw and cleaned query
  for (const rule of COLLOQUIAL_RULES) {
    if (rule.pattern.test(rawQuery) || rule.pattern.test(cleaned)) {
      for (const token of rule.canonicalTokens) canonicalTokens.add(token);
      for (const term of rule.expandedTerms) expandedTerms.add(term);
      detectedPerils.add(rule.peril);
    }
  }

  const durationMs = performance.now() - start;

  return {
    rawQuery,
    cleanedQuery: cleaned,
    canonicalTokens: Array.from(canonicalTokens),
    expandedTerms: Array.from(expandedTerms),
    detectedPerils: Array.from(detectedPerils),
    durationMs,
  };
}
