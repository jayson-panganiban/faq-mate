import { PRIMARY_INSURERS, resolveInsurer } from "../constants/insurers";
import { STATUTORY_GAW } from "../constants/statutory";
import { parseBreadcrumb, REQUIRED_BREADCRUMB_FIELDS } from "./corpus-codec";

export interface LintViolation {
  file: string;
  rule:
    | "MISSING_BREADCRUMB"
    | "MISSING_BREADCRUMB_FIELD"
    | "INVALID_INSURER_CODE"
    | "INVALID_CATEGORY"
    | "MALFORMED_TABLE"
    | "MISSING_STATUTORY_GAW"
    | "ORPHANED_EMPTY_SECTION"
    | "PERIL_COLOCATION_VIOLATION";
  message: string;
}

const VALID_CATEGORIES = new Set<string>([
  "suncorp-group",
  "major-insurers",
  "challengers-auto-clubs",
  "travel-specialists",
  "life-insurers",
]);

const VALID_INSURER_CODES = new Set<string>(PRIMARY_INSURERS.map((p) => p.code));

export interface LintReport {
  passed: boolean;
  filesChecked: number;
  violations: LintViolation[];
}

/**
 * Pure Linter: Validates a normalized Markdown document against Spec 01 & Spec 06 invariants.
 */
export function lintMarkdownDocument(fileName: string, markdown: string): LintViolation[] {
  const violations: LintViolation[] = [];

  // 1. Validate <!-- BREADCRUMB ... --> block via Corpus Document Codec
  const parsed = parseBreadcrumb(markdown);
  if (!parsed.hasBreadcrumbBlock) {
    violations.push({
      file: fileName,
      rule: "MISSING_BREADCRUMB",
      message: "Document is missing the mandatory <!-- BREADCRUMB ... --> header block.",
    });
  } else {
    for (const field of REQUIRED_BREADCRUMB_FIELDS) {
      if (!parsed.rawFields[field]) {
        violations.push({
          file: fileName,
          rule: "MISSING_BREADCRUMB_FIELD",
          message: `Breadcrumb block is missing required field '${field}'.`,
        });
      }
    }

    const code = parsed.rawFields["insurer_code"];
    if (code && !VALID_INSURER_CODES.has(code)) {
      violations.push({
        file: fileName,
        rule: "INVALID_INSURER_CODE",
        message: `Insurer code '${code}' must be an uppercase primary insurer code matching PRIMARY_INSURERS in src/constants/insurers.ts.`,
      });
    }

    const cat = parsed.rawFields["category"];
    if (cat && !VALID_CATEGORIES.has(cat)) {
      violations.push({
        file: fileName,
        rule: "INVALID_CATEGORY",
        message: `Category '${cat}' is not a valid InsurerCategory in src/constants/insurers.ts.`,
      });
    }
  }

  // 2. Validate Statutory General Advice Warning (Corporations Act s.949A)
  if (!markdown.includes(STATUTORY_GAW)) {
    violations.push({
      file: fileName,
      rule: "MISSING_STATUTORY_GAW",
      message: "Document is missing the exact STATUTORY_GAW (Corporations Act 2001 s.949A).",
    });
  }

  // 3. Validate Markdown Table Pipe Symmetry and GFM Delimiter Syntax
  const lines = markdown.split(/\r?\n/);
  let inTable = false;
  let expectedColumns = 0;
  let tableRowIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cols = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!inTable) {
        inTable = true;
        tableRowIndex = 0;
        expectedColumns = cols.length;
      } else {
        tableRowIndex++;
        if (cols.length !== expectedColumns) {
          violations.push({
            file: fileName,
            rule: "MALFORMED_TABLE",
            message: `Line ${i + 1}: Table row has ${cols.length} columns, expected ${expectedColumns}.`,
          });
        }
        if (tableRowIndex === 1) {
          // GFM delimiter row check: e.g. | :--- | :--- | or | --- | --- |
          const isDelimiterRow = /^\|(?:\s*:?-+:?\s*\|)+$/.test(line);
          if (!isDelimiterRow) {
            violations.push({
              file: fileName,
              rule: "MALFORMED_TABLE",
              message: `Line ${i + 1}: Table missing valid GFM delimiter row (| :--- | :--- |). Found: '${line}'.`,
            });
          }
        }
      }
    } else {
      inTable = false;
      expectedColumns = 0;
      tableRowIndex = 0;
    }
  }

  // 4. Check that there are no completely empty ### operative sections
  const h3Blocks = markdown.split(/\n(?=###\s+)/);
  for (let i = 1; i < h3Blocks.length; i++) {
    const blockLines = h3Blocks[i]
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l !== "---");

    if (blockLines.length === 0) {
      const headingLine = h3Blocks[i].trim().split(/\r?\n/)[0];
      violations.push({
        file: fileName,
        rule: "ORPHANED_EMPTY_SECTION",
        message: `Operative section '${headingLine}' has no body content.`,
      });
    }
  }

  // 5. Peril-Embargo Co-Location Validation (Spec 06 § 6 & § 8)
  if (parsed.docType === "PDS" || parsed.docType === "SPDS" || parsed.docType === "TMD") {
    for (let i = 1; i < h3Blocks.length; i++) {
      const block = h3Blocks[i].toLowerCase();
      const headingLine = h3Blocks[i].trim().split(/\r?\n/)[0];

      // Operative flood clauses must co-locate action of the sea / storm surge exclusions
      if (
        headingLine.toLowerCase().includes("flood") ||
        block.includes("prescribed flood definition")
      ) {
        const hasSurgeOrSeaExclusion =
          block.includes("sea") ||
          block.includes("surge") ||
          block.includes("tidal") ||
          block.includes("ocean");

        if (!hasSurgeOrSeaExclusion) {
          violations.push({
            file: fileName,
            rule: "PERIL_COLOCATION_VIOLATION",
            message: `Flood section '${headingLine}' is missing co-located action of the sea / storm surge exclusion (Spec 06 § 6).`,
          });
        }
      }

      // Bushfire / cyclone / embargo operative sections must disclose the statutory waiting period
      if (
        (headingLine.toLowerCase().includes("bushfire") ||
          headingLine.toLowerCase().includes("cyclone") ||
          headingLine.toLowerCase().includes("embargo")) &&
        !block.includes("embargo") &&
        !block.includes("waiting period") &&
        !block.includes("hour")
      ) {
        violations.push({
          file: fileName,
          rule: "PERIL_COLOCATION_VIOLATION",
          message: `Natural peril section '${headingLine}' is missing co-located statutory embargo/waiting period disclosure (48h or 72h).`,
        });
      }
    }
  }

  return violations;
}

/**
 * Lints a batch of normalized corpus documents.
 */
export function lintCorpusBatch(documents: Array<{ file: string; markdown: string }>): LintReport {
  const allViolations: LintViolation[] = [];
  for (const doc of documents) {
    allViolations.push(...lintMarkdownDocument(doc.file, doc.markdown));
  }

  return {
    passed: allViolations.length === 0,
    filesChecked: documents.length,
    violations: allViolations,
  };
}
