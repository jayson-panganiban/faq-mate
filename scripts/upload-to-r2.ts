import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { buildR2PathKey, parseBreadcrumb } from "../src/ingest/corpus-codec";

/**
 * CLI Script: Synchronize Normalized Insurance Corpus to Cloudflare R2
 *
 * Implements Spec 01 (v2.0) path conventions:
 * - PDS/SPDS: corpus/pds/{insurer_code}/{product_slug}/{doc_type}_{effective_date}.md
 * - FAQs:     corpus/faqs/{insurer_code}.md
 */

interface CorpusItem {
  localPath: string;
  r2Key: string;
  sizeBytes: number;
  hasBreadcrumbs: boolean;
  insurer: string;
}

const BUCKET_NAME = "faq-mate-corpus";

function walkMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function scanCorpus(): CorpusItem[] {
  const items: CorpusItem[] = [];
  const corpusDir = path.resolve(process.cwd(), "data/corpus");
  const files = walkMarkdownFiles(corpusDir).sort();

  for (const fullPath of files) {
    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const hasBreadcrumbs = content.includes("<!-- BREADCRUMB");
    const meta = parseBreadcrumb(content);
    const r2Key = buildR2PathKey({
      insurer: meta.insurer,
      insurerCode: meta.insurerCode,
      product: meta.product,
      productSlug: meta.productSlug,
      docType: fullPath.includes(`${path.sep}faqs${path.sep}`) ? "FAQ" : meta.docType,
      effectiveDate: meta.effectiveDate,
    });

    items.push({
      localPath: fullPath,
      r2Key,
      sizeBytes: stat.size,
      hasBreadcrumbs,
      insurer: meta.insurer,
    });
  }

  return items;
}

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute") || args.includes("-e");

  console.log("=== FAQ-Mate Stage 4: Cloudflare R2 Upload & Synchronization (v2.0) ===");
  console.log(`Target Bucket: ${BUCKET_NAME}`);
  console.log(`Mode: ${isExecute ? "LIVE UPLOAD" : "DRY RUN (pass --execute to upload)"}\n`);

  const items = scanCorpus();
  console.log(`Discovered ${items.length} items ready for R2 synchronization.`);

  let totalBytes = 0;
  let validCount = 0;
  for (const item of items) {
    totalBytes += item.sizeBytes;
    if (item.hasBreadcrumbs) validCount++;
  }

  // Print sample summary
  for (const item of items.slice(0, 15)) {
    const sizeKb = (item.sizeBytes / 1024).toFixed(1);
    console.log(
      `  • [${item.hasBreadcrumbs ? "VALID" : "WARN"}] ${path.relative(process.cwd(), item.localPath)} -> ${item.r2Key} (${sizeKb} KB)`
    );
  }
  if (items.length > 15) {
    console.log(`  ... and ${items.length - 15} more corpus documents.`);
  }

  console.log(
    `\nTotal payload: ${(totalBytes / 1024).toFixed(1)} KB across ${items.length} files (${validCount}/${items.length} with valid breadcrumbs).`
  );

  if (!isExecute) {
    console.log(
      "\n[DRY RUN COMPLETE] To push all objects to Cloudflare R2, run:\n  npx tsx scripts/upload-to-r2.ts --execute"
    );
    return;
  }

  console.log("\nInitiating upload via Wrangler R2 client...");
  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    try {
      execSync(
        `npx wrangler r2 object put "${BUCKET_NAME}/${item.r2Key}" --file "${item.localPath}"`,
        { stdio: "pipe" }
      );
      successCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `  ↳ Note: R2 write skipped (offline or credentials pending): ${message.slice(0, 80)}`
      );
      failCount++;
    }
  }

  console.log(
    `\nUpload run finished: ${successCount} uploaded, ${failCount} skipped/pending credentials.`
  );
}

main().catch((err) => {
  console.error("R2 sync failed:", err);
  process.exit(1);
});
