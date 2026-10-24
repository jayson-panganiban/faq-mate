import {
  buildR2PathKey,
  type CorpusDocumentMetadata,
  formatStatutoryFooter,
  generateBreadcrumbHeader,
} from "./corpus-codec";
import { normalizeRawTextTable, serializeMarkdownTable, type TableData } from "./table-serializer";

export type PdsMetadata = CorpusDocumentMetadata;
export { buildR2PathKey, generateBreadcrumbHeader };

export interface PolicySection {
  title: string;
  level: 2 | 3 | 4;
  clauseType?: "Definition" | "Coverage" | "Exclusion" | "SubLimit" | "Procedure";
  content: string;
  tables?: TableData[];
  exclusions?: string[];
  embargoHours?: number;
}

export interface NormalizedDocument {
  r2Key: string;
  metadata: PdsMetadata;
  markdown: string;
  sectionsCount: number;
}

/**
 * Classifies a section heading & body into a domain clauseType and detects embargo windows.
 */
export function classifyClause(
  title: string,
  body: string
): {
  clauseType: PolicySection["clauseType"];
  embargoHours?: number;
} {
  const combined = `${title} ${body}`.toLowerCase();

  let embargoHours: number | undefined;
  const embargoMatch =
    combined.match(
      /\b(48|72)[\s-]*hours?\b.*?\b(?:embargo|waiting period|exclusion|first\s+(?:48|72)\s+hours)/i
    ) || combined.match(/\bwithin the first\s+(48|72)\s+hours\b/i);
  if (embargoMatch) {
    embargoHours = Number.parseInt(embargoMatch[1], 10);
  }

  if (/\b(?:what is not covered|exclusions?|we do not cover|not insured|embargo)\b/i.test(title)) {
    return { clauseType: "Exclusion", embargoHours };
  }
  if (
    /\b(?:sub-?limits?|limits? of cover|maximum limits?|excess(?:es)?|how much we pay)\b/i.test(
      title
    )
  ) {
    return { clauseType: "SubLimit", embargoHours };
  }
  if (/\b(?:definitions?|meaning of words|glossary|defined terms)\b/i.test(title)) {
    return { clauseType: "Definition", embargoHours };
  }
  if (/\b(?:claims?|complaints?|afca|how to claim|dispute)\b/i.test(title)) {
    return { clauseType: "Procedure", embargoHours };
  }
  return { clauseType: "Coverage", embargoHours };
}

/**
 * Extracts structured operative PolicySections from raw PDF text.
 * Filters out table-of-contents dot-leader lines and page-number noise,
 * and groups paragraphs under semantic policy headings.
 */
