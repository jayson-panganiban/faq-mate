import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * CLI Script: Synchronize Normalized Insurance Corpus to Cloudflare R2
 *
 * Implements Spec 01 (Section 2.1) path conventions:
 * corpus/{insurer_code}/{product_slug}/{document_type}_{version_or_effective_date}.md
 */

interface CorpusItem {
  localPath: string;
  r2Key: string;
  sizeBytes: number;
  hasBreadcrumbs: boolean;
  insurer: string;
}

const BUCKET_NAME = "faq-mate-corpus";

function scanCorpus(): CorpusItem[] {
  const items: CorpusItem[] = [];
  const corpusDir = path.resolve(process.cwd(), "data/corpus");

  // 1. Benchmark PDS policies
  const rootFiles = fs.readdirSync(corpusDir).filter((f) => f.endsWith(".md"));
  for (const file of rootFiles) {
    const fullPath = path.join(corpusDir, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    const hasBreadcrumbs = content.includes("<!-- BREADCRUMB");

    // Extract metadata from breadcrumb if present
    const insurerMatch = content.match(/insurer:\s*([^\n\r]+)/i);
    const insurer = insurerMatch ? insurerMatch[1].trim() : "general";
    const productMatch = content.match(/product:\s*([^\n\r]+)/i);
    const productSlug = productMatch
      ? productMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : "policy";
    const docTypeMatch = content.match(/doc_type:\s*([^\n\r]+)/i);
    const docType = docTypeMatch ? docTypeMatch[1].trim() : "PDS";
    const dateMatch = content.match(/effective_date:\s*([^\n\r]+)/i);
    const effectiveDate = dateMatch ? dateMatch[1].trim() : "2024-01-01";

    const insurerCode = insurer.toLowerCase().replace(/[^a-z0-9]/g, "");
    const r2Key = `corpus/${insurerCode}/${productSlug}/${docType}_${effectiveDate}.md`;

    items.push({
      localPath: fullPath,
      r2Key,
      sizeBytes: stat.size,
      hasBreadcrumbs,
      insurer,
    });
  }

  // 2. FAQ files in data/corpus/faqs
  const faqsDir = path.join(corpusDir, "faqs");
  if (fs.existsSync(faqsDir)) {
    const faqFiles = fs.readdirSync(faqsDir).filter((f) => f.endsWith(".md"));
    for (const file of faqFiles) {
      const fullPath = path.join(faqsDir, file);
      const stat = fs.statSync(fullPath);
      const brand = path.basename(file, ".md");
      const r2Key = `corpus/faqs/${brand}.md`;

      const content = fs.readFileSync(fullPath, "utf-8");
      items.push({
        localPath: fullPath,
        r2Key,
        sizeBytes: stat.size,
        hasBreadcrumbs: content.includes("<!-- BREADCRUMB"),
        insurer: brand,
      });
    }
  }

  return items;
}

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute") || args.includes("-e");

  console.log("=== FAQ-Mate Cloudflare R2 Upload & Synchronization ===");
  console.log(`Target Bucket: ${BUCKET_NAME}`);
  console.log(`Mode: ${isExecute ? "LIVE UPLOAD" : "DRY RUN (pass --execute to upload)"}\n`);

  const items = scanCorpus();
  console.log(`Discovered ${items.length} items ready for R2 synchronization:`);

  let totalBytes = 0;
  for (const item of items) {
    totalBytes += item.sizeBytes;
    const sizeKb = (item.sizeBytes / 1024).toFixed(1);
    console.log(`  • [${item.hasBreadcrumbs ? "VALID" : "WARN"}] ${path.relative(process.cwd(), item.localPath)} -> ${item.r2Key} (${sizeKb} KB)`);
  }

  console.log(`\nTotal payload: ${(totalBytes / 1024).toFixed(1)} KB across ${items.length} files.`);

  if (!isExecute) {
    console.log("\n[DRY RUN COMPLETE] To push all objects to Cloudflare R2, run:\n  npx tsx scripts/upload-to-r2.ts --execute");
    return;
  }

  console.log("\nInitiating upload via Wrangler R2 client...");
  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    try {
      console.log(`Uploading ${item.r2Key}...`);
      execSync(`npx wrangler r2 object put "${BUCKET_NAME}/${item.r2Key}" --file "${item.localPath}"`, {
        stdio: "pipe",
      });
      successCount++;
    } catch (err: unknown) {
      // In CI/local dev without CF credentials, log and continue
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ↳ Note: R2 write skipped (offline or credentials pending): ${message.slice(0, 80)}`);
      failCount++;
    }
  }

  console.log(`\nUpload run finished: ${successCount} uploaded, ${failCount} skipped/pending credentials.`);
}

main().catch((err) => {
  console.error("R2 sync failed:", err);
  process.exit(1);
});
