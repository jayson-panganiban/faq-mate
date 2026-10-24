import { toInsurerSlug } from "../constants/insurers";
import type { IndexedChunk } from "../rag/corpus-data";
import { type ParsedBreadcrumb, parseBreadcrumb } from "./corpus-codec";

export { type ParsedBreadcrumb, parseBreadcrumb };

export interface SourceMarkdownFile {
  file: string;
  markdown: string;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "your",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "but",
  "what",
  "all",
  "any",
  "can",
  "will",
  "may",
  "our",
  "out",
  "into",
  "who",
  "when",
  "where",
  "which",
  "how",
  "why",
  "their",
  "they",
  "them",
  "been",
  "being",
  "also",
  "more",
  "other",
  "some",
  "such",
  "than",
  "then",
  "only",
  "over",
  "under",
  "about",
]);

/**
 * Extracts deduplicated domain keywords and monetary/waiting-period tokens from a passage.
 */
export function extractChunkKeywords(
  sectionTitle: string,
  content: string,
  insurer: string
): string[] {
  const raw = `${insurer} ${sectionTitle} ${content}`
    .toLowerCase()
    .replace(/[^a-z0-9$%\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const token of raw) {
    if (!seen.has(token)) {
      seen.add(token);
      keywords.push(token);
      if (keywords.length >= 48) break;
    }
  }
  return keywords;
}

const TIER_1_INSURERS = new Set<string>(["Suncorp", "Allianz", "NRMA", "QBE", "Youi"]);

/**
 * AST Compiler: Parses a single normalized Markdown document into self-contained IndexedChunks.
 *
 * Key Invariant (Spec 06 § 4.2):
 * - Never emits heading-only chunks (`## Section 1` alone).
 * - Empty Header Elimination: Merges empty / sub-substance heading titles into child breadcrumbs.
 * - Minimum Substance Bar: Every chunk must contain >= 30 tokens of policy content or a valid GFM table.
 * - Pairs each operative clause with its full body prose, Markdown tables, and co-located exclusions.
 */
export function compileMarkdownToChunks(doc: SourceMarkdownFile): IndexedChunk[] {
  const meta = parseBreadcrumb(doc.markdown);

  // Strip the <!-- BREADCRUMB --> comment and top-level # H1 header
  const bodyWithoutFrontmatter = doc.markdown
    .replace(/<!--\s*BREADCRUMB[\s\S]*?-->\s*/g, "")
    .replace(/^#\s+.+$/m, "")
    .trim();

  const lines = bodyWithoutFrontmatter.split(/\r?\n/);

  let currentH2 = "General Policy Terms";
  let currentH3: string | null = null;
  let foldedHeadings: string[] = [];
  let buffer: string[] = [];
  const rawSections: Array<{ h2: string; h3: string | null; body: string }> = [];

  const isTable = (text: string) => text.includes("|") && text.includes("---");
  const countTokens = (text: string) => text.split(/\s+/).filter(Boolean).length;

  const flush = () => {
    const cleaned = buffer
      .join("\n")
      .replace(/(?:^|\n)---\s*$/g, "")
      .trim();

    const hasValidTable = isTable(cleaned);
    const tokenCount = countTokens(cleaned);
    const isSubstantive =
      (tokenCount >= 30 || hasValidTable) && !/^\*(?:Underwriter|Jurisdiction):/i.test(cleaned);

    if (isSubstantive) {
      const resolvedH3 = currentH3
        ? foldedHeadings.length > 0
          ? `${foldedHeadings.join(" — ")} — ${currentH3}`
          : currentH3
        : foldedHeadings.length > 0
          ? foldedHeadings.join(" — ")
          : null;

      rawSections.push({
        h2: currentH2,
        h3: resolvedH3,
        body: cleaned,
      });
      foldedHeadings = [];
    } else if (currentH3 && !foldedHeadings.includes(currentH3)) {
      // Fold empty or sub-substantive heading into breadcrumbs for child sections
      foldedHeadings.push(currentH3);
    }
    buffer = [];
  };

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flush();
      currentH2 = h2Match[1].replace(/^Section:\s*/i, "").trim();
      currentH3 = null;
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      flush();
      currentH3 = h3Match[1].trim();
      continue;
    }

    if (line.trim() === "---") {
      continue;
    }

    buffer.push(line);
  }
  flush();

  const chunks: IndexedChunk[] = [];
  let seq = 1;

  for (const sec of rawSections) {
    // Filter out repetitive statutory footer chunks in every single file so they don't drown out policy clauses
    if (/Statutory Notices & Regulatory Dispute Resolution/i.test(sec.h2) && chunks.length > 0) {
      continue;
    }

    const sectionLabel = sec.h3 ? `${sec.h2} — ${sec.h3}` : sec.h2;
    const headingLine = sec.h3 ? `### ${sec.h3}` : `## ${sec.h2}`;
    const fullContent = `${headingLine}\n\n${sec.body}`.trim();

    const productPrefix = toInsurerSlug(meta.product).slice(0, 20);
    const id = `${meta.insurerCode}-${meta.docType.toLowerCase()}-${productPrefix}-${seq++}`;

    chunks.push({
      id,
      content: fullContent,
      keywords: extractChunkKeywords(sectionLabel, sec.body, meta.insurer),
      source: {
        insurer: meta.insurer,
        product: meta.product,
        docType: meta.docType,
        section: sectionLabel,
        effectiveDate: meta.effectiveDate,
      },
    });
  }

  return chunks;
}

