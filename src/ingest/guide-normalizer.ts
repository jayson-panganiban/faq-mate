import { resolveInsurer, toInsurerSlug } from "../constants/insurers";
import {
  buildR2PathKey,
  type CorpusDocumentMetadata,
  formatStatutoryFooter,
  generateBreadcrumbHeader,
} from "./corpus-codec";

export { buildR2PathKey };

export interface ParsedGuideDocument {
  insurer: string;
  product: string;
  category?: string;
  url: string;
  canonical_url: string;
  title: string;
  retrieved_at: string;
  content_hash?: string;
  text_length?: number;
  markdown: string;
}

export interface NormalizedGuideDocument {
  r2Key: string;
  metadata: CorpusDocumentMetadata;
  markdown: string;
  sectionsCount: number;
}

function pageSlug(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    const slug = toInsurerSlug(path);
    return slug || "index";
  } catch {
    return "index";
  }
}

function stripResidualHtml(markdown: string): string {
  return markdown
    .replace(
      /<\/?(?:p|div|span|a|ul|ol|li|br|strong|b|em|i|table|thead|tbody|tr|td|th)\b[^>]*>/gi,
      ""
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTopLevelHeadings(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !/^#\s+/.test(line))
    .join("\n")
    .trim();
}

/**
 * Removes heading markers that carry no text. Source pages occasionally emit
 * an empty heading (for example a bare `###` above an accordion that the
 * extractor already emptied), which would otherwise become an operative
 * section with no body.
 */
function stripBareHeadings(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !/^#{1,6}\s*$/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function isTableRow(line: string): boolean {
  return /^\s*\|/.test(line) || /\|\s*$/.test(line);
}

/** Splits a pipe row, honouring escaped pipes inside cells. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "\\|";
      i++;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Drops table rows whose column count does not match the header. Source pages
 * lose icon-only cells (ticks rendered as images) and merged cells, which
 * shifts the remaining values into the wrong columns. When most rows are
 * broken the whole table is discarded rather than left half-empty.
 */
function sanitizeTables(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const isHeader =
      isTableRow(lines[i]) && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]);
    if (!isHeader) {
      kept.push(lines[i]);
      i++;
      continue;
    }

    const headerWidth = splitTableRow(lines[i]).length;
    let end = i + 2;
    while (end < lines.length && isTableRow(lines[end])) end++;
    const rows = lines.slice(i + 2, end);
    const valid = rows.filter((row) => splitTableRow(row).length === headerWidth);
    const dropped = rows.length - valid.length;

    if (rows.length > 0 && dropped / rows.length > 0.5) {
      i = end;
      continue;
    }

    kept.push(lines[i], lines[i + 1], ...valid);
    i = end;
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Removes standalone marketing chrome that carries no policy information:
 * quote/payment/award call-to-action links and bare review scores. Call-to-action
 * links are removed from otherwise useful lines (for example a row that also
 * links to the PDS), and lines left empty are dropped.
 */
const CTA_LINK =
  /\[(?:start (?:a|your) quote|get (?:a )?quote(?: online)?|get quote|compare (?:cover|quotes?)|buy now|make a payment|make a claim|claim now online|see our awards|view our awards|view more articles|start exploring|make or track a claim|retrieve quote)\]\([^)]*\)/gi;

const RATING_LINE = /^\d(?:\.\d)?(?:\/5| out of 5)?$/;

const TEL_LINK_LINE = /^\[[^\]]*\]\(tel:[^)]*\)$/;

