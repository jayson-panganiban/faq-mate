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
  | "UNLICENSED_DRIVER"
  | "DEFINITION_INQUIRY";

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
  /\b(?:um+|uh+|er|ah|so\s+basically|basically|actually|you\s+know|i\s+mean|like)\b[,\s]*/gi;

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
  {
    id: "definition-inquiry",
    pattern:
      /\b(?:what\s+is\s+(?:the\s+)?(?:definition\s+of\s+)?|what's\s+(?:the\s+)?(?:definition\s+of\s+)?|what\s+does\s+.+\s+mean|what\s+counts\s+as\s+|define\s+|definition\s+(?:of|for)\s+|meaning\s+of\s+|how\s+(?:does|do)\s+.+\s+define|flood\s+definition|storm\s+definition|agreed\s+value\s+vs\s+market\s+value|own\s+occupation\s+vs\s+any\s+occupation)\b/i,
    canonicalTokens: [
      "Definitions",
      "Words with Special Meanings",
      "Defined Terms",
      "Prescribed Definition",
    ],
    expandedTerms: [
      "definition",
      "definitions",
      "means",
      "prescribed definition",
      "words with special meanings",
      "defined terms",
    ],
    peril: "DEFINITION_INQUIRY",
  },
];

const QUERY_STOPWORDS = new Set([
  "what",
  "whats",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "how",
  "why",
  "who",
  "when",
  "where",
  "which",
  "in",
  "on",
  "at",
  "to",
  "of",
  "by",
  "or",
  "as",
  "be",
  "if",
  "it",
  "its",
  "my",
  "me",
  "we",
  "us",
  "so",
  "an",
  "about",
  "tell",
  "explain",
]);

const INSURANCE_DOMAIN_PATTERN =
  /\b(?:insur(?:ance|er|ed|ing)|polic(?:y|ies)|pds|spds|tmd|claim(?:s|ing)?|cover(?:s|ed|age|ing)?|exclusion(?:s|ed)?|excess(?:es)?|sub-?limit(?:s)?|embargo(?:es)?|waiting\s+period|cooling-?off|premium(?:s)?|underwrit(?:er|ing)|certificate|schedule|endorsement|payout|settlement|indemnity|liability|peril(?:s)?|flood(?:ing)?|storm(?:s)?|bushfire(?:s)?|cyclone|hail|rainwater|run-?off|escape\s+of\s+liquid|pipe(?:s)?|plumbing|leak(?:s|ing)?|theft|stolen|burglary|break-?in|forcible|vandalism|malicious|fire|lightning|earthquake|tsunami|tide|sea|surge|fence(?:s)?|retaining\s+wall|roof|floorboard(?:s)?|carpet(?:s)?|building|contents|home|house|dwelling|landlord|tenant|strata|renter(?:s)?|motor|car|vehicle(?:s)?|auto|driver(?:s)?|licen[cs]e|windscreen|repairer|total\s+loss|agreed\s+value|market\s+value|no-?claim|ncb|hire\s+car|towing|caravan|trailer|motorcycle|moped|scooter|boat|watercraft|travel|trip|journey|luggage|baggage|cancellation|curtailment|medical|hospital|repatriation|pre-?existing|life|tpd|disablement|disability|trauma|income\s+protection|death\s+benefit|terminal\s+illness|beneficiar(?:y|ies)|occupation|pet(?:s)?|vet(?:erinary)?|business|commercial|afca|asic|apra|general\s+advice|damage(?:d)?|loss|accident(?:al)?|incident|repair(?:s)?|replace(?:ment)?|valuables|jewell?ery|watch(?:es)?|ring(?:s)?|laptop|phone|bicycle|blackout|fridge|spoilage|chimpanzee|exotic\s+animal)\b/i;

function hasKnownInsurerMention(query: string): boolean {
  const rawWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = rawWords[i];
    const w2 = rawWords[i + 1];
    if (INSURER_QUERY_STOPWORDS.has(w1) && INSURER_QUERY_STOPWORDS.has(w2)) continue;
    if (resolveInsurer(`${w1} ${w2}`)) return true;
  }

  for (const word of rawWords) {
    if (INSURER_QUERY_STOPWORDS.has(word)) continue;
    if (resolveInsurer(word)) return true;
  }

  return false;
}

/**
 * Determines whether a user query (and optional conversation history) relates to
 * insurance, policies, perils, insured assets, or Australian insurers.
 * Prevents off-topic queries (e.g., "What is adobo?") from triggering insurance peril/definition boosts.
 */
