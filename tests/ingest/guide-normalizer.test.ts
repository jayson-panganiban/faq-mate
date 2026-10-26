import { describe, expect, it } from "vitest";
import { parseBreadcrumb } from "../../src/ingest/corpus-codec";
import {
  compileCorpusToTypeScript,
  compileMarkdownToChunks,
} from "../../src/ingest/corpus-compiler";
import { lintMarkdownDocument } from "../../src/ingest/corpus-linter";
import {
  buildR2PathKey,
  normalizeGuideDocument,
  type ParsedGuideDocument,
} from "../../src/ingest/guide-normalizer";

function sampleGuide(overrides: Partial<ParsedGuideDocument> = {}): ParsedGuideDocument {
  return {
    insurer: "NRMA",
    product: "Home Insurance",
    category: "major-insurers",
    url: "https://www.nrma.com.au/home-insurance/storm-and-flood-insurance",
    canonical_url: "https://www.nrma.com.au/home-insurance/storm-and-flood-insurance",
    title: "Storm and Flood Insurance Cover",
    retrieved_at: "2026-10-25",
    content_hash: "abc123",
    text_length: 420,
    markdown: [
      "# Storm and flood insurance",
      "",
      "Protect your property with cover for storms and floods.",
      "",
      "## Understanding storm and flood cover",
      "",
      "Our home insurance policies include cover for floods and storms.",
      "",
      "### Flood",
      "",
      "A flood occurs when water escapes from its usual boundaries.",
      "",
      "<p>Rainwater run-off is water that moves across the ground.</p>",
      "",
      "*Source: <https://www.nrma.com.au/home-insurance/storm-and-flood-insurance>*",
    ].join("\n"),
    ...overrides,
  };
}

