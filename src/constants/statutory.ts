/**
 * Canonical Statutory Notices & Legal Disclosures
 * Single source of truth derived from GLOSSARY.md and Spec 03.
 */

/**
 * Mandatory statutory General Advice Warning under Section 949A of the Corporations Act 2001 (Cth).
 * Canonical copy defined in GLOSSARY.md § 2.
 */
export const STATUTORY_GAW =
  "⚠️ General Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent professional advice.";

/**
 * ASIC RG 244 Safe Harbor Refusal Copy for Personal Advice requests (Spec 03 § 1.2).
 */
export const STATUTORY_SAFE_HARBOR_REFUSAL =
  "I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.\n\n" +
  "I can, however, provide factual information regarding what is covered or excluded under published Product Disclosure Statements (PDS).\n\n" +
  STATUTORY_GAW;

/**
 * Emergency hotlines mandated under General Insurance Code of Practice (COP) for vulnerable customers.
 */
export const EMERGENCY_HOTLINES = {
  lifeThreat: "Triple Zero (000)",
  ses: "State Emergency Service (SES): 132 500",
  disasterWelfare: "Disaster Welfare Services: 1800 018 444",
  summary: "Triple Zero (000), SES (132 500), or Disaster Welfare Services (1800 018 444)",
} as const;

export const EMERGENCY_REFUSAL_MESSAGE =
  "🚨 EMERGENCY ASSISTANCE: If you or your property are in immediate life danger, please immediately call Triple Zero (000).\n" +
  `• For storm or flood emergency assistance, contact the ${EMERGENCY_HOTLINES.ses}.\n` +
  `• For emergency accommodation and disaster support, contact ${EMERGENCY_HOTLINES.disasterWelfare}.`;

/**
 * Australian Financial Complaints Authority (AFCA) External Dispute Resolution contacts.
 */
export const AFCA_CONTACT = {
  name: "Australian Financial Complaints Authority (AFCA)",
  phone: "1800 931 678",
  website: "https://www.afca.org.au",
  post: "GPO Box 3, Melbourne VIC 3001",
} as const;

/**
 * Tests whether a text block contains statutory General Advice Warning disclaimer phrasing
 * under Corporations Act 2001 (Cth) s.949A.
 */
export function isGawDisclaimerText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  return (
    ((lower.includes("personal objectives") || lower.includes("personal financial situation")) &&
      (lower.includes("needs") ||
        lower.includes("financial situation") ||
        lower.includes("budget") ||
        lower.includes("pds") ||
        lower.includes("product disclosure statement") ||
        lower.includes("target market determination") ||
        lower.includes("tmd"))) ||
    lower.includes("this information is general product information only") ||
    lower.includes("this information is general factual information only") ||
    lower.includes("does not consider your personal") ||
    lower.includes("does not take into account your personal") ||
    lower.includes("before making any financial decision, you should read the relevant") ||
    lower.includes(STATUTORY_GAW.toLowerCase()) ||
    /^(?:[-*•]\s+|\d+[.)]\s+|>\s*|["'“”‘’]+|#{1,6}\s+|\*{1,2}|_{1,2})*(?:⚠️\s*)?(?:\*{1,2}|_{1,2})?(?:statutory\s+)?general advice warning(?:\*{1,2}|_{1,2})?(?:\s*\([^)]*\))?\s*[:—-]\s*(?:this|the)\b/i.test(
      lower
    ) ||
    /^(?:[-*•]\s+|\d+[.)]\s+|>\s*|["'“”‘’]+|#{1,6}\s+|\*{1,2}|_{1,2})*⚠️\s*(?:\*{1,2}|_{1,2})?general advice warning\b/i.test(
      lower
    )
  );
}

/**
 * Tests whether a single line is a standalone heading or label introducing a General Advice Warning
 * or Statutory Disclaimer section (without educational body text on the same line).
 */