const CTA_HREF =
  /\/(?:quote|quotes|payments?|pay|login|log-in|sign-in|my-account|secure|retrieve-quote|cart|checkout)(?:[-/?#.]|$)/i;

const CTA_LABEL_LINE =
  /^(?:#{1,6}\s+)?\**\s*(?:get a quote(?: for)?|save \d+%.*|up to \d+% off.*|log ?in(?: to)? .+|pay or renew|policy documents|skip the queue.*|show me products.*|learn more(?: about .+)?(?: >)?|find out more(?: >)?|read more(?: >)?|contact us|call us|back to top|sign up for subscriber only discounts.*|you.re in!?|unsubscribe at anytime.*)\s*\**$/i;

const NAV_LABEL_LINE =
  /^\**\s*(?:travel insurance|destinations|our cover|help|insurance|products?|support|about(?: us)?|contact(?: us)?|claims?|reviews?)\s*\**$/i;

function stripChromeLines(markdown: string): string {
  const kept: string[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }
    if (TEL_LINK_LINE.test(trimmed)) continue;
    if (CTA_LABEL_LINE.test(trimmed) || NAV_LABEL_LINE.test(trimmed)) continue;

    const bare = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
    const soleLink = bare.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (soleLink) {
      const label = soleLink[1].replace(/\*\*/g, "").trim();
      if (CTA_HREF.test(soleLink[2]) || CTA_LABEL_LINE.test(label)) continue;
    }

    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strips a trailing brand segment that the site repeats in <title>
 * ("Death Benefit - Zurich Australia", "Boat Insurance – RACT").
 */
function cleanPageTitle(title: string, insurer: string): string {
  const brand = insurer.trim().toLowerCase();
  const parts = title.split(/\s+[|–—]\s+|\s+-\s+/);
  if (parts.length < 2) return title;

  const tail = parts[parts.length - 1].trim().toLowerCase();
  const isBrand = tail === brand || tail.startsWith(`${brand} `) || brand.startsWith(`${tail} `);
  if (!isBrand) return title;

  return parts.slice(0, -1).join(" - ").trim();
}

function stripMarketingChrome(markdown: string): string {
  const lines: string[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (RATING_LINE.test(line.trim())) continue;

    const withoutCta = line
      .replace(CTA_LINK, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/^[\s|•,]+|[\s|•,]+$/g, "");

    if (withoutCta.trim().length === 0 && line.trim().length > 0) continue;
    lines.push(withoutCta);
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Source markup sometimes wraps a heading inside an anchor, which markdownify
 * renders as `[### Label](url)`. Drop the stray heading markers from the label.
 */
function stripHeadingMarkersInLinks(markdown: string): string {
  return markdown.replace(/\[(#{1,6})\s+/g, "[");
}

/**
 * Accordions and tab sets often render their trigger as an anchor to a
 * fragment. When the label fronts real prose it becomes a section heading;
 * otherwise it is navigation (table of contents, "Back to top", review links)
 * and is dropped.
 */
const ANCHOR_ONLY_LINE = /^(?:[-*+]\s+)?\[([^\]]{2,160})\]\(([^)]*)\)$/;
const NAV_ANCHOR_LABEL =
  /^(?:back to top|view (?:details|disclaimers?|more)|read (?:all )?.*reviews?|compare cover|find out more|learn more|see more|show more|read more|next|previous)$/i;

function stripAnchorNavigation(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(ANCHOR_ONLY_LINE);
    if (!match) {
      kept.push(lines[i]);
      continue;
    }

    const [, label, href] = match;
    if (!href.startsWith("#")) {
      kept.push(lines[i]);
      continue;
    }

    let next = i + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    const following = next < lines.length ? lines[next].trim() : "";
    const followingIsStructural =
      !following || ANCHOR_ONLY_LINE.test(following) || /^#{1,6}\s/.test(following);

    const fragment = href.slice(1).trim();
    const isNavigation =
      !fragment || NAV_ANCHOR_LABEL.test(label) || !/\s/.test(label) || followingIsStructural;

    if (!isNavigation && following.length >= 40) {
      kept.push(`### ${label}`);
    }
    // Navigation anchors carry no answer text; drop them.
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Link labels are occasionally split across source lines. Join them so the
 * label reads as one phrase instead of a broken fragment.
 */
function joinMultilineLinkLabels(markdown: string): string {
  let text = markdown;
  for (let pass = 0; pass < 5; pass++) {
    const next = text.replace(/\[([^[\]]*)\n+([^[\]]*)\]/g, "[$1 $2]");
    if (next === text) break;
    text = next;
  }
  return text;
}

const NAVIGATIONAL_SECTION = new RegExp(
  "^(?:" +
    [
      ".*\\binsights",
      "(?:.*\\s)?guides?",
      "explore more articles",
      "related articles",
      "related content",
      "further reading",
      "learn more",
      "find out more",
      "more about .+",
      "want to know more\\??",
      "get in the know",
      "learn more with .+",
      "learn more about .+",
      "want more options\\??",
      "looking for something else\\??",
      "need cover for contents inside the home\\??",
      "what people are saying.*",
      "(?:customer )?reviews?",
    ].join("|") +
    ")$",
  "i"
);

/**
 * Drops punctuation-only leftovers ("-", ".", "†.") that the source markup
 * leaves behind when a decorative element is emptied.
 */
function stripJunkLines(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "---") return true;
      if (/^(?:true|false|null|undefined|block|inline|none|auto)$/i.test(trimmed)) return false;
      if (/^Responsive (?:Spacing|Padding|Layout)$/i.test(trimmed)) return false;
      // CMS component ids such as "suncorp:bingle/products/motor/car/hire-car".
      if (/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9/_.-]*$/.test(trimmed)) return false;
      return !/^(?:\\?[-–—•*†‡§⁑#]+[.,;:]?|[.!?]+|[✓✔])$/.test(trimmed);
    })
    .join("\n");
}

/**
 * Card components sometimes render their icon name as a bare word directly
 * before the card heading ("business", "motor", "compare", "checklist"). Drop
 * that label when the next non-empty line is a heading.
 */
function stripIconLabels(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (/^[a-z][a-z-]{1,14}$/.test(trimmed)) {
      let next = index + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (next < lines.length && /^#{1,6}\s/.test(lines[next].trim())) continue;
    }
    kept.push(lines[index]);
  }
  return kept.join("\n");
}

/**
 * A markdown section: its own heading, the direct body lines that sit before
 * the first child heading, and nested sections. Footer navigation is often
 * nested under a content heading, so both cleanup passes have to walk the tree
 * instead of only looking at top-level sections.
 */
interface MarkdownSection {
  level: number;
  heading: string;
  lines: string[];
  children: MarkdownSection[];
}

function parseSections(lines: string[]): MarkdownSection[] {
  const root: MarkdownSection = { level: 0, heading: "", lines: [], children: [] };
  const stack: MarkdownSection[] = [root];

  for (const line of lines) {
    const match = line.match(/^(#{2,6})\s+(.*)$/);
    if (!match) {
      stack[stack.length - 1].lines.push(line);
      continue;
    }
    const section: MarkdownSection = {
      level: match[1].length,
      heading: match[2].trim(),
      lines: [],
      children: [],
    };
    while (stack.length > 1 && stack[stack.length - 1].level >= section.level) stack.pop();
    stack[stack.length - 1].children.push(section);
    stack.push(section);
  }

  return root.children;
}

function renderSections(sections: MarkdownSection[]): string[] {
  const out: string[] = [];
  for (const section of sections) {
    out.push(`${"#".repeat(section.level)} ${section.heading}`, ...section.lines);
    out.push(...renderSections(section.children));
  }
  return out;
}

function sectionLinksOnly(lines: string[]): boolean {
  let links = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;
    const bare = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
    if (/^\[[^\]]*\]\([^)]*\)$/.test(bare)) {
      links++;
      continue;
    }
    return false;
  }
  return links >= 2;
}

/**
 * Drops sections that contain nothing but links ("Popular destinations",
 * "Your policy", footer columns). They are navigation, not policy content.
 */
function stripLinkOnlySections(markdown: string): string {
  const prune = (sections: MarkdownSection[]): MarkdownSection[] => {
    const kept: MarkdownSection[] = [];
    for (const section of sections) {
      if (sectionLinksOnly(section.lines)) continue;
      section.children = prune(section.children);
      kept.push(section);
    }
    return kept;
  };

  const lines = markdown.split(/\r?\n/);
  const root: MarkdownSection = {
    level: 0,
    heading: "",
    lines: [],
    children: parseSections(lines),
  };
  const firstHeading = lines.findIndex((line) => /^#{2,6}\s+/.test(line));
  const preamble = firstHeading === -1 ? lines : lines.slice(0, firstHeading);
  return [...preamble, ...renderSections(prune(root.children))].join("\n");
}

/**
 * Responsive sites render the same block once per breakpoint, so a page can
 * carry an identical section two or three times. Keep the first occurrence
 * among siblings.
 */
function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** Share of `a`'s tokens that also appear in `b`. */
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / a.size;
}

/**
 * Responsive sites render the same block once per breakpoint, so a page can
 * carry a truncated copy of a section. Collapse a section only when its words
 * are already contained in a sibling with the same heading; distinct sections
 * that reuse a heading (GIO's per-item "Coverage outside the home") stay.
 */
function dedupeSections(markdown: string): string {
  const dedupe = (sections: MarkdownSection[]): MarkdownSection[] => {
    const kept: MarkdownSection[] = [];
    const indexesByHeading = new Map<string, number[]>();

    for (const section of sections) {
      section.children = dedupe(section.children);
      const key = section.heading.toLowerCase();
      const tokens = tokenSet(renderSections([section]).join("\n"));
      const candidates = indexesByHeading.get(key) ?? [];

      let duplicate = false;
      for (const index of candidates) {
        const otherTokens = tokenSet(renderSections([kept[index]]).join("\n"));
        if (containment(tokens, otherTokens) >= 0.995) {
          duplicate = true;
          break;
        }
        if (containment(otherTokens, tokens) >= 0.995) {
          kept[index] = section;
          duplicate = true;
          break;
        }
      }

      if (!duplicate) {
        candidates.push(kept.length);
        indexesByHeading.set(key, candidates);
        kept.push(section);
      }
    }

    return kept;
  };

  const lines = markdown.split(/\r?\n/);
  const firstHeading = lines.findIndex((line) => /^#{2,6}\s+/.test(line));
  const preamble = firstHeading === -1 ? lines : lines.slice(0, firstHeading);
  return [...preamble, ...renderSections(dedupe(parseSections(lines)))].join("\n");
}

/**
 * Footnote markers sometimes sit in front of a paragraph as a bare "#", which
 * markdownify emits as "#Text" (a heading with no space). Treat it as prose.
 */
function stripGluedHeadingMarkers(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}(?=[A-Za-z*[(])/, ""))
    .join("\n");
}

/**
 * Long sentences styled as headings are body copy in the source page. Demote
 * them to paragraphs so the document outline stays navigable.
 */
function demoteSentenceHeadings(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(#{2,6})\s+(.*)$/);
      if (!match) return line;
      const text = match[2].trim();
      if (text.length > 100 && /[.!?]$/.test(text)) return text;
      return line;
    })
    .join("\n");
}

/**
 * Drops purely navigational/blog-teaser sections (for example "Insights" or
 * "Learn more with …") so the corpus contains policy information, not links
 * to unrelated articles.
 */
function stripNavigationalSections(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];
  let skipLevel: number | null = null;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      if (skipLevel !== null) {
        if (level <= skipLevel) {
          skipLevel = null;
        } else {
          continue;
        }
      }
      if (NAVIGATIONAL_SECTION.test(match[2].trim())) {
        skipLevel = level;
        continue;
      }
    }

    if (skipLevel !== null) continue;
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Removes empty H2–H4 leaf sections left behind by promo/blog teaser blocks
 * (for example a heading that only linked to an article). Parent headings with
 * deeper children are preserved.
 */
function stripEmptySections(markdown: string): string {
  const headingPattern = /^(#{1,6})\s+/;
  let lines = markdown.split(/\r?\n/);

  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    const kept: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(headingPattern);
      if (!match || match[1].length < 2 || match[1].length > 4) {
        kept.push(lines[i]);
        continue;
      }

      const level = match[1].length;
      let next = i + 1;
      while (next < lines.length && !headingPattern.test(lines[next])) next++;

      const body = lines
        .slice(i + 1, next)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line !== "---");

      const nextMatch = next < lines.length ? lines[next].match(headingPattern) : null;
      const hasDeeperChild = nextMatch ? nextMatch[1].length > level : false;

      if (body.length === 0 && !hasDeeperChild) {
        changed = true;
        continue;
      }

      kept.push(lines[i]);
    }

    lines = kept;
    if (!changed) break;
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Deep Module: Normalizes a curated official insurer guide page into canonical
 * Spec 01 / Spec 06 Markdown with `<!-- BREADCRUMB -->` frontmatter and GAW.
 */
export function normalizeGuideDocument(parsed: ParsedGuideDocument): NormalizedGuideDocument {
  const resolved = resolveInsurer(parsed.insurer);
  const insurer = resolved ? resolved.profile.name : parsed.insurer;
  const insurerCode = resolved ? resolved.profile.code : parsed.insurer.toUpperCase();
  const category = resolved ? resolved.profile.category : parsed.category || "general";
  const underwriter = resolved ? resolved.profile.underwriter : `${insurer} Australia`;

  const slug = pageSlug(parsed.canonical_url || parsed.url);
  const meta: CorpusDocumentMetadata = {
    insurer,
    insurerCode,
    category,
    product: parsed.product || "Insurance Guide",
    productSlug: slug,
    docType: "GUIDE",
    effectiveDate: parsed.retrieved_at,
    version: parsed.retrieved_at,
    underwriter,
    sourceUrl: parsed.canonical_url || parsed.url,
    jurisdiction: "Australia (Cth)",
  };

  const r2Key = buildR2PathKey(meta);
  const cleaned = cleanPageTitle(parsed.title, insurer);
  // A title that only repeats the brand ("MetLife Australia") says nothing about
  // the page; fall back to the product label from the seed.
  const brandOnly = new RegExp(
    `^${insurer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+australia)?$`,
    "i"
  );
  const pageTitle = cleaned && !brandOnly.test(cleaned.trim()) ? cleaned : parsed.product;
  const breadcrumb = generateBreadcrumbHeader(meta, undefined, undefined, {
    product_slug: slug,
    page_title: pageTitle,
    retrieved_at: parsed.retrieved_at,
    ...(parsed.content_hash ? { content_hash: parsed.content_hash } : {}),
  });

  const body = [
    stripTopLevelHeadings,
    stripResidualHtml,
    stripGluedHeadingMarkers,
    joinMultilineLinkLabels,
    stripHeadingMarkersInLinks,
    stripAnchorNavigation,
    stripMarketingChrome,
    stripChromeLines,
    stripJunkLines,
    stripIconLabels,
    demoteSentenceHeadings,
    sanitizeTables,
    stripBareHeadings,
    stripNavigationalSections,
    stripLinkOnlySections,
    dedupeSections,
    stripEmptySections,
  ].reduce((text, transform) => transform(text), parsed.markdown);
  const docTitle = pageTitle ? `${insurer} — ${pageTitle}` : `${insurer} — ${parsed.product}`;

  const parts: string[] = [
    breadcrumb,
    "",
    `# ${docTitle}`,
    "",
    `*Source: [${meta.sourceUrl}](${meta.sourceUrl}) | Retrieved: ${parsed.retrieved_at} | Document type: GUIDE*`,
    "",
    "---",
    "",
    body,
    "",
    formatStatutoryFooter(),
  ];

  return {
    r2Key,
    metadata: meta,
    markdown: `${parts
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()}\n`,
    sectionsCount: (body.match(/^#{2,3}\s+/gm) || []).length,
  };
}
