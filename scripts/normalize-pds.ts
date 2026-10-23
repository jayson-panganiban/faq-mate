import fs from "fs";
import path from "path";
import { extractText } from "unpdf";
import {
  normalizePdsDocument,
  buildR2PathKey,
  type PdsMetadata,
  type PolicySection,
} from "../src/ingest/pds-normalizer";
import { normalizeRawTextTable } from "../src/ingest/table-serializer";

/**
 * CLI Script: Normalize Insurer PDS to Cloudflare AI Search R2 Standard
 * Implements Spec 01 & ADR-0002.
 */
async function main() {
  const args = process.argv.slice(2);
  console.log("=== FAQ-Mate PDS Normalization Utility ===");

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage:
  tsx scripts/normalize-pds.ts [options]

Options:
  --input <path>         Path to raw source PDF or TXT/MD file
  --insurer <name>       Insurer name (e.g. Suncorp, Allianz, NRMA)
  --code <code_slug>     Insurer slug (e.g. suncorp, allianz, nrma)
  --product <name>       Product name (e.g. Classic Home Building & Contents)
  --product-slug <slug>  Product slug (e.g. home-contents-classic)
  --doc-type <type>      PDS | TMD | SPDS | FSG (default: PDS)
  --version <ver>        Version or Effective Date (e.g. 2024-01-15 or V24A)
  --output <dir>         Output directory (default: data/corpus)
  --batch-validate       Validate and format all corpus documents
`);
    return;
  }

  const inputIdx = args.indexOf("--input");
  const isBatch = args.includes("--batch-validate") || inputIdx === -1;

  if (isBatch) {
    console.log("Running batch corpus validation and directory alignment...");
    const corpusDir = path.resolve(process.cwd(), "data/corpus");
    const files = fs
      .readdirSync(corpusDir)
      .filter((f) => f.endsWith(".md") && !fs.statSync(path.join(corpusDir, f)).isDirectory());

    console.log(`Found ${files.length} benchmark policy documents in data/corpus/:`);
    for (const f of files) {
      const fullPath = path.join(corpusDir, f);
      const content = fs.readFileSync(fullPath, "utf-8");
      const hasBreadcrumb = content.includes("<!-- BREADCRUMB");
      const hasGaw = content.includes("General Advice Warning");
      const hasTable = content.includes("|");
      console.log(`- ${f}: [Breadcrumbs: ${hasBreadcrumb ? "✓" : "✗"}] [GAW: ${hasGaw ? "✓" : "✗"}] [Tables: ${hasTable ? "✓" : "✗"}]`);
    }
    return;
  }

  const inputPath = args[inputIdx + 1];
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  const getArg = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const insurer = getArg("--insurer", "Allianz");
  const insurerCode = getArg("--code", insurer.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const product = getArg("--product", "Comprehensive Motor Insurance");
  const productSlug = getArg("--product-slug", product.toLowerCase().replace(/[^a-z0-9]/g, "-"));
  const docType = getArg("--doc-type", "PDS") as "PDS" | "TMD" | "SPDS";
  const version = getArg("--version", new Date().toISOString().slice(0, 10));
  const outputDir = path.resolve(process.cwd(), getArg("--output", "data/corpus"));

  let extractedRawText = "";
  if (inputPath.endsWith(".pdf")) {
    console.log(`Extracting text from PDF: ${inputPath} ...`);
    const buffer = fs.readFileSync(inputPath);
    const result = await extractText(new Uint8Array(buffer));
    extractedRawText = Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text);
    console.log(`Extracted ${extractedRawText.length} characters of PDF text.`);
  } else {
    extractedRawText = fs.readFileSync(inputPath, "utf-8");
  }

  const metadata: PdsMetadata = {
    insurer,
    insurerCode,
    product,
    productSlug,
    docType,
    effectiveDate: version,
    version,
    jurisdiction: "Australia (Cth)",
  };

  // Convert raw sections
  const rawBlocks = extractedRawText.split(/\n(?=#{1,3}\s)/);
  const sections: PolicySection[] = rawBlocks.map((block) => {
    const lines = block.trim().split("\n");
    const heading = lines[0].replace(/^#{1,3}\s*/, "").trim() || "Policy Terms";
    const body = lines.slice(1).join("\n").trim();
    return {
      title: heading,
      level: 2,
      content: normalizeRawTextTable(body),
    };
  });

  const normalized = normalizePdsDocument(metadata, sections);
  const targetR2Key = buildR2PathKey(metadata);
  const targetPath = path.join(outputDir, path.basename(targetR2Key));

  if (!fs.existsSync(path.dirname(targetPath))) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  fs.writeFileSync(targetPath, normalized.markdown, "utf-8");
  console.log(`Successfully normalized document to: ${targetPath}`);
  console.log(`Canonical R2 Key: ${targetR2Key}`);
}

main().catch((err) => {
  console.error("PDS normalization failed:", err);
  process.exit(1);
});
