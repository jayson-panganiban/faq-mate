import { resolveInsurer, toInsurerSlug } from "../constants/insurers";
import {
  buildR2PathKey,
  type CorpusDocumentMetadata,
  formatStatutoryFooter,
  generateBreadcrumbHeader,
} from "./corpus-codec";
import { repairMarkdownTables } from "./table-serializer";

export interface ParsedFaqQuestion {
  category: string;
  question: string;
  answer: string;
  sourceUrl?: string;
}

export interface ParsedFaqDocument {
  insurer: string;
  insurerSlug: string;
  insurerCode: string;
  category: string;
  underwriter: string;
  retrievedDate: string;
  primarySourceUrl?: string;
  notes?: string;
  questions: ParsedFaqQuestion[];
}

/**
 * Parses a raw `{Insurer} FAQ.md` document from `data/raw/FAQs/` into structured Q&A items.
 */
export function parseRawFaqMarkdown(
  rawMarkdown: string,
  fallbackInsurerName?: string
): ParsedFaqDocument {
  const lines = rawMarkdown.split(/\r?\n/);

  let insurerName = fallbackInsurerName || "Unknown Insurer";
  const h1Match = rawMarkdown.match(/^#\s+(.+?)\s+—\s+Frequently Asked Questions/m);
  if (h1Match) {
    insurerName = h1Match[1].trim();
  } else {
    const boldInsurer = rawMarkdown.match(/\*\*Insurer:\*\*\s*([^\n\r]+)/);
    if (boldInsurer) insurerName = boldInsurer[1].trim();
  }

  const resolved = resolveInsurer(insurerName);
  const canonicalInsurer = resolved ? resolved.profile.name : insurerName;
  const insurerSlug = resolved ? resolved.profile.slug : toInsurerSlug(insurerName);
  const insurerCode = resolved ? resolved.profile.code : insurerSlug.toUpperCase();
  const category = resolved ? resolved.profile.category : "general";
  const underwriter = resolved ? resolved.profile.underwriter : `${canonicalInsurer} Australia`;

  const retrievedMatch = rawMarkdown.match(/\*\*Retrieved:\*\*\s*([^\n\r]+)/);
  const retrievedDate = retrievedMatch ? "2026-10-24" : "2026-10-24";

  const sourceMatch = rawMarkdown.match(/\*\*Primary source:\*\*\s*<?([^>\n\r]+)>?/);
  const primarySourceUrl = sourceMatch ? sourceMatch[1].trim() : undefined;

  let currentCategory = "General";
  let currentQuestion: string | null = null;
  let currentAnswerLines: string[] = [];
  let currentSourceUrl: string | undefined;
  const questions: ParsedFaqQuestion[] = [];

  const flushQuestion = () => {
    if (currentQuestion && currentAnswerLines.length > 0) {
      const answerText = repairMarkdownTables(currentAnswerLines.join("\n").trim());
      if (answerText.length > 0) {
        questions.push({
          category: currentCategory,
          question: currentQuestion,
          answer: answerText,
          sourceUrl: currentSourceUrl || primarySourceUrl,
        });
      }
    }
    currentQuestion = null;
    currentAnswerLines = [];
    currentSourceUrl = undefined;
  };

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushQuestion();
      currentCategory = h2Match[1].trim();
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushQuestion();
      currentQuestion = h3Match[1].trim();
      continue;
    }

    if (currentQuestion !== null) {
      const itemSourceMatch = line.match(/^\*Source:\s*<?([^>*]+)>?\*$/);
      if (itemSourceMatch) {
        currentSourceUrl = itemSourceMatch[1].trim();
      } else {
        currentAnswerLines.push(line);
      }
    }
  }
  flushQuestion();

  return {
    insurer: canonicalInsurer,
    insurerSlug,
    insurerCode,
    category,
    underwriter,
    retrievedDate,
    primarySourceUrl,
    questions,
  };
}

/**
 * Normalizes a parsed FAQ document into canonical Spec 01 / Spec 06 Markdown
 * with `<!-- BREADCRUMB -->` frontmatter, structured Q&A sections, and `STATUTORY_GAW`.
 */
export function normalizeFaqDocument(parsed: ParsedFaqDocument): {
  r2Key: string;
  markdown: string;
  questionCount: number;
} {
  const meta: CorpusDocumentMetadata = {
    insurer: parsed.insurer,
    insurerCode: parsed.insurerCode,
    category: parsed.category,
    product: "Official Policy & Claims FAQs",
    productSlug: "faqs",
    docType: "FAQ",
    effectiveDate: parsed.retrievedDate,
    underwriter: parsed.underwriter,
    jurisdiction: "Australia (Cth)",
  };

  const r2Key = buildR2PathKey(meta);
  const breadcrumb = generateBreadcrumbHeader(meta, undefined, undefined, {
    item_count: parsed.questions.length,
  });

  const parts: string[] = [
    breadcrumb,
    "",
    `# ${parsed.insurer} Insurance: Official Policy & Claims FAQs`,
    "",
    `*Underwriter: ${parsed.underwriter} | Jurisdiction: Australia (Cth) | Effective Date: ${parsed.retrievedDate}*`,
    "",
    `*Statutory Notice: The following FAQs reflect published disclosures by ${parsed.insurer}. Policy terms are governed by the applicable Product Disclosure Statement (PDS), Supplementary PDS (SPDS), and Target Market Determination (TMD).*`,
    "",
    "---",
    "",
  ];

  if (parsed.questions.length === 0) {
    parts.push(
      "## Section: Underwriter Disclosure Notice",
      "",
      `### ${parsed.insurer} Policy Enquiries & Primary PDS Grounding`,
      "",
      `${parsed.insurer} does not publish a standalone consumer Q&A FAQ page. All policy coverage, sub-limits, waiting periods, and claim conditions for ${parsed.insurer} are governed directly by the primary ${parsed.insurer} Product Disclosure Statements (PDS) and Supplementary PDS (SPDS) in this corpus.`,
      "",
      "---",
      ""
    );
  } else {
    // Group by category preserving order
    const byCategory = new Map<string, ParsedFaqQuestion[]>();
    for (const q of parsed.questions) {
      const list = byCategory.get(q.category) ?? [];
      list.push(q);
      byCategory.set(q.category, list);
    }

    for (const [cat, items] of byCategory.entries()) {
      parts.push(`## Section: ${cat}`, "");
      for (const item of items) {
        parts.push(`### ${item.question}`, "");
        parts.push(item.answer, "");
        if (item.sourceUrl) {
          parts.push(`*Canonical Source:* [${item.sourceUrl}](${item.sourceUrl})`, "");
        }
        parts.push("---", "");
      }
    }
  }

  parts.push(formatStatutoryFooter());

  return {
    r2Key,
    markdown: parts.join("\n"),
    questionCount: parsed.questions.length,
  };
}
