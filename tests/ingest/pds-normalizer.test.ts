import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { PRIMARY_INSURERS, resolveInsurer } from "../../src/constants/insurers";
import { STATUTORY_GAW } from "../../src/constants/statutory";
import { evaluateAdviceBoundary } from "../../src/guardrails/advice-gatekeeper";
import {
  compileCorpusToTypeScript,
  compileMarkdownToChunks,
} from "../../src/ingest/corpus-compiler";
import { lintMarkdownDocument } from "../../src/ingest/corpus-linter";
import { normalizeFaqDocument, parseRawFaqMarkdown } from "../../src/ingest/faq-normalizer";
import { parseManifestCsv, selectManifestEntries } from "../../src/ingest/manifest-selector";
import {
  buildR2PathKey,
  extractSectionsFromRawPdfText,
  generateBreadcrumbHeader,
  normalizePdsDocument,
  type PdsMetadata,
} from "../../src/ingest/pds-normalizer";
import { normalizeRawTextTable, serializeSubLimitsTable } from "../../src/ingest/table-serializer";

describe("Spec 01 & Spec 06: Ground-Up Ingestion, Linter & Edge AST Compiler (v2.0)", () => {
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
      const rawText =
        "Benefit | Standard Limit | Excess\nTowing | Covered | Nil\nHire Car | $100/day | Basic";
      const table = normalizeRawTextTable(rawText);

      expect(table).toContain("| Benefit");
      expect(table).toContain("| Standard Limit");
      expect(table).toContain("| Towing");
      expect(table).toContain("| Hire Car");
    });
  });

  describe("2. Canonical Path Conventions (Spec 01 Section 2.1)", () => {
    it("generates structured R2 keys conforming to corpus/pds/{insurer}/{product}/{docType}_{version}.md and corpus/faqs/{insurer}.md", () => {
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
      expect(key).toBe("corpus/pds/suncorp/home-contents-classic/PDS_2024-01-15.md");

      const faqKey = buildR2PathKey({
        ...meta,
        docType: "FAQ",
      });
      expect(faqKey).toBe("corpus/faqs/suncorp.md");
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
      expect(header).toContain("insurer_code: suncorp");
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

  describe("4. Canonical 39-Insurer Registry & Bancassurance Alias Resolution", () => {
    it("registers all 39 primary insurers in the archive", () => {
      expect(PRIMARY_INSURERS).toHaveLength(39);
    });

    it("resolves primary insurers and Bancassurance/white-label brand aliases", () => {
      expect(resolveInsurer("AAMI")?.profile.slug).toBe("aami");
      expect(resolveInsurer("Southern Cross Travel Insurance")?.profile.slug).toBe(
        "southern-cross-travel-insurance"
      );
      expect(resolveInsurer("CommBank")?.profile.slug).toBe("allianz");
      expect(resolveInsurer("ANZ")?.profile.slug).toBe("qbe");
      expect(resolveInsurer("Coles Insurance")?.profile.slug).toBe("cgu");
      expect(resolveInsurer("ROLLiN'")?.profile.slug).toBe("cgu");
      expect(resolveInsurer("MLC Life")?.profile.slug).toBe("acenda");
      expect(resolveInsurer("NonExistentFakeBrandXYZ")).toBeNull();
    });
  });

  describe("5. Manifest Selection & Current-Edition Deduplication", () => {
    const sampleCsv = [
      "insurer,category,product,type,title,file,bytes,url",
      "Youi,,Home,PDS,Home Insurance PDS (2023-07-05),Youi PDS/Home/home-pds-2023-07-05.pdf,500000,https://youi.com.au/2023.pdf",
      "Youi,,Home,PDS,Home Insurance PDS (2024-07-03),Youi PDS/Home/home-pds-2024-07-03.pdf,520000,https://youi.com.au/2024.pdf",
      "Youi,,Home,PDS,Home Insurance PDS (current),Youi PDS/Home/home-pds-current.pdf,550000,https://youi.com.au/current.pdf",
      "Suncorp,Archived Documents,Home & Contents,PDS,Old Home PDS,Suncorp PDS/Archived Documents/old.pdf,400000,https://suncorp.com.au/old.pdf",
      "Suncorp,Home & Contents Documents,Home & Contents,PDS,Current Home PDS 18-08-26,Suncorp PDS/Home & Contents/suncorp-18-08-26.pdf,450000,https://suncorp.com.au/new.pdf",
    ].join("\n");

    it("selects only the latest current edition by default and all editions with includeHistorical", () => {
      const entries = parseManifestCsv(sampleCsv);
      expect(entries).toHaveLength(5);

      const currentOnly = selectManifestEntries(entries, { includeHistorical: false });
      expect(currentOnly).toHaveLength(2);
      expect(currentOnly.find((e) => e.insurerSlug === "youi")?.file).toContain(
        "home-pds-current.pdf"
      );
      expect(currentOnly.find((e) => e.insurerSlug === "suncorp")?.file).toContain(
        "suncorp-18-08-26.pdf"
      );

      const allHistorical = selectManifestEntries(entries, { includeHistorical: true });
      expect(allHistorical).toHaveLength(5);
    });
  });

  describe("6. FAQ Markdown Parser, Corpus Linter & AST Edge Compiler", () => {
    const rawFaq = [
      "# AAMI — Frequently Asked Questions",
      "",
      "**Insurer:** AAMI",
      "**Q&As:** 2",
      "**Retrieved:** 24 October 2026",
      "",
      "## Motor Insurance",
      "",
      "### What is a basic excess?",
      "",
      "An excess is the contribution you pay towards a claim under your policy.",
      "",
      "*Source: <https://www.aami.com.au/faq>*",
    ].join("\n");

    it("parses raw FAQ markdown, normalizes with breadcrumbs & GAW, passes linter, and compiles self-contained AST chunks", () => {
      const parsed = parseRawFaqMarkdown(rawFaq);
      expect(parsed.insurer).toBe("AAMI");
      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].category).toBe("Motor Insurance");

      const normalized = normalizeFaqDocument(parsed);
      const violations = lintMarkdownDocument("faqs/aami.md", normalized.markdown);
      expect(violations).toHaveLength(0);

      const chunks = compileMarkdownToChunks({
        file: "faqs/aami.md",
        markdown: normalized.markdown,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Verify no heading-only chunks exist
      for (const chunk of chunks) {
        const lines = chunk.content
          .trim()
          .split("\n")
          .filter((l) => l.trim().length > 0);
        expect(lines.length).toBeGreaterThan(1);
      }

      const compiledBundle = compileCorpusToTypeScript([
        { file: "faqs/aami.md", markdown: normalized.markdown },
      ]);
      expect(compiledBundle.typescriptSource).toContain("export const STATIC_CORPUS_CHUNKS");
    });

    it("linter catches missing breadcrumbs, malformed tables, and missing STATUTORY_GAW", () => {
      const badMd = [
        "# Broken Document",
        "| Col A | Col B |",
        "| :--- | :--- |",
        "| Only One Cell |",
        "### Empty Heading",
        "---",
      ].join("\n");

      const violations = lintMarkdownDocument("bad.md", badMd);
      const rules = violations.map((v) => v.rule);
      expect(rules).toContain("MISSING_BREADCRUMB");
      expect(rules).toContain("MISSING_STATUTORY_GAW");
      expect(rules).toContain("MALFORMED_TABLE");
      expect(rules).toContain("ORPHANED_EMPTY_SECTION");
      expect(STATUTORY_GAW).toContain("General Advice Warning");
    });
  });

  describe("7. Mechanical Guardrail: V8 Isolate Portability & 39-Insurer RG 244 Gatekeeper", () => {
    it("enforces zero Node.js filesystem or process.cwd() imports across all files in src/", () => {
      function walkSrc(dir: string): string[] {
        const out: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) out.push(...walkSrc(full));
          else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
        }
        return out;
      }

      const srcDir = path.resolve(process.cwd(), "src");
      const files = walkSrc(srcDir);
      const bannedPattern =
        /\b(?:node:fs|node:child_process|from\s+["']fs["']|from\s+["']child_process["']|process\.cwd\s*\()/;

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        expect(
          bannedPattern.test(content),
          `Prohibited Node.js runtime API found in ${path.relative(process.cwd(), file)}`
        ).toBe(false);
      }
    });

    it("intercepts brand-comparison advice requests across all 39 insurers and Bancassurance aliases", () => {
      const v1 = evaluateAdviceBoundary("Is AAMI better than Budget Direct for my car?");
      expect(v1.allowed).toBe(false);

      const v2 = evaluateAdviceBoundary("Is CommBank better than Westpac for home insurance?");
      expect(v2.allowed).toBe(false);

      const v3 = evaluateAdviceBoundary("Is Cover-More better than 1Cover for ski travel?");
      expect(v3.allowed).toBe(false);
    });
  });

  describe("8. Universal Multi-Line PDF Section Extractor & Term-Level Glossary Parsing (Spec 08 Issue 01)", () => {
    it("extracts discrete Definitions — [Term] sections across Home, Motor, Travel, Life, and Commercial PDS text without swallowing subsequent definitions into Excess (Part N)", () => {
      const sampleMultiLinePdfText = [
        "Words with special meaning",
        "Cryptocurrency means any form of currency that only exists in digital form.",
        "Excess means the amount(s) You must contribute to the cost of a claim. The amount and types of Excess that apply to Your Policy will be shown on Your Certificate of Insurance.",
        "Flood means the covering of normally dry land by water that has escaped or been released from the normal confines of any of the following:",
        "–",
        "a lake (whether or not it has been altered or modified);",
        "–",
        "a river (whether or not it has been altered or modified);",
        "–",
        "a creek, canal, reservoir, or dam.",
        "Storm means violent wind, cyclone, tornado, hail, rain, or snow.",
        "Rainwater run-off means rainwater that flows over the ground following a storm event without escaping from a natural watercourse.",
        "Agreed Value means the fixed retail dollar amount we agree to insure your vehicle for as shown on your Certificate of Insurance.",
        "Market Value means the reasonable cost to replace your vehicle with one of the same make, model, age, kilometres, and condition immediately prior to the incident.",
        "Pre-existing Condition means any medical or dental condition of which you were aware or a reasonable person would have been aware prior to policy purchase.",
        "Total and Permanent Disablement (TPD) means you are absent from employment solely through injury or illness for an uninterrupted period of 3 consecutive months and are incapacitated to such an extent as to render you unlikely ever to engage in any gainful occupation.",
        "Waiting Period means the number of consecutive days you must wait after total disability begins before your monthly Income Protection benefit starts accruing.",
        "Indemnity Period means the period beginning with the occurrence of the insured damage during which the results of the business are affected in consequence of the damage.",
        "What is not covered",
        "We do not cover loss or damage caused by actions of the sea, high tide, or storm surge, or any flood occurring within the first 72 hours of policy inception.",
      ].join("\n");

      const sections = extractSectionsFromRawPdfText(sampleMultiLinePdfText, "Home Insurance PDS");
      const titles = sections.map((s) => s.title);

      expect(titles).toContain("Definitions — Excess");
      expect(titles).toContain("Definitions — Flood");
      expect(titles).toContain("Definitions — Storm");
      expect(titles).toContain("Definitions — Rainwater run-off");
      expect(titles).toContain("Definitions — Agreed Value");
      expect(titles).toContain("Definitions — Market Value");
      expect(titles).toContain("Definitions — Pre-existing Condition");
      expect(titles).toContain("Definitions — Total and Permanent Disablement (TPD)");
      expect(titles).toContain("Definitions — Waiting Period");
      expect(titles).toContain("Definitions — Indemnity Period");

      // Verify Flood was NOT swallowed into an "Excess means (Part N)" block
      expect(titles.some((t) => /Excess means/i.test(t))).toBe(false);

      const floodSec = sections.find((s) => s.title === "Definitions — Flood");
      expect(floodSec?.clauseType).toBe("Definition");
      expect(floodSec?.content).toContain("covering of normally dry land by water");
      expect(floodSec?.content).toContain(
        "- a lake (whether or not it has been altered or modified);"
      );
    });
  });
});
