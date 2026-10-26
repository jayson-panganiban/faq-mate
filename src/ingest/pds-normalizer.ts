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
 * Canonical high-signal defined terms across Home, Motor, Travel, Life, and Commercial lines
 * (Spec 08 § 1 & Issue 01).
 */
const HIGH_SIGNAL_DEFINITION_PATTERN =
  /\b(?:flood|storm|rainwater|run-?off|escape of liquid|actions? of the sea|storm surge|excess|building|contents|home|agreed value|market value|total loss|choice of repairer|unlicensed driver|hire car|pre-?existing|medically necessary|curtailment|unforeseen|total and permanent disablement|tpd|waiting period|benefit period|trauma|terminal illness|public liability|indemnity period|business interruption|embargo|sub-?limit|jewellery|jewelry|valuables)\b/i;

const NON_GLOSSARY_TERM_PREFIX =
  /^(?:this|that|these|those|it|we|you|they|which|what|who|where|when|how|if|unless|because|although|while|wherever|whenever|nothing|anything|something|each|every|either|neither|both|all|any|some|no|not|for|with|from|into|under|over|after|before|during)\b/i;

/**
 * Matches a single-line glossary definition: `[Term] means [definition body]` or `[Term] means:`
 */
function matchInlineDefinition(line: string): { term: string; rest: string } | null {
  const match = line.match(/^([A-Z][A-Za-z0-9\s/()'-]{1,48}?)\s+means(?:\s*:\s*(.*)|\s+(.+))$/);
  if (!match) return null;

  const rawTerm = match[1].trim();
  const rest = (match[2] ?? match[3] ?? "").trim();
  const words = rawTerm.split(/\s+/);

  if (words.length > 6 || rawTerm.length < 3) return null;
  if (NON_GLOSSARY_TERM_PREFIX.test(rawTerm)) return null;
  if (/[.;?!]/.test(rawTerm)) return null;

  return { term: rawTerm, rest };
}

/**
 * Extracts structured operative PolicySections from raw PDF text.
 * Filters out table-of-contents dot-leader lines and page-number noise,
 * extracts discrete `Definitions — [Term]` glossary entries across all insurance lines,
 * and groups paragraphs under semantic policy headings.
 */
export function extractSectionsFromRawPdfText(
  rawText: string,
  fallbackTitle = "Policy Terms & Conditions"
): PolicySection[] {
  const rawLines = rawText
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

  if (rawLines.length === 0) {
    return [];
  }

  // Reassemble standalone bullet symbols (`–`, `-`, `•`) split onto their own line by pdftotext
  const cleanedLines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (/^[-–—•]$/.test(line) && i + 1 < rawLines.length) {
      cleanedLines.push(`- ${rawLines[i + 1]}`);
      i++;
    } else if (/^[–—•]\s+/.test(line)) {
      cleanedLines.push(line.replace(/^[–—•]\s+/, "- "));
    } else {
      cleanedLines.push(line);
    }
  }

  const headingPattern =
    /^(?:#{1,3}\s+|(?:section|part)\s+\d+[:.\s-]*|(?:insured events?|what is covered|what we cover|what is not covered|what we do not cover|general exclusions|exclusions|excess(?:es)?|making a claim|how we settle claims|sub-?limits|limits of cover|important information|definitions|words with special meaning|glossary|cooling-off period|complaints|optional covers?|additional benefits?)(?:\s*[:–-]|\s+[A-Z]|\s*$))/i;

  const rawSections: Array<{ title: string; lines: string[]; isDefinition?: boolean }> = [];
  let currentTitle = fallbackTitle;
  let currentLines: string[] = [];
  let currentIsDefinition = false;

  const flushCurrent = () => {
    if (currentLines.length > 0) {
      rawSections.push({
        title: currentTitle.replace(/^#{1,3}\s*/, "").trim(),
        lines: currentLines,
        isDefinition: currentIsDefinition,
      });
    }
    currentLines = [];
    currentIsDefinition = false;
  };

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];

    // 1. Check for `[Term] means ...` glossary definition line first so `"Excess means..."`
    // is never swallowed as a generic `"Excess"` heading.
    const inlineDef = matchInlineDefinition(line);
    if (inlineDef) {
      flushCurrent();
      currentTitle = `Definitions — ${inlineDef.term}`;
      currentLines = [
        inlineDef.rest
          ? `**${inlineDef.term}** means ${inlineDef.rest}`
          : `**${inlineDef.term}** means:`,
      ];
      currentIsDefinition = true;
      continue;
    }

    // 2. Check for two-line glossary definition where line i is a standalone term and line i+1 starts with `means `
    if (
      i + 1 < cleanedLines.length &&
      /^[A-Z][A-Za-z0-9\s/()'-]{2,45}$/.test(line) &&
      !NON_GLOSSARY_TERM_PREFIX.test(line) &&
      line.split(/\s+/).length <= 5 &&
      /^means(?:\s*:|\s+)(.+)$/i.test(cleanedLines[i + 1])
    ) {
      const nextMatch = cleanedLines[i + 1].match(/^means(?:\s*:|\s+)(.+)$/i);
      if (nextMatch) {
        flushCurrent();
        const term = line.trim();
        currentTitle = `Definitions — ${term}`;
        currentLines = [`**${term}** means ${nextMatch[1].trim()}`];
        currentIsDefinition = true;
        i++;
        continue;
      }
    }

    // 3. Check for standard section heading (strictly excluding lines with `\bmeans\b`)
    const isShortHeading =
      line.length >= 4 &&
      line.length <= 85 &&
      !/[.;,]$/.test(line) &&
      !/\bmeans\b/i.test(line) &&
      headingPattern.test(line);

    if (isShortHeading) {
      flushCurrent();
      currentTitle = line.replace(/^#{1,3}\s*/, "").trim();
      currentIsDefinition = false;
    } else {
      currentLines.push(line);
    }
  }

  flushCurrent();

  // Normalize sections into self-contained retrieval passages
  const normalizedSections: PolicySection[] = [];

  for (const sec of rawSections) {
    // Rejoin soft-wrapped PDF prose lines while keeping `- ` bullet items on their own lines
    const mergedParagraphs: string[] = [];
    for (const rawLine of sec.lines) {
      const l = rawLine.trim();
      if (!l) continue;
      if (
        mergedParagraphs.length === 0 ||
        l.startsWith("- ") ||
        /^\([a-z0-9]+\)\s/i.test(l) ||
        l.includes("|") ||
        mergedParagraphs[mergedParagraphs.length - 1].endsWith(":") ||
        mergedParagraphs[mergedParagraphs.length - 1].endsWith(".") ||
        mergedParagraphs[mergedParagraphs.length - 1].endsWith(";")
      ) {
        mergedParagraphs.push(l);
      } else {
        mergedParagraphs[mergedParagraphs.length - 1] += ` ${l}`;
      }
    }

    let fullText = mergedParagraphs.join("\n").trim();
    if (sec.isDefinition) {
      if (fullText.length < 20) continue;
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;
      if (wordCount < 30) {
        fullText = `${fullText}\n\nThis contractual definition applies across all insured events, policy schedules, and general exclusions unless specified otherwise on your Certificate of Insurance.`;
      }
    } else if (fullText.length < 40) {
      continue;
    }

    // Split into ~1,800 character semantic passages if very long
    const paragraphs = fullText.split(/\n+/);
    let buffer: string[] = [];
    let bufferLen = 0;
    let partIndex = 1;

    const flushBuffer = () => {
      if (buffer.length === 0) return;
      const bodyText = buffer
        .join("\n")
        .replace(/^#{1,6}\s+/gm, "")
        .trim();
      const title = partIndex === 1 ? sec.title : `${sec.title} (Part ${partIndex})`;
      normalizedSections.push(buildNormalizedSection(title, bodyText, Boolean(sec.isDefinition)));

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

  return rankAndCapSections(normalizedSections, 35);
}

function buildNormalizedSection(
  title: string,
  bodyText: string,
  isDefinition: boolean
): PolicySection {
  const classified = classifyClause(title, bodyText);
  const clauseType = isDefinition ? "Definition" : classified.clauseType;

  const lowerTitle = title.toLowerCase();
  const lowerBody = bodyText.toLowerCase();
  const exclusions: string[] = [];
  let embargoHours = classified.embargoHours;

  // Spec 01 § 2.4 & Spec 06 § 6: Co-locate statutory flood demarcation & exclusions on Flood sections
  if (lowerTitle.includes("flood") || lowerBody.includes("prescribed flood definition")) {
    if (
      !lowerBody.includes("sea") &&
      !lowerBody.includes("surge") &&
      !lowerBody.includes("tidal") &&
      !lowerBody.includes("ocean")
    ) {
      exclusions.push(
        "Actions of the Sea & Storm Surge: Loss or damage caused by high tide, king tides, tidal waves, ocean rise, or actions of the sea is excluded."
      );
    }
    if (!lowerBody.includes("insured event 3")) {
      exclusions.push(
        "Rainwater Run-off Demarcation: Surface rainwater run-off escaping over normally dry land (rather than from a natural watercourse, lake, canal, reservoir, or dam) is assessed under Insured Event 3 (Storm cover), not Flood."
      );
    }
    if (!embargoHours) {
      embargoHours = 72;
    }
  }

  // Spec 06 § 6: Ensure natural peril headings (bushfire, cyclone, embargo) co-locate waiting period disclosure
  if (
    (lowerTitle.includes("bushfire") ||
      lowerTitle.includes("cyclone") ||
      lowerTitle.includes("embargo")) &&
    !lowerBody.includes("embargo") &&
    !lowerBody.includes("waiting period") &&
    !lowerBody.includes("hour") &&
    !embargoHours
  ) {
    embargoHours = 72;
  }

  const nonEmptyLines = bodyText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const isPipeOrTabTable =
    nonEmptyLines.length >= 2 &&
    (nonEmptyLines.every((l) => l.includes("|")) || nonEmptyLines.every((l) => l.includes("\t")));

  return {
    title,
    level: 3,
    clauseType,
    content: isPipeOrTabTable
      ? normalizeRawTextTable(bodyText)
      : bodyText.replace(/^\|+|\|+$/gm, ""),
    exclusions: exclusions.length > 0 ? exclusions : undefined,
    embargoHours,
  };
}

function rankAndCapSections(sections: PolicySection[], maxSections: number): PolicySection[] {
  if (sections.length <= maxSections) {
    return sections;
  }

  const scored = sections.map((s, idx) => {
    const text = `${s.title} ${s.content}`.toLowerCase();
    let priority = 0;
    if (s.clauseType === "Definition") {
      priority += 12;
      if (HIGH_SIGNAL_DEFINITION_PATTERN.test(s.title)) {
        priority += 25;
      }
    }
    if (
      /\b(?:flood|storm|bushfire|cyclone|embargo|theft|forcible|jewelry|jewellery|sub-?limit|excess|unlicensed|exclusion|not covered|claim|windscreen|hire car|medical|cancellation|waiting period|benefit|agreed value|market value|total loss|choice of repairer|pre-?existing|curtailment|tpd|disablement|trauma|public liability|indemnity period|business interruption|escape of liquid|rainwater|actions? of the sea)\b/.test(
        text
      )
    ) {
      priority += 10;
    }
    if (s.clauseType === "Exclusion" || s.clauseType === "SubLimit") {
      priority += 6;
    }
    return { s, idx, priority };
  });

  scored.sort((a, b) => b.priority - a.priority || a.idx - b.idx);
  return scored
    .slice(0, maxSections)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.s);
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