export function extractSectionsFromRawPdfText(
  rawText: string,
  fallbackTitle = "Policy Terms & Conditions"
): PolicySection[] {
  const cleanedLines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    // Remove TOC dot leaders (e.g. "Insured Events ............ 14") and bare page numbers
    .filter((line) => {
      if (!line) return false;
      if (/^\d{1,3}$/.test(line)) return false;
      if (/^page\s+\d+\s*(?:of\s+\d+)?$/i.test(line)) return false;
      if (/\.{4,}\s*\d+$/.test(line)) return false;
      return true;
    });

  if (cleanedLines.length === 0) {
    return [];
  }

  const headingPattern =
    /^(?:#{1,3}\s+|(?:section|part)\s+\d+[:.\s-]*|(?:insured event|what is covered|what is not covered|general exclusions|exclusions|excess(?:es)?|making a claim|how we settle claims|sub-?limits|important information|definitions|words with special meaning|cooling-off period|complaints)\b)/i;

  const rawSections: Array<{ title: string; lines: string[] }> = [];
  let currentTitle = fallbackTitle;
  let currentLines: string[] = [];

  for (const line of cleanedLines) {
    const isShortHeading =
      line.length >= 4 && line.length <= 95 && !/[.;,]$/.test(line) && headingPattern.test(line);

    if (isShortHeading) {
      if (currentLines.length > 0) {
        rawSections.push({
          title: currentTitle.replace(/^#{1,3}\s*/, "").trim(),
          lines: currentLines,
        });
      }
      currentTitle = line.replace(/^#{1,3}\s*/, "").trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    rawSections.push({
      title: currentTitle.replace(/^#{1,3}\s*/, "").trim(),
      lines: currentLines,
    });
  }

  // Merge tiny sections (< 80 chars) into the following or preceding section
  // and chunk overly large sections (> 2,500 chars) so each section is a clean retrieval unit
  const normalizedSections: PolicySection[] = [];

  for (const sec of rawSections) {
    const fullText = sec.lines.join("\n").trim();
    if (fullText.length < 40) continue;

    // Split into ~1,800 character semantic passages if very long
    const paragraphs = fullText.split(/\n+/);
    let buffer: string[] = [];
    let bufferLen = 0;
    let partIndex = 1;

    const flushBuffer = () => {
      if (buffer.length === 0) return;
      const bodyText = buffer.join("\n\n").trim();
      const title = partIndex === 1 ? sec.title : `${sec.title} (Part ${partIndex})`;
      const { clauseType, embargoHours } = classifyClause(title, bodyText);

      normalizedSections.push({
        title,
        level: 3,
        clauseType,
        content: normalizeRawTextTable(bodyText),
        embargoHours,
      });

      buffer = [];
      bufferLen = 0;
      partIndex++;
    };

    for (const para of paragraphs) {
      if (bufferLen + para.length > 1800 && buffer.length > 0) {
        flushBuffer();
      }
      buffer.push(para);
      bufferLen += para.length;
    }
    flushBuffer();
  }

  // Cap at top 25 highest-signal sections per PDF so normalized Markdown remains high-density
  if (normalizedSections.length > 25) {
    const scored = normalizedSections.map((s, idx) => {
      const text = `${s.title} ${s.content}`.toLowerCase();
      let priority = 0;
      if (
        /\b(?:flood|storm|bushfire|cyclone|embargo|theft|forcible|jewelry|jewellery|sub-?limit|excess|unlicensed|exclusion|not covered|claim|windscreen|hire car|medical|cancellation|waiting period|benefit)\b/.test(
          text
        )
      ) {
        priority += 10;
      }
      if (s.clauseType === "Exclusion" || s.clauseType === "SubLimit") {
        priority += 5;
      }
      return { s, idx, priority };
    });

    scored.sort((a, b) => b.priority - a.priority || a.idx - b.idx);
    const kept = scored
      .slice(0, 25)
      .sort((a, b) => a.idx - b.idx)
      .map((x) => x.s);
    return kept;
  }

  return normalizedSections;
}

/**
 * Deep Module: Normalizes raw policy sections into semantic, audit-ready Markdown.
 * Preserves paired domain clauses (flood + action of sea, perils + embargoes, theft + forcible entry).
 */
export function normalizePdsDocument(
  metadata: PdsMetadata,
  sections: PolicySection[]
): NormalizedDocument {
  const r2Key = buildR2PathKey(metadata);
  const docTitle = `${metadata.insurer} ${metadata.product} (${metadata.docType} ${metadata.version || metadata.effectiveDate})`;

  const outputParts: string[] = [
    generateBreadcrumbHeader(metadata),
    "",
    `# ${docTitle}`,
    "",
    `*Jurisdiction: ${metadata.jurisdiction || "Australia (Cth)"} | Effective Date: ${metadata.effectiveDate}*`,
    "",
    "---",
    "",
  ];

  for (const section of sections) {
    const headingPrefix = "#".repeat(section.level);
    outputParts.push(`${headingPrefix} ${section.title}`);

    if (section.clauseType) {
      outputParts.push(`**Clause Classification:** \`${section.clauseType}\``, "");
    }

    if (section.content.trim()) {
      outputParts.push(section.content.trim(), "");
    }

    // Embed tables if present
    if (section.tables && section.tables.length > 0) {
      for (const table of section.tables) {
        outputParts.push(serializeMarkdownTable(table), "");
      }
    }

    // Co-locate exclusions directly under coverage clause to prevent chunk severance
    if (section.exclusions && section.exclusions.length > 0) {
      outputParts.push("#### CRITICAL POLICY EXCLUSIONS & LIMITATIONS (WHAT IS NOT COVERED):");
      for (const excl of section.exclusions) {
        outputParts.push(`- ${excl.trim()}`);
      }
      outputParts.push("");
    }

    // Explicit Embargo Notice if present
    if (section.embargoHours) {
      outputParts.push(
        `> ⚠️ **Mandatory Embargo Window:** A strict **${section.embargoHours}-hour embargo** applies post-purchase. No cover for losses occurring within ${section.embargoHours} hours of policy inception unless transferring without lapse.`,
        ""
      );
    }

    outputParts.push("---", "");
  }

  // Mandatory Statutory General Advice Warning & AFCA Escalation
  outputParts.push(formatStatutoryFooter());

  return {
    r2Key,
    metadata,
    markdown: outputParts.join("\n"),
    sectionsCount: sections.length,
  };
}
