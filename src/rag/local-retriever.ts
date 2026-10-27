import { resolveInsurer } from "../constants/insurers";
import type { GroundedChunk } from "../types/chat";
import { type IndexedChunk, STATIC_CORPUS_CHUNKS } from "./corpus-data";
import {
  type InsurancePeril,
  isInsuranceRelatedQuery,
  type NormalizedIntent,
  normalizeIntent,
} from "./intent-normalizer";

export interface SearchOptions {
  query: string;
  topK?: number;
  normalizedIntent?: NormalizedIntent;
  filter?: {
    insurer?: string;
    product?: string;
    docType?: string;
  };
}

interface PerilBoostConfig {
  peril: InsurancePeril;
  keywords: string[];
  boost: number;
}

const PERIL_BOOSTS: readonly PerilBoostConfig[] = [
  { peril: "ESCAPE_OF_LIQUID", keywords: ["escape of liquid", "fixed apparatus"], boost: 10.0 },
  { peril: "THEFT_FORCIBLE_ENTRY", keywords: ["forcible and violent entry"], boost: 10.0 },
  { peril: "FOOD_SPOILAGE", keywords: ["food spoilage", "refrigerated"], boost: 10.0 },
  { peril: "MOTORCYCLE_TRAVEL", keywords: ["motorcycle", "moped"], boost: 10.0 },
  { peril: "BOUNDARY_FENCE", keywords: ["fence", "fences"], boost: 10.0 },
  { peril: "RAINWATER_RUNOFF", keywords: ["run-off", "rainwater"], boost: 10.0 },
  { peril: "ACTIONS_OF_THE_SEA", keywords: ["actions of the sea"], boost: 10.0 },
  { peril: "JEWELRY_SUBLIMIT", keywords: ["jewelry", "jewellery", "sub-limit"], boost: 10.0 },
  { peril: "EMBARGO_72_HOUR", keywords: ["72-hour", "embargo"], boost: 10.0 },
  { peril: "UNLICENSED_DRIVER", keywords: ["unlicensed driver", "licence"], boost: 10.0 },
  {
    peril: "DEFINITION_INQUIRY",
    keywords: ["**flood** means", "**excess** means", "means the"],
    boost: 4.0,
  },
];

interface QueryTermBoostConfig {
  queryTriggers: readonly string[];
  chunkPhrase: string;
  boost: number;
}

const QUERY_TERM_BOOSTS: readonly QueryTermBoostConfig[] = [
  { queryTriggers: ["flood"], chunkPhrase: "flood", boost: 5.0 },
  { queryTriggers: ["embargo", "bushfire"], chunkPhrase: "72-hour", boost: 8.0 },
  { queryTriggers: ["jewelry"], chunkPhrase: "jewelry", boost: 8.0 },
  { queryTriggers: ["unlicensed", "licence"], chunkPhrase: "unlicensed driver", boost: 8.0 },
  { queryTriggers: ["forcible"], chunkPhrase: "forcible and violent entry", boost: 8.0 },
  { queryTriggers: ["sea"], chunkPhrase: "actions of the sea", boost: 8.0 },
];

const DEFINITION_STOPWORDS = new Set([
  "what",
  "does",
  "for",
  "the",
  "and",
  "mean",
  "means",
  "definition",
  "definitions",
]);

/**
 * Shared predicate that resolves primary insurers and Bancassurance aliases
 * and checks whether a chunk's source insurer matches the requested filter.
 */
export function matchesInsurerFilter(chunkInsurer: string, filterInsurer: string): boolean {
  const srcLower = chunkInsurer.toLowerCase().trim();
  const targetLower = filterInsurer.toLowerCase().trim();
  if (!srcLower || !targetLower) {
    return false;
  }
  if (srcLower === targetLower) {
    return true;
  }
  const resolvedTarget = resolveInsurer(filterInsurer);
  const resolvedSource = resolveInsurer(chunkInsurer);
  if (resolvedTarget && resolvedSource) {
    return resolvedSource.profile.slug === resolvedTarget.profile.slug;
  }
  if (resolvedTarget) {
    const slugLower = resolvedTarget.profile.slug.toLowerCase();
    const nameLower = resolvedTarget.profile.name.toLowerCase();
    return srcLower === slugLower || srcLower.includes(nameLower);
  }
  return srcLower.includes(targetLower);
}

