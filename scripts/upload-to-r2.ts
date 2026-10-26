import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { buildR2PathKey, parseBreadcrumb } from "../src/ingest/corpus-codec";

const execFileAsync = promisify(execFile);

/**
 * CLI Script: Synchronize Normalized Insurance Corpus to Cloudflare R2
 *
 * Implements Spec 01 (v2.0) path conventions:
 * - PDS/SPDS: corpus/pds/{insurer_code}/{product_slug}/{doc_type}_{effective_date}.md
 * - FAQs:     corpus/faqs/{insurer_code}.md
 * - Guides:   corpus/guides/{insurer_code}/{page_slug}/GUIDE_{effective_date}.md
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

  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  const concurrency = concurrencyArg ? Number.parseInt(concurrencyArg.split("=")[1], 10) : 16;

  if (!isExecute) {
    console.log(
      `\n[DRY RUN COMPLETE] To push all objects to Cloudflare R2 in parallel (concurrency: ${concurrency}), run:\n  npx tsx scripts/upload-to-r2.ts --execute`
    );
    return;
  }

  const wranglerBin = path.resolve(process.cwd(), "node_modules/.bin/wrangler");
  console.log(
    `\nInitiating parallel upload (concurrency: ${concurrency}) via Wrangler R2 client...`
  );
  const startTime = Date.now();

  let completedCount = 0;
  let successCount = 0;
  let failCount = 0;
  let activeIndex = 0;

  async function worker(_workerId: number): Promise<void> {
    while (activeIndex < items.length) {
      const currentIdx = activeIndex++;
      const item = items[currentIdx];

      let attempt = 0;
      let uploaded = false;
      while (attempt < 3 && !uploaded) {
        attempt++;
        try {
          await execFileAsync(
            wranglerBin,
            [
              "r2",
              "object",
              "put",
              `${BUCKET_NAME}/${item.r2Key}`,
              "--file",
              item.localPath,
              "--remote",
            ],
            { maxBuffer: 10 * 1024 * 1024 }
          );
          successCount++;
          uploaded = true;
        } catch (err: unknown) {
          if (attempt >= 3) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`  ↳ [WARN] Failed ${item.r2Key}: ${message.slice(0, 120)}`);
            failCount++;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          }
        }
      }

      completedCount++;
      if (completedCount % 50 === 0 || completedCount === items.length) {
        const pct = ((completedCount / items.length) * 100).toFixed(1);
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `  • Progress: ${completedCount}/${items.length} (${pct}%) — ${successCount} uploaded, ${failCount} failed in ${elapsedSec}s`
        );
      }
    }
  }

  const pool = Array.from({ length: concurrency }, (_, id) => worker(id));
  await Promise.all(pool);

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n=== R2 Upload Complete ===\n` +
      `  • Successfully Uploaded: ${successCount}\n` +
      `  • Failed / Skipped:      ${failCount}\n` +
      `  • Total Time:            ${totalSec} seconds\n`
  );
}

main().catch((err) => {
  console.error("R2 sync failed:", err);
  process.exit(1);
});