export function isGawHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^(?:[-*_]{3,}\s*)?(?:>\s*)?(?:#{1,6}\s*|\*{1,2}|_{1,2}|[-*•]\s+|\d+[.)]\s+)*(?:⚠️\s*)?(?:\*{1,2}|_{1,2})?(?:(?:\d+[.)]\s*)?(?:Statutory\s+)?(?:General Advice Warning|Statutory Disclaimer|Disclaimer))(?:\*{1,2}|_{1,2})?(?:\s*\([^)]*\))?\s*:?\s*$/i.test(
    trimmed
  );
}

/**
 * Strips raw statutory General Advice Warning disclaimers from a message.
 * Handles exact STATUTORY_GAW, markdown headings (#, ##, ###), bold/italic markers,
 * blockquotes (>), bulleted/numbered list items (-, *, 1.), quoted strings ("..."),
 * partial streaming tails, and preceding horizontal rules (---, ***).
 *
 * Ensures normal prose explaining General Advice Warnings is preserved, while
 * boilerplate disclaimers are removed so UI components (e.g. <StatutoryGaw />)
 * can present the disclaimer cleanly without duplication.
 */
export function stripStatutoryGaw(text: string): string {
  if (!text) return "";

  // 1. Filter out lines that are themselves standalone GAW disclaimers (bullets, paragraphs, exact matches)
  const rawLines = text.split(/\r?\n/);
  const filteredLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (trimmed && isGawDisclaimerText(trimmed)) {
      // Also drop an immediately preceding GAW-only heading and divider if this disclaimer was under it
      while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === "") {
        filteredLines.pop();
      }
      if (filteredLines.length > 0 && isGawHeadingLine(filteredLines[filteredLines.length - 1])) {
        filteredLines.pop();
        while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === "") {
          filteredLines.pop();
        }
      }
      if (
        filteredLines.length > 0 &&
        /^[-*_]{3,}$/.test(filteredLines[filteredLines.length - 1].trim())
      ) {
        filteredLines.pop();
      }
      continue;
    }

    filteredLines.push(line);
  }

  let cleaned = filteredLines.join("\n").trimEnd();
  let prev = "";

  // 2. Iteratively strip any remaining trailing GAW headings, dividers, or multi-line disclaimer tails
  while (cleaned && cleaned !== prev) {
    prev = cleaned;

    const lines = cleaned.split(/\r?\n/);
    const lastLine = lines[lines.length - 1]?.trim() ?? "";

    // Strip orphaned trailing GAW heading or horizontal rule divider
    if (isGawHeadingLine(lastLine) || /^[-*_]{3,}$/.test(lastLine)) {
      lines.pop();
      cleaned = lines.join("\n").trimEnd();
      continue;
    }

    // Check if a trailing multi-line block starting at a GAW heading is a disclaimer
    let lastGawLineIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (isGawHeadingLine(lines[i])) {
        lastGawLineIdx = i;
        break;
      }
    }

    if (lastGawLineIdx !== -1) {
      const blockText = lines.slice(lastGawLineIdx).join("\n");
      if (isGawDisclaimerText(blockText)) {
        let cutLineIdx = lastGawLineIdx;
        if (cutLineIdx > 0 && /^[-*_]{3,}$/.test(lines[cutLineIdx - 1].trim())) {
          cutLineIdx--;
        }
        cleaned = lines.slice(0, cutLineIdx).join("\n").trimEnd();
        continue;
      }
    }

    // Warning body phrase without title at the end
    const bodyPhraseRegex =
      /(?:[\r\n]+|^)\s*(?:[-*_]{3,}\s*[\r\n]+)?\s*(?:>\s*|[-*•]\s+|\d+[.)]\s+|["'“”‘’]+)*(?:This information is general (?:product|factual) information only and does not (?:take into account|consider) your personal objectives|does not (?:take into account|consider) your personal objectives,\s*financial situation,\s*or needs)[\s\S]*$/i;
    const bodyMatch = cleaned.match(bodyPhraseRegex);
    if (bodyMatch && bodyMatch.index !== undefined) {
      cleaned = cleaned.substring(0, bodyMatch.index).trimEnd();
    }
  }

  return cleaned.trimEnd();
}
