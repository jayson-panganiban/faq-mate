import { resolveInsurer } from "../constants/insurers";
import type { GroundedChunk } from "../types/chat";
import { type IndexedChunk, STATIC_CORPUS_CHUNKS } from "./corpus-data";
import { type InsurancePeril, normalizeIntent } from "./intent-normalizer";

export interface SearchOptions {
  query: string;
  topK?: number;
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
];

/**
 * Deep Module: Edge-Compatible Hybrid Keyword & Semantic BM25-like Retriever
 *
 * Implements pure V8 Isolate execution (PRD § 1.2):
 * Zero Node.js 'fs' or 'path' dependencies at runtime. Operates entirely over
 * pre-compiled static corpus chunks when Cloudflare AI Search is not active.
 */
export function localHybridSearch(options: SearchOptions): GroundedChunk[] {
  const topK = options.topK ?? 5;
  const normalized = normalizeIntent(options.query);
  const rawTerms = normalized.searchTokens;

  if (rawTerms.length === 0) return [];

  const resolvedFilterInsurer = options.filter?.insurer
    ? (resolveInsurer(options.filter.insurer)?.profile.name ?? options.filter.insurer)
    : undefined;

  const scored: Array<{ chunk: IndexedChunk; score: number }> = [];

  for (const chunk of STATIC_CORPUS_CHUNKS) {
    // Insurer filter (resolves both 39 primary insurers and Bancassurance/white-label aliases)
    if (
      resolvedFilterInsurer &&
      !chunk.source.insurer.toLowerCase().includes(resolvedFilterInsurer.toLowerCase())
    ) {
      continue;
    }

    // Optional product filter
    if (
      options.filter?.product &&
      !chunk.source.product.toLowerCase().includes(options.filter.product.toLowerCase())
    ) {
      continue;
    }

    let score = 0;
    const contentLower = chunk.content.toLowerCase();

    // Direct phrase matching
    if (contentLower.includes(options.query.toLowerCase().trim())) {
      score += 15.0;
    }

    // Exact keyword matching with frequency weighting
    for (const term of rawTerms) {
      if (chunk.keywords.includes(term)) {
        score += 2.0;
      }
      if (contentLower.includes(term)) {
        score += 1.0;
      }
    }

    // Table-driven statutory peril boosts
    for (const pb of PERIL_BOOSTS) {
      if (normalized.detectedPerils.includes(pb.peril)) {
        if (pb.keywords.some((kw) => contentLower.includes(kw))) {
          score += pb.boost;
        }
      }
    }

    if (options.query.toLowerCase().includes("flood") && contentLower.includes("flood")) {
      score += 5.0;
    }
    if (
      (options.query.toLowerCase().includes("embargo") ||
        options.query.toLowerCase().includes("bushfire")) &&
      contentLower.includes("72-hour")
    ) {
      score += 8.0;
    }
    if (options.query.toLowerCase().includes("jewelry") && contentLower.includes("jewelry")) {
      score += 8.0;
    }
    if (
      (options.query.toLowerCase().includes("unlicensed") ||
        options.query.toLowerCase().includes("licence")) &&
      contentLower.includes("unlicensed driver")
    ) {
      score += 8.0;
    }
    if (
      options.query.toLowerCase().includes("forcible") &&
      contentLower.includes("forcible and violent entry")
    ) {
      score += 8.0;
    }
    if (
      options.query.toLowerCase().includes("sea") &&
      contentLower.includes("actions of the sea")
    ) {
      score += 8.0;
    }

    if (score > 0) {
      scored.push({ chunk, score });
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
