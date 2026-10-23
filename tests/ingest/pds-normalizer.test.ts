import { describe, it, expect } from "vitest";
import {
  serializeMarkdownTable,
  serializeSubLimitsTable,
  normalizeRawTextTable,
} from "../../src/ingest/table-serializer";
import {
  buildR2PathKey,
  generateBreadcrumbHeader,
  normalizePdsDocument,
  type PdsMetadata,
} from "../../src/ingest/pds-normalizer";

describe("Spec 01: Ingestion & PDS Normalization Pipeline", () => {
  describe("1. Table Serialization (Spec 01 Section 2.3)", () => {
    it("serializes sub-limit schedules into standard GitHub-Flavored Markdown tables", () => {
      const tableMd = serializeSubLimitsTable([
        {
          category: "Jewelry and Watches",
          standardSubLimit: "$2,500 total ($1,000 per item)",
          optionalIncreaseAvailable: true,
          notes: "specified on certificate",
        },
        {
          category: "Cash, Cheques & Bank Notes",
          standardSubLimit: "$500 total",
          optionalIncreaseAvailable: false,
        },
      ]);

      expect(tableMd).toContain("| Item Category");
      expect(tableMd).toContain("| Standard Sub-Limit");
      expect(tableMd).toContain("| Optional Increase Available?");
      expect(tableMd).toContain("| Jewelry and Watches");
      expect(tableMd).toContain("$2,500 total ($1,000 per item)");
      expect(tableMd).toContain("Yes, specified on certificate");
      expect(tableMd).toContain("No");
    });

    it("normalizes delimited text lines into aligned Markdown tables", () => {
      const rawText = "Benefit | Standard Limit | Excess\nTowing | Covered | Nil\nHire Car | $100/day | Basic";
      const table = normalizeRawTextTable(rawText);

      expect(table).toContain("| Benefit");
      expect(table).toContain("| Standard Limit");
      expect(table).toContain("| Towing");
      expect(table).toContain("| Hire Car");
    });
  });

  describe("2. Canonical Path Conventions (Spec 01 Section 2.1)", () => {
    it("generates structured R2 keys conforming to corpus/{insurer}/{product}/{docType}_{version}.md", () => {
      const meta: PdsMetadata = {
        insurer: "Suncorp",
        insurerCode: "suncorp",
        product: "Classic Home Building & Contents",
        productSlug: "home-contents-classic",
        docType: "PDS",
        effectiveDate: "2024-01-15",
        version: "2024-01-15",
      };

      const key = buildR2PathKey(meta);
      expect(key).toBe("corpus/suncorp/home-contents-classic/PDS_2024-01-15.md");
    });
  });

  describe("3. Hierarchical Breadcrumbs & Domain Exclusion Preservation (Spec 01 Section 2.2 & 2.4)", () => {
    const testMeta: PdsMetadata = {
      insurer: "Suncorp",
      insurerCode: "suncorp",
      product: "Home & Contents Classic",
      productSlug: "home-contents-classic",
      docType: "PDS",
      effectiveDate: "2024-01-15",
      jurisdiction: "Australia (Cth)",
    };

    it("injects BREADCRUMB header block", () => {
      const header = generateBreadcrumbHeader(testMeta, "Insured Events", "Flood");
      expect(header).toContain("<!-- BREADCRUMB");
      expect(header).toContain("insurer: Suncorp");
      expect(header).toContain("product: Home & Contents Classic");
      expect(header).toContain("doc_type: PDS");
      expect(header).toContain("section: Insured Events");
      expect(header).toContain("sub_section: Flood");
      expect(header).toContain("-->");
    });

    it("co-locates statutory exclusions and embargoes with the coverage clause", () => {
      const doc = normalizePdsDocument(testMeta, [
        {
          title: "Insured Event 7: Flood",
          level: 3,
          clauseType: "Coverage",
          content: "We cover loss or damage to your home caused by flood.",
          exclusions: [
            "Action of the sea and storm surge are strictly excluded.",
            "Retaining walls and garden borders are not covered.",
          ],
          embargoHours: 72,
        },
      ]);

      expect(doc.markdown).toContain("<!-- BREADCRUMB");
      expect(doc.markdown).toContain("### Insured Event 7: Flood");
      expect(doc.markdown).toContain("CRITICAL POLICY EXCLUSIONS & LIMITATIONS");
      expect(doc.markdown).toContain("Action of the sea and storm surge are strictly excluded.");
      expect(doc.markdown).toContain("72-hour embargo");
      expect(doc.markdown).toContain("General Advice Warning");
      expect(doc.markdown).toContain("Australian Financial Complaints Authority (AFCA)");
    });
  });
});
