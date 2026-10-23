import fs from "fs";
import path from "path";
import { z } from "zod";
import { STATUTORY_GAW } from "../src/constants/statutory";

const FaqItemSchema = z.object({
  id: z.string(),
  brand: z.string(),
  category: z.string().optional().default("general"),
  question: z.string().trim(),
  answer: z.string().trim(),
  url: z.string().optional(),
  topics: z.array(z.string()).optional(),
});

type FaqItem = z.infer<typeof FaqItemSchema>;

const RAW_DIR = path.resolve(process.cwd(), "data/raw");
const OUTPUT_DIR = path.resolve(process.cwd(), "data/corpus/faqs");

async function main() {
  console.log("=== FAQ-Mate Ingestion & Normalization Pipeline ===");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allFaqs: FaqItem[] = [];

  // 1. Ingest Tier 1 Home Insurance FAQs
  const tier1HomePath = path.join(RAW_DIR, "tier1-home-faqs.json");
  if (fs.existsSync(tier1HomePath)) {
    const rawTier1 = JSON.parse(fs.readFileSync(tier1HomePath, "utf-8"));
    const parsedTier1 = z.array(FaqItemSchema).parse(rawTier1);
    console.log(`Loaded ${parsedTier1.length} Tier 1 Home & Contents FAQs.`);
    allFaqs.push(...parsedTier1);
  }

  // 2. Ingest Existing Motor & General FAQs
  const rawFaqsPath = path.join(RAW_DIR, "faqs.json");
  if (fs.existsSync(rawFaqsPath)) {
    const rawData = JSON.parse(fs.readFileSync(rawFaqsPath, "utf-8"));
    const parsedData = z.array(FaqItemSchema).parse(rawData);
    console.log(`Loaded ${parsedData.length} General/Motor Insurance FAQs.`);
    allFaqs.push(...parsedData);
  }

  console.log(`Total FAQs to normalize: ${allFaqs.length}`);

  // Group by brand
  const byBrand = new Map<string, FaqItem[]>();
  for (const item of allFaqs) {
    const brandKey = item.brand.toLowerCase().trim().replace(/[^a-z0-9]/g, "-");
    if (!byBrand.has(brandKey)) {
      byBrand.set(brandKey, []);
    }
    byBrand.get(brandKey)!.push(item);
  }

  console.log(`Unique Insurer Brands: ${byBrand.size}`);

  // Write Hierarchical Markdown files
  let totalFilesWritten = 0;
  for (const [brand, items] of byBrand.entries()) {
    const brandNameUpper = brand.toUpperCase().replace(/-/g, " ");
    let markdown = `<!-- BREADCRUMB
insurer: ${brandNameUpper}
doc_type: Public Policy & Claims FAQ
last_verified: 2026-10-23
jurisdiction: Australia (Cth)
item_count: ${items.length}
-->

# ${brandNameUpper} Insurance: Official Policy & Claims FAQs

*Statutory Notice: The following FAQs reflect published disclosures by ${brandNameUpper}. Policy terms are subject to the applicable Product Disclosure Statement (PDS) and Target Market Determination (TMD).*

---

`;

    for (const [idx, faq] of items.entries()) {
      const topicTag = faq.topics ? ` [Topics: ${faq.topics.join(", ")}]` : "";
      markdown += `## Question ${idx + 1}: ${faq.question}\n`;
      markdown += `**Insurer:** ${brandNameUpper} | **ID:** \`${faq.id}\`${topicTag}\n\n`;
      markdown += `### Official Guidance\n${faq.answer}\n\n`;
      if (faq.url) {
        markdown += `*Canonical Source:* [${faq.url}](${faq.url})\n\n`;
      }
      markdown += `---\n\n`;
    }

    // Append statutory General Advice Warning
    markdown += `\n### Regulatory Warning (Corporations Act 2001 Section 949A)\n`;
    markdown += `${STATUTORY_GAW}\n`;

    const filePath = path.join(OUTPUT_DIR, `${brand}.md`);
    fs.writeFileSync(filePath, markdown, "utf-8");
    totalFilesWritten++;
  }

  console.log(`Successfully generated ${totalFilesWritten} hierarchical Markdown files in data/corpus/faqs/`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
