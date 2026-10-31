/**
 * Markdown pre-pipeline for derived corpus text (comparison cells, source
 * excerpts). Chat replies render through the citation-aware parser in
 * `AssistantMessage`; everything else must pass through here so raw strings
 * never reach the UI.
 *
 * 1. `stripBackendTags`     — internal pipeline tags (e.g. `**Clause
 *                             Classification:**`) and breadcrumb comments
 *                             are removed before parsing.
 * 2. `cleanRawMarkdownUrls` — URLs rendered with themselves as the label
 *                             (`[https://…](https://…)`), plus bare URLs, are
 *                             rewritten into clean labelled anchors.
 *
 * Parsing itself is React-Markdown's standard parser (see `MarkdownText`):
 * `**` becomes emphasis text, `###` becomes a real heading, and raw HTML in
 * the markdown never reaches the DOM — an inherent sanitization invariant.
 */

/** Tag phrases whose whole line is pipeline metadata, not consumer copy. */
const BACKEND_TAG_LABELS: string[] = [
  "clause classification",
  "corpus id",
  "chunk id",
  "retrieval id",
  "breadcrumb",
  "internal tags",
];

const TAG_LINE_PATTERNS = BACKEND_TAG_LABELS.map(
  (label) =>
    new RegExp(
      `^\\s{0,3}(?:[-*+]\\s+|>\\s*|\\d+[.)]\\s*)?(?:\\*\\*|__)?\\s*${label}(?:\\*\\*|__)?\\s*:?`,
      "i"
    )
);

/** Inline bracketed backend markers like `[internal: …]`. */
const BRACKET_TAG_PATTERN = /\s*\[(?:internal|backend|debug)\][^\n]*/gi;

/** Redundant source-URL announcement prefix; the cleaned anchor supersedes it. */
const SOURCE_URL_PREFIX_PATTERN = /\s*(?:\*\*|__)?\s*official source url(?:\*\*|__)?\s*::?\s*/gi;

/** Executable / embedding markup: removed together with their content. */
const HARMFUL_HTML_BLOCK =
  /<(?:script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|form)>/gi;

/** Leftover harmful tag shells (unpaired or self-closing). */
const HARMFUL_HTML_SHELL = /<\/?(?:script|style|iframe|object|embed|form)\b[^>]*>/gi;

/**
 * Any other raw HTML tag markup: attribute markup is removed so nothing
 * inert-but-leaky (e.g. `javascript:` hrefs) reaches the UI; inner text stays.
 */
const RAW_HTML_TAG = /<[a-zA-Z!/?][^>]*>/g;

/** Clean label for links whose caption would otherwise be the URL itself. */
export const CLEAN_URL_LABEL = "Official source document";

const SENTINEL_OPEN = "\uE000";
const SENTINEL_CLOSE = "\uE001";

const MARKDOWN_LINK_PATTERN = /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>(?:\s+"[^"]*")?\s*\)/g;

function stripBackendTags(markdown: string): string {
  let stage = markdown;
  stage = stage.replace(/<!--[\s\S]*?-->/g, "");
  // Raw HTML is removed wholesale: harmful blocks with their content, every
  // remaining tag shell without it — the parser renders structure from
  // markdown syntax alone, never from embedded markup.
  stage = stage.replace(HARMFUL_HTML_BLOCK, "");
  stage = stage.replace(HARMFUL_HTML_SHELL, "");
  stage = stage.replace(RAW_HTML_TAG, "");
  const keptLines: string[] = [];
  for (const line of stage.split("\n")) {
    if (TAG_LINE_PATTERNS.some((pattern) => pattern.test(line))) continue;
    keptLines.push(line);
  }
  stage = keptLines.join("\n");
  stage = stage.replace(BRACKET_TAG_PATTERN, "");
  stage = stage.replace(SOURCE_URL_PREFIX_PATTERN, "");
  return stage;
}

function cleanRawMarkdownUrls(markdown: string): string {
  const stashed: string[] = [];
  // 1) Protect existing markdown links so their inner URLs are not re-wrapped.
  const scaffold = markdown.replace(MARKDOWN_LINK_PATTERN, (match) => {
    stashed.push(match);
    return `${SENTINEL_OPEN}${stashed.length - 1}${SENTINEL_CLOSE}`;
  });
  // 2) Links captioned by the raw URL itself become clean, labelled anchors.
  const restorable = stashed.map((link) =>
    link.replace(MARKDOWN_LINK_PATTERN, (match, bang: string, label: string, url: string) => {
      if (bang || !/^https?:\/\//i.test(label.trim())) return match;
      return `[${CLEAN_URL_LABEL}](${url})`;
    })
  );
  // 3) Bare URLs in the scaffold (none live inside links after step 1)
  //    become labelled anchors too, with sentence punctuation left outside.
  const linked = scaffold.replace(/https?:\/\/[^\s<>()[\]]+/gi, (match) => {
    const url = match.replace(/[.,;:!?)\]]+$/, "");
    return `[${CLEAN_URL_LABEL}](${url})${match.slice(url.length)}`;
  });
  // 4) Restore the (already cleaned) markdown links.
  let stage = linked;
  for (let index = restorable.length - 1; index >= 0; index--) {
    stage = stage.replace(
      new RegExp(`${SENTINEL_OPEN}${index}${SENTINEL_CLOSE}`, "g"),
      restorable[index]
    );
  }
  return stage;
}

/**
 * Pre-processing pass: internal backend tags stripped and raw URLs formatted
 * into clean anchors, producing markdown that is safe to parse for the UI.
 */
export function sanitizeSourceMarkdown(markdown: string): string {
  return cleanRawMarkdownUrls(stripBackendTags(markdown))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