export function isInsuranceRelatedQuery(
  query: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): boolean {
  if (INSURANCE_DOMAIN_PATTERN.test(query)) return true;
  if (hasKnownInsurerMention(query)) return true;

  for (const rule of COLLOQUIAL_RULES) {
    if (rule.id !== "definition-inquiry" && rule.pattern.test(query)) {
      return true;
    }
  }

  if (history && history.length > 0) {
    const isShortFollowUp =
      /\b(what about|what if|how about|does that|does it|is that|is it|what if it|and if|second day|also)\b/i.test(
        query.toLowerCase()
      ) || query.trim().split(/\s+/).length <= 5;
    if (isShortFollowUp && /\b(it|that|this|they|there|second\s+day|then|also)\b/i.test(query)) {
      return history.some(
        (turn) =>
          INSURANCE_DOMAIN_PATTERN.test(turn.content) || hasKnownInsurerMention(turn.content)
      );
    }
  }

  return false;
}

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
  const insuranceRelated = isInsuranceRelatedQuery(rawQuery) || isInsuranceRelatedQuery(cleaned);

  // 3. Match colloquial patterns across both raw and cleaned query
  for (const rule of COLLOQUIAL_RULES) {
    if (rule.id === "definition-inquiry" && !insuranceRelated) {
      continue;
    }
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
    .filter((t) => t.length > 1 && !QUERY_STOPWORDS.has(t));
  for (const t of cleanedTokens) searchTokensSet.add(t);

  for (const exp of expandedTerms) {
    const expSplit = exp
      .toLowerCase()
      .replace(/[^a-z0-9\s$]/g, " ")
      .split(/\s+/);
    for (const term of expSplit) {
      if (term.length > 2 && !QUERY_STOPWORDS.has(term)) searchTokensSet.add(term);
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
const INSURER_QUERY_STOPWORDS = new Set([
  "cover",
  "covers",
  "covered",
  "covering",
  "coverage",
  "insurance",
  "policy",
  "policies",
  "claim",
  "claims",
  "quote",
  "quotes",
  "what",
  "does",
  "will",
  "with",
  "from",
  "have",
  "about",
  "treat",
  "treats",
  "between",
  "under",
]);

/**
 * Extracts and resolves insurer brand / bancassurance alias directly from query text (Spec 07 US-13).
 */
export function extractInsurerFromQuery(query: string): string | undefined {
  const rawWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const matchedInsurers = new Set<string>();

  // 1. Bigram match (e.g. "Virgin Money", "Budget Direct")
  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = rawWords[i];
    const w2 = rawWords[i + 1];
    // Skip if both are common generic stopwords
    if (INSURER_QUERY_STOPWORDS.has(w1) && INSURER_QUERY_STOPWORDS.has(w2)) {
      continue;
    }
    const bigram = `${w1} ${w2}`;
    const resolved = resolveInsurer(bigram);
    if (resolved) {
      matchedInsurers.add(resolved.profile.slug);
    }
  }

  // 2. Single word match (e.g. "Coles", "Bingle", "Suncorp", "NRMA")
  for (const word of rawWords) {
    if (INSURER_QUERY_STOPWORDS.has(word)) {
      continue;
    }
    const resolved = resolveInsurer(word);
    if (resolved) {
      matchedInsurers.add(resolved.profile.slug);
    }
  }

  // If multiple distinct insurers are detected (e.g. "Suncorp vs Allianz"), this is a comparison query.
  // Return undefined so retrieval is not restricted to a single insurer.
  if (matchedInsurers.size > 1) {
    return undefined;
  }

  if (matchedInsurers.size === 1) {
    return Array.from(matchedInsurers)[0];
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

  const contextTokens: string[] = [];

  // Search recent history turns (most recent first, up to last 2 turns)
  const recentTurns = [...history].reverse().slice(0, 2);

  for (const turn of recentTurns) {
    if (turn.content && turn.content.trim().length > 0) {
      const priorInsurer = extractInsurerFromQuery(turn.content);
      if (priorInsurer) {
        contextTokens.push(priorInsurer);
      }

      // Extract specific statutory insurance phrases if present in prior turn
      const specificMatches = turn.content.match(
        /\b(?:72-hour\s+embargo|72-hour\s+waiting\s+period|escape\s+of\s+liquid|storm\s+surge|action\s+of\s+the\s+sea|food\s+spoilage|unlicensed\s+driver|flood|riverine\s+flood|bushfire|storm|theft)\b/gi
      );
      if (specificMatches) {
        contextTokens.push(...specificMatches);
      }

      const normalized = normalizeIntent(turn.content);
      contextTokens.push(...normalized.canonicalTokens);
    }
  }

  const uniqueTerms = Array.from(new Set(contextTokens)).slice(0, 6).join(" ");
  return uniqueTerms ? `${currentQuery} ${uniqueTerms}`.trim() : currentQuery;
}
