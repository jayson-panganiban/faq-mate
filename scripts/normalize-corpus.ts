import fs from "fs";
import path from "path";
import { extractText } from "unpdf";
import { resolveInsurer } from "../src/constants/insurers";
import { buildBenchmarkPolicyDocuments } from "../src/ingest/benchmark-policies";
import { normalizeFaqDocument, parseRawFaqMarkdown } from "../src/ingest/faq-normalizer";
import { normalizeGuideDocument, type ParsedGuideDocument } from "../src/ingest/guide-normalizer";
import {
  type ManifestEntry,
  parseManifestCsv,
  selectManifestEntries,
} from "../src/ingest/manifest-selector";
import {
  extractSectionsFromRawPdfText,
  normalizePdsDocument,
  type PdsMetadata,
} from "../src/ingest/pds-normalizer";

const RAW_DIR = path.resolve(process.cwd(), "data/raw");
const CORPUS_DIR = path.resolve(process.cwd(), "data/corpus");
const PDS_OUT_DIR = path.join(CORPUS_DIR, "pds");
const FAQ_OUT_DIR = path.join(CORPUS_DIR, "faqs");
const GUIDES_OUT_DIR = path.join(CORPUS_DIR, "guides");
const RAW_GUIDES_DIR = path.join(RAW_DIR, "guides");

