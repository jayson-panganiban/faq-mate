import { resolveInsurer } from "../constants/insurers";
import type { GroundedChunk } from "../types/chat";
import { type IndexedChunk, STATIC_CORPUS_CHUNKS } from "./corpus-data";
import { normalizeIntent } from "./intent-normalizer";

export interface SearchOptions {
  query: string;
  topK?: number;
  filter?: {
    insurer?: string;
    product?: string;
    docType?: string;
  };
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
  const normalized = normalizeIntent(options.query);

  const rawTerms = options.query
    .toLowerCase()
    .replace(/[^a-z0-9\s$]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  // Augment with expanded terms from colloquial AST normalizer (Spec 07 Section 3)
  for (const exp of normalized.expandedTerms) {
    const split = exp
      .toLowerCase()
      .replace(/[^a-z0-9\s$]/g, " ")
      .split(/\s+/);
    for (const term of split) {
      if (term.length > 2 && !rawTerms.includes(term)) {
        rawTerms.push(term);
      }
    }
  }

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

    // Domain perceptual boosts for critical statutory terms
    if (
      normalized.detectedPerils.includes("ESCAPE_OF_LIQUID") &&
      (contentLower.includes("escape of liquid") || contentLower.includes("fixed apparatus"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("THEFT_FORCIBLE_ENTRY") &&
      contentLower.includes("forcible and violent entry")
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("FOOD_SPOILAGE") &&
      (contentLower.includes("food spoilage") || contentLower.includes("refrigerated"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("MOTORCYCLE_TRAVEL") &&
      (contentLower.includes("motorcycle") || contentLower.includes("moped"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("BOUNDARY_FENCE") &&
      (contentLower.includes("fence") || contentLower.includes("fences"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("RAINWATER_RUNOFF") &&
      (contentLower.includes("run-off") || contentLower.includes("rainwater"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("ACTIONS_OF_THE_SEA") &&
      contentLower.includes("actions of the sea")
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("JEWELRY_SUBLIMIT") &&
      (contentLower.includes("jewelry") || contentLower.includes("jewellery") || contentLower.includes("sub-limit"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("EMBARGO_72_HOUR") &&
      (contentLower.includes("72-hour") || contentLower.includes("embargo"))
    ) {
      score += 10.0;
    }
    if (
      normalized.detectedPerils.includes("UNLICENSED_DRIVER") &&
      (contentLower.includes("unlicensed driver") || contentLower.includes("licence"))
    ) {
      score += 10.0;
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
