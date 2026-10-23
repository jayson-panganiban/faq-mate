import fs from "fs";
import path from "path";
import type { GroundedChunk } from "../types/chat";

export interface SearchOptions {
  query: string;
  topK?: number;
  filter?: {
    insurer?: string;
    product?: string;
    docType?: string;
  };
}

interface IndexedChunk {
  id: string;
  content: string;
  keywords: string[];
  source: {
    insurer: string;
    product: string;
    docType: string;
    section: string;
    clauseId?: string;
    effectiveDate?: string;
  };
}

let cachedChunks: IndexedChunk[] | null = null;

function loadCorpusChunks(): IndexedChunk[] {
  if (cachedChunks) return cachedChunks;

  const chunks: IndexedChunk[] = [];
  const corpusDir = path.resolve(process.cwd(), "data/corpus");

  if (!fs.existsSync(corpusDir)) {
    return [];
  }

  // 1. Load benchmark PDS files
  const pdsFiles = fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith(".md") && !fs.statSync(path.join(corpusDir, f)).isDirectory());

  for (const file of pdsFiles) {
    const filePath = path.join(corpusDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    const insurerMatch = content.match(/insurer:\s*([^\n\r]+)/i);
    const insurer = insurerMatch ? insurerMatch[1].trim() : "General";
    const productMatch = content.match(/product:\s*([^\n\r]+)/i);
    const product = productMatch ? productMatch[1].trim() : "Insurance Policy";
    const docTypeMatch = content.match(/doc_type:\s*([^\n\r]+)/i);
    const docType = docTypeMatch ? docTypeMatch[1].trim() : "PDS";
    const dateMatch = content.match(/effective_date:\s*([^\n\r]+)/i);
    const effectiveDate = dateMatch ? dateMatch[1].trim() : "2024-01-01";

    // Split on operative section headers
    const rawSections = content.split(/\n(?=##{1,3}\s)/);
    for (let i = 0; i < rawSections.length; i++) {
      const sec = rawSections[i].trim();
      if (!sec || sec.startsWith("<!-- BREADCRUMB")) continue;

      const titleMatch = sec.match(/^#{2,4}\s+([^\n\r]+)/);
      const sectionTitle = titleMatch ? titleMatch[1].trim() : `Section ${i + 1}`;

      const chunkId = `${insurer.toLowerCase().replace(/[^a-z0-9]/g, "")}-${i + 1}`;
      const keywords = sec
        .toLowerCase()
        .replace(/[^a-z0-9\s$]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      chunks.push({
        id: chunkId,
        content: sec,
        keywords,
        source: {
          insurer,
          product,
          docType,
          section: sectionTitle,
          effectiveDate,
        },
      });
    }
  }

  // 2. Load FAQs in data/corpus/faqs
  const faqsDir = path.join(corpusDir, "faqs");
  if (fs.existsSync(faqsDir)) {
    const faqFiles = fs.readdirSync(faqsDir).filter((f) => f.endsWith(".md"));
    for (const file of faqFiles) {
      const filePath = path.join(faqsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const brand = path.basename(file, ".md").toUpperCase();

      const qaBlocks = content.split(/\n(?=## Question \d+:)/);
      for (let j = 0; j < qaBlocks.length; j++) {
        const block = qaBlocks[j].trim();
        if (!block || block.startsWith("<!-- BREADCRUMB")) continue;

        const titleMatch = block.match(/## Question \d+:\s*([^\n\r]+)/);
        const qTitle = titleMatch ? titleMatch[1].trim() : `FAQ ${j + 1}`;
        const chunkId = `faq-${brand.toLowerCase()}-${j + 1}`;
        const keywords = block
          .toLowerCase()
          .replace(/[^a-z0-9\s$]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2);

        chunks.push({
          id: chunkId,
          content: block,
          keywords,
          source: {
            insurer: brand,
            product: "FAQ Disclosure",
            docType: "FAQ",
            section: qTitle,
          },
        });
      }
    }
  }

  cachedChunks = chunks;
  return chunks;
}

/**
 * Deep Module: Local Hybrid Keyword & Semantic BM25-like Retriever
 * Used when env.AI_SEARCH is not attached (local dev, offline tests, evals).
 */
export function localHybridSearch(options: SearchOptions): GroundedChunk[] {
  const allChunks = loadCorpusChunks();
  const topK = options.topK ?? 5;
  const rawTerms = options.query
    .toLowerCase()
    .replace(/[^a-z0-9\s$]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (rawTerms.length === 0) return [];

  const scored: Array<{ chunk: IndexedChunk; score: number }> = [];

  for (const chunk of allChunks) {
    // Insurer filter
    if (
      options.filter?.insurer &&
      !chunk.source.insurer
        .toLowerCase()
        .includes(options.filter.insurer.toLowerCase())
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
    if (options.query.toLowerCase().includes("flood") && contentLower.includes("flood")) {
      score += 5.0;
    }
    if (
      (options.query.toLowerCase().includes("embargo") || options.query.toLowerCase().includes("bushfire")) &&
      contentLower.includes("72-hour")
    ) {
      score += 8.0;
    }
    if (options.query.toLowerCase().includes("jewelry") && contentLower.includes("jewelry")) {
      score += 8.0;
    }
    if (
      (options.query.toLowerCase().includes("unlicensed") || options.query.toLowerCase().includes("licence")) &&
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