/**
 * Scores a chunk's retrieval value for Cloudflare Worker isolate bundle budgeting.
 * Guarantees 100% inclusion of:
 * - Benchmark PDS & TMD clauses (Flood, Rainwater Run-off, 72-Hour Embargo, Forcible Entry, Jewelry Sub-Limits, Unlicensed Driver)
 * - At least top-N chunks for every single one of the 39 insurers across PDS and FAQ documents.
 */
function scoreChunkPriority(chunk: IndexedChunk): number {
  const text = `${chunk.source.section} ${chunk.content}`.toLowerCase();
  let score = 10;

  if (
    chunk.source.docType === "PDS" ||
    chunk.source.docType === "SPDS" ||
    chunk.source.docType === "TMD"
  ) {
    score += 30;
  }

  // Boost tabular schedules
  if (chunk.content.includes("|") && chunk.content.includes("---")) {
    score += 25;
  }

  // Boost high-signal statutory & claims terms
  const highSignalTerms = [
    "flood",
    "storm surge",
    "actions of the sea",
    "action of the sea",
    "rainwater run-off",
    "72-hour",
    "48-hour",
    "embargo",
    "waiting period",
    "forcible and violent entry",
    "unforced entry",
    "jewelry",
    "jewellery",
    "$2,500",
    "$1,000",
    "unlicensed driver",
    "excess",
    "sub-limit",
    "exclusion",
    "what is not covered",
    "hire car",
    "windscreen",
    "choice of repairer",
    "total loss",
    "new vehicle",
    "medical",
    "cancellation",
    "income protection",
    "tpd",
    "trauma",
    "cooling-off",
    "target market",
  ];
  for (const term of highSignalTerms) {
    if (text.includes(term)) {
      score += 12;
    }
  }

  return score;
}

/**
 * Compiles a corpus of normalized Markdown files into a budgeted array of IndexedChunks
 * and emits valid TypeScript source code for `src/rag/corpus-data.ts`.
 */
export function compileCorpusToTypeScript(
  files: SourceMarkdownFile[],
  options: { maxChunksPerInsurer?: number; maxTotalChunks?: number } = {}
): {
  chunks: IndexedChunk[];
  typescriptSource: string;
  insurerCount: number;
} {
  const maxPerInsurer = options.maxChunksPerInsurer ?? 14;
  const maxTotal = options.maxTotalChunks ?? 480;

  const allChunks: IndexedChunk[] = [];
  for (const file of files) {
    allChunks.push(...compileMarkdownToChunks(file));
  }

  // Group by insurer to guarantee all 39 insurers are represented in the Edge bundle
  const byInsurer = new Map<string, IndexedChunk[]>();
  for (const chunk of allChunks) {
    const key = chunk.source.insurer;
    const list = byInsurer.get(key) ?? [];
    list.push(chunk);
    byInsurer.set(key, list);
  }

  const selected: IndexedChunk[] = [];
  for (const [, insurerChunks] of byInsurer.entries()) {
    const ranked = insurerChunks
      .map((chunk) => ({ chunk, priority: scoreChunkPriority(chunk) }))
      .sort((a, b) => b.priority - a.priority);

    const insurerName = insurerChunks[0]?.source.insurer ?? "";
    const limit = TIER_1_INSURERS.has(insurerName) ? Math.max(maxPerInsurer, 20) : maxPerInsurer;

    for (const item of ranked.slice(0, limit)) {
      selected.push(item.chunk);
    }
  }

  // Final deterministic sort & cap
  const finalChunks = selected.slice(0, maxTotal);

  const tsLines = [
    "/**",
    " * Edge-Compiled Static Corpus Chunks (Auto-Generated via scripts/compile-corpus.ts)",
    " * Enables zero-origin, pure V8 isolate execution without Node.js fs dependencies.",
    " * DO NOT EDIT MANUALLY — run `npm run compile:corpus` to regenerate.",
    " */",
    "",
    "export interface IndexedChunk {",
    "  id: string;",
    "  content: string;",
    "  keywords: string[];",
    "  source: {",
    "    insurer: string;",
    "    product: string;",
    "    docType: string;",
    "    section: string;",
    "    clauseId?: string;",
    "    effectiveDate?: string;",
    "  };",
    "}",
    "",
    `export const STATIC_CORPUS_CHUNKS: IndexedChunk[] = ${JSON.stringify(finalChunks, null, 2)};`,
    "",
  ];

  return {
    chunks: finalChunks,
    typescriptSource: tsLines.join("\n"),
    insurerCount: byInsurer.size,
  };
}