describe("GUIDE corpus normalization (Spec 01 / Spec 06)", () => {
  it("routes guides to corpus/guides/{insurer}/{page_slug}/GUIDE_{date}.md", () => {
    const key = buildR2PathKey({
      insurer: "NRMA",
      insurerCode: "nrma",
      product: "Home Insurance",
      productSlug: "home-insurance-storm-and-flood-insurance",
      docType: "GUIDE",
      effectiveDate: "2026-10-25",
      version: "2026-10-25",
    });

    expect(key).toBe(
      "corpus/guides/nrma/home-insurance-storm-and-flood-insurance/GUIDE_2026-10-25.md"
    );
  });

  it("emits a GUIDE breadcrumb, provenance fields and statutory GAW", () => {
    const normalized = normalizeGuideDocument(sampleGuide());
    const breadcrumb = parseBreadcrumb(normalized.markdown);

    expect(breadcrumb.hasBreadcrumbBlock).toBe(true);
    expect(breadcrumb.docType).toBe("GUIDE");
    expect(breadcrumb.insurer).toBe("NRMA");
    expect(breadcrumb.insurerCode).toBe("NRMA");
    expect(breadcrumb.productSlug).toBe("home-insurance-storm-and-flood-insurance");
    expect(breadcrumb.rawFields["product_slug"]).toBe("home-insurance-storm-and-flood-insurance");
    expect(breadcrumb.rawFields["page_title"]).toBe("Storm and Flood Insurance Cover");
    expect(breadcrumb.rawFields["source_url"]).toBe(
      "https://www.nrma.com.au/home-insurance/storm-and-flood-insurance"
    );

    expect(normalized.markdown).toContain("Document type: GUIDE");
    expect(normalized.markdown).toContain("General Advice Warning");
    expect(normalized.markdown).toContain("Australian Financial Complaints Authority (AFCA)");
    expect(normalized.r2Key).toBe(
      "corpus/guides/nrma/home-insurance-storm-and-flood-insurance/GUIDE_2026-10-25.md"
    );
  });

  it("strips residual HTML and does not duplicate the source H1", () => {
    const normalized = normalizeGuideDocument(sampleGuide());

    expect(normalized.markdown).not.toContain("<p>");
    expect(normalized.markdown).not.toContain("</p>");
    expect(normalized.markdown).not.toMatch(/^# Storm and flood insurance$/m);
    expect(normalized.markdown).toContain(
      "Rainwater run-off is water that moves across the ground."
    );
    expect(normalized.markdown).toContain("## Understanding storm and flood cover");

    const h1Lines = normalized.markdown.split(/\r?\n/).filter((line) => /^#\s+/.test(line));
    expect(h1Lines).toHaveLength(1);
    expect(h1Lines[0]).toBe("# NRMA — Storm and Flood Insurance Cover");
  });

  it("drops empty teaser and navigational sections", () => {
    const normalized = normalizeGuideDocument(
      sampleGuide({
        markdown: [
          "# Page title",
          "",
          "## Coverage",
          "",
          "Real coverage content.",
          "",
          "## Renters Insurance Insights",
          "",
          "### [Read this article](https://example.com/a)",
          "",
          "### [Read another article](https://example.com/b)",
          "",
          "## Learn more with Example Insurance",
          "",
          "### [Unrelated article](https://example.com/c)",
          "",
          "Article teaser copy that should not be in the corpus.",
          "",
          "## Next steps",
          "",
          "More useful content.",
        ].join("\n"),
      })
    );

    expect(normalized.markdown).not.toContain("## Renters Insurance Insights");
    expect(normalized.markdown).not.toContain("## Learn more with Example Insurance");
    expect(normalized.markdown).not.toContain("Read this article");
    expect(normalized.markdown).not.toContain("Article teaser copy");
    expect(normalized.markdown).toContain("## Coverage");
    expect(normalized.markdown).toContain("## Next steps");
  });

  it("drops card icon labels that sit directly before a heading", () => {
    const normalized = normalizeGuideDocument(
      sampleGuide({
        markdown: [
          "# Business insurance",
          "",
          "business",
          "",
          "### Small Business Insurance",
          "",
          "Cover for small businesses.",
          "",
          "motor",
          "",
          "### Commercial Motor Insurance",
          "",
          "Cover for commercial vehicles.",
          "",
          "This paragraph is legitimate body copy.",
        ].join("\n"),
      })
    );

    expect(normalized.markdown).not.toMatch(/^business$/m);
    expect(normalized.markdown).not.toMatch(/^motor$/m);
    expect(normalized.markdown).toContain("### Small Business Insurance");
    expect(normalized.markdown).toContain("### Commercial Motor Insurance");
    expect(normalized.markdown).toContain("This paragraph is legitimate body copy.");
  });

  it("collapses responsive copies of a section but keeps distinct sections that reuse a heading", () => {
    const normalized = normalizeGuideDocument(
      sampleGuide({
        markdown: [
          "# Portable valuables",
          "",
          "## Some of the portable items we can cover",
          "",
          "### Coverage outside the home",
          "",
          "Phones and tablets are covered anywhere in Australia when you add unspecified portable valuables.",
          "",
          "### Coverage at home",
          "",
          "Phones and tablets are covered at home under contents cover.",
          "",
          "### Coverage outside the home",
          "",
          "Jewellery is covered anywhere in Australia when you specify each item on your policy.",
          "",
          "## Optional extras",
          "",
          "Optional extras give you more protection for the parts of your trip that matter most.",
          "",
          "### Cover for adventure activities",
          "",
          "Adventure activities can be added to your policy.",
          "",
          "## Optional extras",
          "",
          "### Cover for adventure activities",
          "",
          "Adventure activities can be added to your policy.",
        ].join("\n"),
      })
    );

    const outside = normalized.markdown.match(/### Coverage outside the home/g) ?? [];
    expect(outside).toHaveLength(2);
    expect(normalized.markdown).toContain("Phones and tablets are covered anywhere");
    expect(normalized.markdown).toContain("Jewellery is covered anywhere");

    const extras = normalized.markdown.match(/^## Optional extras$/gm) ?? [];
    expect(extras).toHaveLength(1);
    expect(normalized.markdown).toContain("more protection for the parts of your trip");
  });

  it("passes the corpus linter and compiles into non-empty AST chunks", () => {
    const normalized = normalizeGuideDocument(sampleGuide());

    const violations = lintMarkdownDocument("guides/nrma/storm.md", normalized.markdown);
    expect(violations).toHaveLength(0);

    const chunks = compileMarkdownToChunks({
      file: "guides/nrma/storm.md",
      markdown: normalized.markdown,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].source.docType).toBe("GUIDE");
    for (const chunk of chunks) {
      expect(
        chunk.content
          .trim()
          .split("\n")
          .filter((l) => l.trim()).length
      ).toBeGreaterThan(1);
    }

    const bundle = compileCorpusToTypeScript([
      { file: "guides/nrma/storm.md", markdown: normalized.markdown },
    ]);
    expect(bundle.typescriptSource).toContain("export const STATIC_CORPUS_CHUNKS");
  });

  it("resolves insurer aliases and preserves the canonical page slug", () => {
    const normalized = normalizeGuideDocument(
      sampleGuide({
        insurer: "NRMA Insurance",
        product: "Home Building Insurance",
        url: "https://www.nrma.com.au/home-insurance/buildings-insurance",
        canonical_url: "https://www.nrma.com.au/home-insurance/buildings-insurance/",
      })
    );

    expect(normalized.metadata.insurerCode).toBe("NRMA");
    expect(normalized.metadata.category).toBe("major-insurers");
    expect(normalized.metadata.productSlug).toBe("home-insurance-buildings-insurance");
    expect(normalized.r2Key).toContain(
      "corpus/guides/nrma/home-insurance-buildings-insurance/GUIDE_2026-10-25.md"
    );
  });

  it("normalizes non-home guides across travel and life categories with valid R2 paths and metadata", () => {
    // Travel Specialist: Cover-More
    const travelGuide = normalizeGuideDocument({
      insurer: "Cover-More",
      product: "Travel Insurance",
      category: "travel-specialists",
      url: "https://www.covermore.com.au/travel-insurance/medical-cover",
      canonical_url: "https://www.covermore.com.au/travel-insurance/medical-cover",
      title: "Overseas Medical Expenses & Assistance",
      retrieved_at: "2026-10-25",
      markdown: [
        "# Overseas Medical Cover",
        "## What is covered",
        "Emergency hospital and medical expenses incurred overseas during your journey.",
        "### Pre-existing Conditions",
        "Certain existing medical conditions may require individual health assessment.",
      ].join("\n"),
    });

    expect(travelGuide.metadata.docType).toBe("GUIDE");
    expect(travelGuide.metadata.insurerCode).toBe("COVER_MORE");
    expect(travelGuide.metadata.category).toBe("travel-specialists");
    expect(travelGuide.r2Key).toBe(
      "corpus/guides/cover-more/travel-insurance-medical-cover/GUIDE_2026-10-25.md"
    );
    expect(travelGuide.markdown).toContain("General Advice Warning");
    expect(travelGuide.markdown).toContain("Emergency hospital and medical expenses");

    // Life Insurer: Zurich
    const lifeGuide = normalizeGuideDocument({
      insurer: "Zurich",
      product: "Life Insurance",
      category: "life-insurers",
      url: "https://www.zurich.com.au/life-insurance/tpd",
      canonical_url: "https://www.zurich.com.au/life-insurance/tpd",
      title: "Total and Permanent Disablement Cover",
      retrieved_at: "2026-10-25",
      markdown: [
        "# TPD Insurance",
        "## Understanding TPD Cover",
        "TPD cover provides a lump sum payment if you become permanently disabled and unable to work.",
        "### Any Occupation vs Own Occupation",
        "Different definitions apply based on the occupation criteria selected at application.",
      ].join("\n"),
    });

    expect(lifeGuide.metadata.docType).toBe("GUIDE");
    expect(lifeGuide.metadata.insurerCode).toBe("ZURICH");
    expect(lifeGuide.metadata.category).toBe("life-insurers");
    expect(lifeGuide.r2Key).toBe("corpus/guides/zurich/life-insurance-tpd/GUIDE_2026-10-25.md");
    expect(lifeGuide.markdown).toContain("General Advice Warning");
    expect(lifeGuide.markdown).toContain("Any Occupation vs Own Occupation");
  });
});
