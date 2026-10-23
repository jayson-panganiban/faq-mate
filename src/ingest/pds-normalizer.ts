import { serializeMarkdownTable, type TableData } from "./table-serializer";
import { STATUTORY_GAW, AFCA_CONTACT } from "../constants/statutory";

export interface PdsMetadata {
  insurer: string;
  insurerCode: string;
  product: string;
  productSlug: string;
  docType: "PDS" | "TMD" | "SPDS" | "FSG";
  effectiveDate: string;
  version?: string;
  jurisdiction?: string;
}

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
 * Builds canonical R2 storage key adhering to Spec 01 (Section 2.1):
 * corpus/{insurer_code}/{product_slug}/{document_type}_{version_or_effective_date}.md
 */
export function buildR2PathKey(meta: PdsMetadata): string {
  const insurer = meta.insurerCode.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const product = meta.productSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const docType = meta.docType.toUpperCase();
  const versionTag = meta.version || meta.effectiveDate;
  return `corpus/${insurer}/${product}/${docType}_${versionTag}.md`;
}

/**
 * Generates breadcrumb header block adhering to Spec 01 (Section 2.2).
 */
export function generateBreadcrumbHeader(
  meta: PdsMetadata,
  section?: string,
  subSection?: string
): string {
  const lines = [
    "<!-- BREADCRUMB",
    `insurer: ${meta.insurer}`,
    `product: ${meta.product}`,
    `doc_type: ${meta.docType}`,
    `effective_date: ${meta.effectiveDate}`,
  ];

  if (meta.version) lines.push(`version: ${meta.version}`);
  lines.push(`jurisdiction: ${meta.jurisdiction || "Australia (Cth)"}`);
  if (section) lines.push(`section: ${section}`);
  if (subSection) lines.push(`sub_section: ${subSection}`);
  lines.push("-->");

  return lines.join("\n");
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
      outputParts.push(
        "#### CRITICAL POLICY EXCLUSIONS & LIMITATIONS (WHAT IS NOT COVERED):"
      );
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
  outputParts.push(
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
    ""
  );

  return {
    r2Key,
    metadata,
    markdown: outputParts.join("\n"),
    sectionsCount: sections.length,
  };
}
