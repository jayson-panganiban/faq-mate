import fs from "fs";
import path from "path";
import { compileCorpusToTypeScript, type SourceMarkdownFile } from "../src/ingest/corpus-compiler";
import { lintCorpusBatch } from "../src/ingest/corpus-linter";

const CORPUS_DIR = path.resolve(process.cwd(), "data/corpus");
const OUTPUT_TS_PATH = path.resolve(process.cwd(), "src/rag/corpus-data.ts");

function collectMarkdownFiles(dir: string): SourceMarkdownFile[] {
  if (!fs.existsSync(dir)) return [];

  const results: SourceMarkdownFile[] = [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push({
        file: path.relative(process.cwd(), fullPath),
        markdown: fs.readFileSync(fullPath, "utf-8"),
      });
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const lintOnly = args.includes("--lint-only");

  console.log("=== FAQ-Mate Stage 3: Corpus Linter & Edge AST Compiler (v2.0) ===");

  // Prioritize PDS files before FAQ files so high-signal PDS clauses sort first
  const pdsFiles = collectMarkdownFiles(path.join(CORPUS_DIR, "pds"));
  const faqFiles = collectMarkdownFiles(path.join(CORPUS_DIR, "faqs"));
  const allFiles = [...pdsFiles, ...faqFiles];

  if (allFiles.length === 0) {
    console.error(
      "No normalized Markdown files found in data/corpus/. Run `npm run normalize` first."
    );
    process.exit(1);
  }

  console.log(
    `Discovered ${allFiles.length} normalized Markdown documents (${pdsFiles.length} PDS/SPDS, ${faqFiles.length} FAQ).`
  );

  // 1. Run Corpus Linter
  const lintReport = lintCorpusBatch(allFiles);
  if (!lintReport.passed) {
    console.error(`\n✗ Corpus Linter detected ${lintReport.violations.length} violation(s):`);
    for (const v of lintReport.violations.slice(0, 25)) {
      console.error(`  - [${v.rule}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }
  console.log(
    `✓ Corpus Linter passed: ${lintReport.filesChecked} files verified with 0 violations.`
  );

  if (lintOnly) {
    return;
  }

  // 2. Compile AST Chunks to src/rag/corpus-data.ts
  const compiled = compileCorpusToTypeScript(allFiles, {
    maxChunksPerInsurer: 14,
    maxTotalChunks: 480,
  });

  fs.writeFileSync(OUTPUT_TS_PATH, compiled.typescriptSource, "utf-8");
  const sizeBytes = Buffer.byteLength(compiled.typescriptSource, "utf-8");
  const sizeKb = (sizeBytes / 1024).toFixed(1);
  const MAX_BUNDLE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB uncompressed isolate budget (Spec 06 § 5)

  if (sizeBytes > MAX_BUNDLE_BYTES) {
    console.error(
      `✗ Static corpus bundle budget exceeded: ${sizeKb} KB > 1536 KB ceiling (Spec 06 § 5).`
    );
    process.exit(1);
  }

  console.log(
    `✓ Compiled ${compiled.chunks.length} self-contained AST chunks across ${compiled.insurerCount} insurers -> src/rag/corpus-data.ts (${sizeKb} KB <= 1536 KB budget).`
  );
}

main().catch((err) => {
  console.error("Corpus compilation failed:", err);
  process.exit(1);
});