function walkFiles(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

/**
 * Extracts text from a PDF file using `unpdf` with a safe page/character cap,
 * falling back to a metadata summary section if the PDF is image-scanned or encrypted.
 */
async function extractSectionsFromPdfEntry(entry: ManifestEntry, pdfFullPath: string) {
  try {
    if (fs.existsSync(pdfFullPath) && entry.bytes < 6_000_000) {
      const buffer = fs.readFileSync(pdfFullPath);
      const result = await extractText(new Uint8Array(buffer));
      const text = Array.isArray(result.text)
        ? result.text.slice(0, 25).join("\n\n")
        : String(result.text);

      const sections = extractSectionsFromRawPdfText(text, `${entry.product} ${entry.type}`);
      if (sections.length > 0) {
        return sections;
      }
    }
  } catch {
    // Fall through to structured manifest summary section if encrypted/scanned PDF
  }

  return [
    {
      title: `${entry.product} — ${entry.title}`,
      level: 3 as const,
      clauseType: "Coverage" as const,
      content: [
        `Official ${entry.insurer} ${entry.type} disclosure for **${entry.product}** (${entry.title}).`,
        `Effective / Archive Edition: \`${entry.inferredDate}\`.`,
        `Canonical Policy Document Source: [${entry.url}](${entry.url})`,
        "",
        `Coverage under ${entry.insurer} ${entry.product} is governed by the defined insured events, policy schedule sub-limits, applicable excesses, and general exclusions set out in this ${entry.type}.`,
      ].join("\n"),
    },
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const includeHistorical = args.includes("--all-historical");
  const extractAllPdfs = args.includes("--extract-pdfs");
  const insurerIdx = args.indexOf("--insurer");
  const insurerFilter = insurerIdx !== -1 ? args[insurerIdx + 1] : undefined;

  console.log("=== FAQ-Mate Stage 2: Corpus Semantic Normalization Pipeline (v2.0) ===");
  console.log(
    `Mode: ${includeHistorical ? "ALL HISTORICAL (1,277 PDFs)" : "CURRENT EDITIONS PER (INSURER, PRODUCT)"}`
  );

  fs.mkdirSync(PDS_OUT_DIR, { recursive: true });
  fs.mkdirSync(FAQ_OUT_DIR, { recursive: true });

  // 1. Normalize all 39 Insurer FAQ Markdown files from data/raw/FAQs/
  const rawFaqsDir = path.join(RAW_DIR, "FAQs");
  let faqFilesWritten = 0;
  let totalQuestionsNormalized = 0;

  if (fs.existsSync(rawFaqsDir)) {
    const faqFiles = fs
      .readdirSync(rawFaqsDir)
      .filter((f) => f.endsWith("FAQ.md"))
      .sort();

    for (const file of faqFiles) {
      const fallbackInsurer = file.replace(/\s*FAQ\.md$/i, "").trim();
      if (insurerFilter && !fallbackInsurer.toLowerCase().includes(insurerFilter.toLowerCase())) {
        continue;
      }

      const rawMd = fs.readFileSync(path.join(rawFaqsDir, file), "utf-8");
      const parsed = parseRawFaqMarkdown(rawMd, fallbackInsurer);
      const normalized = normalizeFaqDocument(parsed);

      const outPath = path.join(FAQ_OUT_DIR, `${parsed.insurerSlug}.md`);
      fs.writeFileSync(outPath, normalized.markdown, "utf-8");
      faqFilesWritten++;
      totalQuestionsNormalized += normalized.questionCount;
    }
    console.log(
      `✓ Normalized ${faqFilesWritten} insurer FAQ files (${totalQuestionsNormalized} total Q&As) -> data/corpus/faqs/`
    );
  }

  // 2. Emit Curated Tier-1 Benchmark PDS Documents (Suncorp, Allianz, NRMA, QBE, Youi)
  const benchmarks = buildBenchmarkPolicyDocuments();
  for (const b of benchmarks) {
    const targetPath = path.join(CORPUS_DIR, b.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, b.doc.markdown, "utf-8");
  }
  console.log(
    `✓ Wrote ${benchmarks.length} regulatory benchmark PDS disclosures -> data/corpus/pds/`
  );

  // 3. Process data/raw/all_manifest.csv for all 39 insurers
  const manifestPath = path.join(RAW_DIR, "all_manifest.csv");
  let pdsFilesWritten = benchmarks.length;

  if (fs.existsSync(manifestPath)) {
    const csvContent = fs.readFileSync(manifestPath, "utf-8");
    const allEntries = parseManifestCsv(csvContent);
    const selectedEntries = selectManifestEntries(allEntries, {
      includeHistorical,
      insurerFilter,
    });

    console.log(
      `✓ Selected ${selectedEntries.length} of ${allEntries.length} manifest PDS/SPDS documents across 39 insurers.`
    );

    // Group selected entries by (insurerSlug, productSlug) to create one rich Markdown file per product
    const byInsurerProduct = new Map<string, ManifestEntry[]>();
    for (const entry of selectedEntries) {
      const key = `${entry.insurerSlug}::${entry.productSlug}`;
      const list = byInsurerProduct.get(key) ?? [];
      list.push(entry);
      byInsurerProduct.set(key, list);
    }

    for (const [, group] of byInsurerProduct.entries()) {
      const primary = group[0];
      const resolved = resolveInsurer(primary.insurer);
      const meta: PdsMetadata = {
        insurer: primary.insurer,
        insurerCode: resolved ? resolved.profile.code : primary.insurerSlug.toUpperCase(),
        category: primary.category,
        product: primary.product,
        productSlug: primary.productSlug,
        docType: primary.type,
        effectiveDate: primary.inferredDate,
        version: primary.inferredDate,
        underwriter: resolved?.profile.underwriter,
        sourceUrl: primary.url,
        jurisdiction: "Australia (Cth)",
      };

      const sections = [];
      for (const entry of group) {
        const pdfPath = path.join(RAW_DIR, entry.file);
        if (extractAllPdfs && fs.existsSync(pdfPath)) {
          const pdfSections = await extractSectionsFromPdfEntry(entry, pdfPath);
          sections.push(...pdfSections);
        } else {
          sections.push({
            title: `${entry.product} (${entry.type}) — ${entry.title}`,
            level: 3 as const,
            clauseType: "Coverage" as const,
            content: [
              `Official **${entry.insurer}** ${entry.type} product disclosure for **${entry.product}** (*${entry.title}*).`,
              `- **Document Classification:** ${entry.type}`,
              `- **Effective / Archive Date:** \`${entry.inferredDate}\``,
              `- **Issuing Underwriter:** ${resolved?.profile.underwriter ?? entry.insurer}`,
              `- **Official Source URL:** [${entry.url}](${entry.url})`,
              "",
              `This policy is governed by the terms, conditions, defined events, sub-limit schedules, and general exclusions published in the ${entry.insurer} ${entry.product} ${entry.type}.`,
            ].join("\n"),
          });
        }
      }

      const normalized = normalizePdsDocument(meta, sections);
      const outPath = path.join(
        PDS_OUT_DIR,
        primary.insurerSlug,
        primary.productSlug,
        `${primary.type}_${primary.inferredDate}.md`
      );
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, normalized.markdown, "utf-8");
      pdsFilesWritten++;
    }
  }

  // 4. Normalize curated official insurer guide pages from data/raw/guides/
  const rawGuideFiles = walkFiles(RAW_GUIDES_DIR, ".json");
  let guideFilesWritten = 0;
  let totalGuideChars = 0;
  let guideFilesSkipped = 0;

  if (rawGuideFiles.length > 0) {
    fs.rmSync(GUIDES_OUT_DIR, { recursive: true, force: true });

    for (const file of rawGuideFiles) {
      let parsed: ParsedGuideDocument;
      try {
        parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as ParsedGuideDocument;
      } catch {
        console.warn(`⚠ Skipping unreadable guide JSON: ${path.relative(RAW_DIR, file)}`);
        guideFilesSkipped++;
        continue;
      }

      if (!parsed.markdown || parsed.markdown.trim().length === 0) {
        console.warn(`⚠ Skipping empty guide: ${parsed.canonical_url || file}`);
        guideFilesSkipped++;
        continue;
      }

      if (insurerFilter && !parsed.insurer.toLowerCase().includes(insurerFilter.toLowerCase())) {
        continue;
      }

      const normalized = normalizeGuideDocument(parsed);
      const outPath = path.join(CORPUS_DIR, normalized.r2Key.replace(/^corpus\//, ""));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, normalized.markdown, "utf-8");
      guideFilesWritten++;
      totalGuideChars += normalized.markdown.length;
    }

    console.log(
      `✓ Normalized ${guideFilesWritten} GUIDE pages (${totalGuideChars.toLocaleString()} chars, ${guideFilesSkipped} skipped) -> data/corpus/guides/`
    );
  }

  console.log(
    `=== Normalization Complete: ${pdsFilesWritten} PDS/SPDS files + ${faqFilesWritten} FAQ files + ${guideFilesWritten} GUIDE files in data/corpus/ ===`
  );
}

main().catch((err) => {
  console.error("Normalization failed:", err);
  process.exit(1);
});