interface PreIndexedChunk {
  readonly chunk: IndexedChunk;
  readonly contentLower: string;
  readonly sectionLower: string;
  readonly insurerLower: string;
  readonly productLower: string;
  readonly keywordSet: ReadonlySet<string>;
  readonly contentWordSet: ReadonlySet<string>;
  readonly perilBoosts: ReadonlyMap<InsurancePeril, number>;
  readonly queryTermBoostMask: number;
  readonly isDefinitionSection: boolean;
}

const PREINDEXED_CORPUS_CHUNKS: readonly PreIndexedChunk[] = STATIC_CORPUS_CHUNKS.map((chunk) => {
  const contentLower = chunk.content.toLowerCase();
  const sectionLower = chunk.source.section.toLowerCase();
  const perilBoosts = new Map<InsurancePeril, number>();

  for (const pb of PERIL_BOOSTS) {
    if (pb.keywords.some((kw) => contentLower.includes(kw))) {
      perilBoosts.set(pb.peril, (perilBoosts.get(pb.peril) ?? 0) + pb.boost);
    }
  }

  let queryTermBoostMask = 0;
  for (let b = 0; b < QUERY_TERM_BOOSTS.length; b++) {
    if (contentLower.includes(QUERY_TERM_BOOSTS[b].chunkPhrase)) {
      queryTermBoostMask |= 1 << b;
    }
  }

  return {
    chunk,
    contentLower,
    sectionLower,
    insurerLower: chunk.source.insurer.toLowerCase(),
    productLower: chunk.source.product.toLowerCase(),
    keywordSet: new Set(chunk.keywords),
    contentWordSet: new Set(contentLower.split(/[^a-z0-9$]+/).filter(Boolean)),
    perilBoosts,
    queryTermBoostMask,
    isDefinitionSection: sectionLower.includes("definitions"),
  };
});

/**
 * Bounded memoization table mapping a search term to a per-chunk score array:
 * - 3 = term in chunk.keywords (+2.0) AND in chunk.contentLower (+1.0)
 * - 2 = term in chunk.keywords (+2.0) only
 * - 1 = term in chunk.contentLower (+1.0) only
 * - 0 = not present
 */
const TERM_CHUNK_SCORE_CACHE_MAX = 2048;
const termChunkScoreCache = new Map<string, Uint8Array>();

function getTermChunkScores(term: string): Uint8Array {
  const cached = termChunkScoreCache.get(term);
  if (cached !== undefined) {
    return cached;
  }

  const len = PREINDEXED_CORPUS_CHUNKS.length;
  const scores = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const indexed = PREINDEXED_CORPUS_CHUNKS[i];
    let s = 0;
    if (indexed.keywordSet.has(term)) {
      s += 2;
    }
    if (indexed.contentWordSet.has(term) || indexed.contentLower.includes(term)) {
      s += 1;
    }
    scores[i] = s;
  }

  if (termChunkScoreCache.size >= TERM_CHUNK_SCORE_CACHE_MAX) {
    const oldestKey = termChunkScoreCache.keys().next().value;
    if (oldestKey !== undefined) {
      termChunkScoreCache.delete(oldestKey);
    }
  }
  termChunkScoreCache.set(term, scores);
  return scores;
}

/**
 * Deep Module: Edge-Compatible Hybrid Keyword & Semantic BM25-like Retriever
 *
 * Implements pure V8 Isolate execution (PRD § 1.2):
 * Zero Node.js 'fs' or 'path' dependencies at runtime. Operates entirely over
 * pre-compiled static corpus chunks when Cloudflare AI Search is not active.
 */
