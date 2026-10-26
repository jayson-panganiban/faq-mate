import { toInsurerSlug } from "../constants/insurers";
import { AFCA_CONTACT, STATUTORY_GAW } from "../constants/statutory";

export type CorpusDocType = "PDS" | "TMD" | "SPDS" | "FSG" | "FAQ" | "GUIDE";

export interface CorpusDocumentMetadata {
  insurer: string;
  insurerCode: string;
  product: string;
  productSlug: string;
  docType: CorpusDocType;
  effectiveDate: string;
  version?: string;
  jurisdiction?: string;
  category?: string;
  underwriter?: string;
  sourceUrl?: string;
}

export interface ParsedBreadcrumb {
  insurer: string;
  insurerCode: string;
  category: string;
  product: string;
  productSlug: string;
  docType: CorpusDocType;
  effectiveDate: string;
  jurisdiction: string;
  underwriter?: string;
  rawFields: Record<string, string>;
  hasBreadcrumbBlock: boolean;
}

export const REQUIRED_BREADCRUMB_FIELDS = [
  "insurer",
  "insurer_code",
  "category",
  "product",
  "doc_type",
  "effective_date",
  "jurisdiction",
] as const;

/**
 * Deep Module: Canonical R2 Path Key Resolver (Spec 01 § 2.1 v2.0)
 * - Policy documents (PDS/SPDS/TMD/FSG): `corpus/pds/{insurer_code}/{product_slug}/{doc_type}_{effective_date}.md`
 * - FAQ documents: `corpus/faqs/{insurer_code}.md`
 * - Guide documents: `corpus/guides/{insurer_code}/{page_slug}/{doc_type}_{effective_date}.md`
 */
export function buildR2PathKey(meta: CorpusDocumentMetadata): string {
  const insurer = toInsurerSlug(meta.insurerCode);
  const docType = meta.docType.toUpperCase();

  if (docType === "FAQ") {
    return `corpus/faqs/${insurer}.md`;
  }

  const product = toInsurerSlug(meta.productSlug) || "policy";
  const versionTag = meta.version || meta.effectiveDate;

  if (docType === "GUIDE") {
    return `corpus/guides/${insurer}/${product}/${docType}_${versionTag}.md`;
  }

  return `corpus/pds/${insurer}/${product}/${docType}_${versionTag}.md`;
}

/**
 * Deep Module: Serializes the canonical `<!-- BREADCRUMB ... -->` frontmatter header (Spec 01 § 2.2).
 */
export function generateBreadcrumbHeader(
  meta: CorpusDocumentMetadata,
  section?: string,
  subSection?: string,
  extraFields?: Record<string, string | number>
): string {
  const lines = [
    "<!-- BREADCRUMB",
    `insurer: ${meta.insurer}`,
    `insurer_code: ${meta.insurerCode}`,
  ];

  if (meta.category) lines.push(`category: ${meta.category}`);
  lines.push(
    `product: ${meta.product}`,
    `doc_type: ${meta.docType}`,
    `effective_date: ${meta.effectiveDate}`
  );

  if (meta.version) lines.push(`version: ${meta.version}`);
  if (meta.underwriter) lines.push(`underwriter: ${meta.underwriter}`);
  if (meta.sourceUrl) lines.push(`source_url: ${meta.sourceUrl}`);
  lines.push(`jurisdiction: ${meta.jurisdiction || "Australia (Cth)"}`);
  if (section) lines.push(`section: ${section}`);
  if (subSection) lines.push(`sub_section: ${subSection}`);

  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      lines.push(`${k}: ${v}`);
    }
  }

  lines.push("-->");
  return lines.join("\n");
}

/**
 * Deep Module: Parses a `<!-- BREADCRUMB ... -->` block from a normalized Markdown document
 * and resolves its canonical R2 key.
 */
export function parseBreadcrumb(markdown: string): ParsedBreadcrumb {
  const match = markdown.match(/<!--\s*BREADCRUMB([\s\S]*?)-->/);
  const rawFields: Record<string, string> = {};

  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const key = line.slice(0, idx).trim().toLowerCase();
        const val = line.slice(idx + 1).trim();
        if (key && val) rawFields[key] = val;
      }
    }
  }

  const insurer = rawFields["insurer"] || "General";
  const insurerCode = rawFields["insurer_code"] || toInsurerSlug(insurer);
  const product = rawFields["product"] || "Insurance Policy";
  const productSlug = rawFields["product_slug"] || toInsurerSlug(product) || "policy";
  const rawDocType = (rawFields["doc_type"] || "PDS").toUpperCase();
  const docType = (
    ["PDS", "TMD", "SPDS", "FSG", "FAQ", "GUIDE"].includes(rawDocType) ? rawDocType : "PDS"
  ) as CorpusDocumentMetadata["docType"];

  return {
    insurer,
    insurerCode,
    category: rawFields["category"] || "general",
    product,
    productSlug,
    docType,
    effectiveDate: rawFields["effective_date"] || "2026-01-01",
    jurisdiction: rawFields["jurisdiction"] || "Australia (Cth)",
    underwriter: rawFields["underwriter"],
    rawFields,
    hasBreadcrumbBlock: Boolean(match),
  };
}

/**
 * Renders the mandatory Statutory General Advice Warning (Corporations Act s.949A)
 * and AFCA External Dispute Resolution footer block.
 */
export function formatStatutoryFooter(): string {
  return [
    "## Statutory Notices & Regulatory Dispute Resolution",
    "",
    "### General Advice Warning (Corporations Act 2001 Section 949A)",
    STATUTORY_GAW,
    "",
    "### Australian Financial Complaints Authority (AFCA)",
    "If you have an unresolved complaint about a claim or policy interpretation:",
    `- **External Dispute Resolution:** ${AFCA_CONTACT.name}`,
    `- **Freecall:** ${AFCA_CONTACT.phone}`,
    `- **Online:** ${AFCA_CONTACT.website}`,
    "",
  ].join("\n");
}