export function localHybridSearch(options: SearchOptions): GroundedChunk[] {
  const topK = options.topK ?? 5;
  const normalized = options.normalizedIntent ?? normalizeIntent(options.query);
  const rawTerms = normalized.searchTokens;

  if (rawTerms.length === 0) return [];

  if (
    !options.filter?.insurer &&
    normalized.detectedPerils.length === 0 &&
    !isInsuranceRelatedQuery(options.query)
  ) {
    return [];
  }

  const resolvedFilterInsurerLower = options.filter?.insurer
    ? (resolveInsurer(options.filter.insurer)?.profile.name ?? options.filter.insurer).toLowerCase()
    : undefined;
  const filterProductLower = options.filter?.product?.toLowerCase();

  const queryLower = options.query.toLowerCase();
  const queryTrimmed = queryLower.trim();
  let activeQueryBoostMask = 0;
  for (let b = 0; b < QUERY_TERM_BOOSTS.length; b++) {
    if (QUERY_TERM_BOOSTS[b].queryTriggers.some((trigger) => queryLower.includes(trigger))) {
      activeQueryBoostMask |= 1 << b;
    }
  }

  const isDefinitionInquiry = normalized.detectedPerils.includes("DEFINITION_INQUIRY");
  const definitionQueryWords = isDefinitionInquiry
    ? queryLower.split(/[^a-z0-9-]+/).filter((w) => w.length >= 3 && !DEFINITION_STOPWORDS.has(w))
    : [];

  const termScoreVectors = rawTerms.map(getTermChunkScores);
  const queryWordsForPhrase = queryTrimmed.split(/[^a-z0-9$]+/).filter((w) => w.length > 1);

  const scored: Array<{ chunk: IndexedChunk; score: number }> = [];
  const chunkCount = PREINDEXED_CORPUS_CHUNKS.length;

  for (let i = 0; i < chunkCount; i++) {
    const indexed = PREINDEXED_CORPUS_CHUNKS[i];

    // Insurer filter (resolves both 39 primary insurers and Bancassurance/white-label aliases)
    if (resolvedFilterInsurerLower && !indexed.insurerLower.includes(resolvedFilterInsurerLower)) {
      continue;
    }

    // Optional product filter
    if (filterProductLower && !indexed.productLower.includes(filterProductLower)) {
      continue;
    }

    let score = 0;

    // Exact keyword matching with frequency weighting via pre-indexed term vectors
    for (let t = 0; t < termScoreVectors.length; t++) {
      score += termScoreVectors[t][i];
    }

    // Direct phrase matching: only check full string if all words in queryTrimmed are in the chunk
    if (
      queryTrimmed.length > 0 &&
      queryWordsForPhrase.every((w) => indexed.contentWordSet.has(w)) &&
      indexed.contentLower.includes(queryTrimmed)
    ) {
      score += 15.0;
    }

    // Table-driven statutory peril boosts (pre-indexed per chunk)
    for (const peril of normalized.detectedPerils) {
      const boost = indexed.perilBoosts.get(peril);
      if (boost !== undefined) {
        score += boost;
      }
    }

    // Table-driven query-term phrase boosts via pre-indexed bitmask
    const matchedBoostMask = activeQueryBoostMask & indexed.queryTermBoostMask;
    if (matchedBoostMask !== 0) {
      for (let b = 0; b < QUERY_TERM_BOOSTS.length; b++) {
        if ((matchedBoostMask & (1 << b)) !== 0) {
          score += QUERY_TERM_BOOSTS[b].boost;
        }
      }
    }

    // Boost discrete `Definitions — [Term]` chunks when query asks for a policy definition
    if (isDefinitionInquiry && indexed.isDefinitionSection) {
      for (const term of definitionQueryWords) {
        if (indexed.sectionLower.includes(term)) {
          score += 25.0;
        }
      }
    }

    if (score > 0) {
      scored.push({ chunk: indexed.chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({ chunk, score }) => ({
    id: chunk.id,
    relevanceScore: Math.min(score / 20.0, 1.0),
    content: chunk.content,
    source: chunk.source,
  }));
}
