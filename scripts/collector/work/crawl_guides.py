#!/usr/bin/env python3
"""Crawl official insurer guide pages into raw HTML + extracted Markdown.

This collector is intentionally conservative: it reads a curated seed CSV, obeys
robots.txt crawl-delay/disallow rules, extracts the main article body, and writes
one JSON record per canonical page. It is not a whole-site crawler.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString
from markdownify import markdownify

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
GUIDES_DIR = os.path.join(ROOT, "guides")
SEEDS_DIR = os.path.join(ROOT, "guide_seeds")
MANIFEST_PATH = os.path.join(ROOT, "guides_manifest.csv")

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 FAQMateCorpus/1.0"
)

BOILERPLATE_TAGS = (
    "script",
    "style",
    "noscript",
    "svg",
    "iframe",
    "form",
    "button",
    "nav",
    "header",
    "footer",
)

BOILERPLATE_ATTR = re.compile(
    r"(?:^|[-_])(?:nav|menu|breadcrumb|cookie|modal|footer|header|social|share|"
    r"related|promo|search|quote|cta|button|banner|advert|sidebar)(?:$|[-_])",
    re.I,
)

# FAQ/accordion containers reuse names like `cmp-accordion__header` and
# `cmp-accordion__button`; keep them so question text survives extraction.
CONTENT_KEEP_ATTR = re.compile(r"accordion|faq", re.I)

CTA_LINES = re.compile(
    r"^(?:get a quote|make a claim|read article|learn more|find out more|"
    r"get started|compare now|see more|view more|back to top|scroll to top|apply now|"
    r"get more info|retrieve my policy number|chat now!?|log into my account|"
    r"register|claim now online|call \d[\d\s]*|call \[[\d\s]+\]\(tel:[^)]*\)|"
    r"\*\*call us on \[[\d\s]+\]\(tel:[^)]*\)\*\*|"
    r"let.s get started|"
    r"read all .*reviews?)$",
    re.I,
)

CTA_LINK_TOKEN = (
    r"\[(?:start (?:a|your) quote|get (?:a )?quote(?: online)?|get quote|"
    r"retrieve a quote|make a claim|make a payment|compare (?:cover|quotes?)|"
    r"buy now|read more|learn more|find out more|get started|see more|"
    r"view more|view (?:our )?awards?|view my policy|pay my bill|apply now)\]"
    r"\([^)]*\)"
)

CTA_LINKS = re.compile(rf"^(?:{CTA_LINK_TOKEN}[\s|•,]*)+$", re.I)

PROMO_LINES = re.compile(
    r"^(?:#{1,6}\s+)?(?:join .*#1 .*insurer.*|get \$?\d+ off.*|\$?\d+ off|"
    r"first year online discount.*|your first year when you quote.*|"
    r"with a first year online discount.*|more about first year online discount.*|"
    r"read all \d+ .*reviews?|\(?\d(?:\.\d)? out of 5\)?)$",
    re.I,
)

# Inline tooltips render as trailing links on AAMI-style component pages.
INLINE_TOOLTIP = re.compile(
    r"\s*\[More (?:information|about|info)(?: on)? [^\]\n]*\]\([^)\n]*\)", re.I
)

# Promotional sentences embedded inside otherwise useful body copy. Keep the
# match on one line so it can never swallow following content blocks.
INLINE_PROMO = re.compile(r"\s*Get \$?\d+ off[^.\n]*\.", re.I)

# Chatty filler appended to "Existing customer" instructions.
INLINE_PSST = re.compile(r"\s*Psst\s*[-–—]\s*you[^.\n]*policy number[^.\n]*\.", re.I)

BARE_URL_LINE = re.compile(r"^<https?://[^>]+>$")
ANCHOR_PLACEHOLDER = re.compile(r"^<#[^>]+>$")
TEL_PLACEHOLDER = re.compile(r"^<tel:[^>]+>$")
PATH_LINK_LINE = re.compile(r"^\[/[^\]]*\]\([^)]*\)$")
QUERY_LINE = re.compile(r"^\?[\w=&%.\-]+$")
EMPTY_HEADING_ITEM = re.compile(r"^(?:[-*+]\s+)?#{1,6}\s*$")

# AAMI renders content in styled divs and exposes design tokens (icon names,
# colour tones, layout hints) as visible text.
AAMI_TOKEN = re.compile(
    r"^(?:neutral|tick|cross|primary|secondary|error|success|center|full|narrow|"
    r"light|dark|block|vertical|horizontal|true|false|minimal|hero|hero-banner|"
    r"header|id|headers|coverage|calculator|home|contents|strata|person|pdf|pay|"
    r"event|download|quote|correct|log-in|chatbot|complete-online|how-to-get|"
    r"get-in-touch|target-scope-name|home; contents|landlordbuildingcontents|"
    r"one|two|three|four|five|six|first|second|third|fourth|finally|last|"
    r"warning|unspecified|specified|"
    r"lucky you.re with an award winner|suncorp:\S+)$",
    re.I,
)

# Icon names that are ordinary lowercase words, so they must match case exactly
# to avoid deleting legitimate headings such as "Flood".
AAMI_ICON_TOKEN = re.compile(
    r"^(?:flood|storm|lightning|bushfire|tsunami|theft|explosion|soft|key|alert|"
    r"portable|landlord|home|contents|strata|car|pet|travel)$"
)

AAMI_CAMEL_TOKEN = re.compile(r"^[a-z][A-Za-z]*[A-Z][A-Za-z]*$")

# Cross-sell carousels start with a question that only advertises other products.
AAMI_CROSS_SELL = re.compile(
    r"^(?:need cover for .+|looking for .+|want more options\??|"
    r"you might also like.*|explore more .+)$",
    re.I,
)

# Site-scoped removal of structural components that carry no policy content.
SITE_DROP_SELECTORS = {
    "www.aami.com.au": (
        ".sub-bar-navigation",
        ".section-metadata",
        ".image-block",
        ".page-banner",
        ".product-banner",
        ".tabs",
        ".accordion",
        ".carousel",
        ".review-carousel",
        ".promotion",
        ".large-tiles",
        ".tiles",
        ".calculator",
    ),
    # NobleOak appends an "insights" teaser grid and a Feefo rating widget to
    # every product page; both are cross-sell, not policy content.
    "www.nobleoak.com.au": (
        ".insights_listing-tiles",
        "section.feefo",
        ".navigation-details",
    ),
    # Fast Cover is a Framer site whose footer nav ("How can we help?") is
    # rendered inside <main> under a stable anchor id.
    "fastcover.com.au": ("#how-can-we-help",),
}

# Component-driven sites sometimes put the article body outside <main>, or
# reuse <main> for the hero only. Keep these overrides site-scoped.
SITE_MAIN_SELECTOR = {
    "www.challenger.com.au": "#content",
    "www.ppsmutual.com.au": "div.modules",
}

# Component-driven sites sometimes expose design-token text and internal
# navigation as visible copy. Keep these rules site-scoped so other insurers'
# legitimate words are not removed.
SITE_NOISE = {
    "www.challenger.com.au": re.compile(
        r"^(?:Loading(?: component)?\.{2,}|I'm interested in\.\.\.)$", re.I
    ),
    "www.aami.com.au": re.compile(
        r"^(?:neutral|tick|cross|primary|secondary|error|success|center|full|"
        r"narrow|light|dark|id|headers|coverage|skip the queue.*|"
        r"view/update policy|pay or renew|get documents|visit canstar website|"
        r"lucky you.re with an award winner|aami is proud.*|"
        r"more about [^.]+|proudly supporting|"
        r"victorian state emergency service.*|aami has proudly supported.*|"
        r"change my lender|renew my policy|manage policy|update policy|"
        r"monday to friday.*|call us for a quote.*|assessing your property|"
        r"home building calculator|contents calculator|other benefits|"
        r"policy disclosure statement \(pds\)|"
        r"cancel my policy|\[/content/[^\]]*\]\([^)]*\)|"
        r"\[more information on [^\]]*\]\([^)]*\))$",
        re.I,
    ),
}

PROMO_TITLE_TAIL = re.compile(r"(?:quote|off|save|discount|\$\d|online)", re.I)


def clean_title(title):
    """Strip promotional suffixes from a page title."""
    if not title:
        return title
    parts = re.split(r"\s*(?:\||[-–—])\s*", title)
    if len(parts) > 1:
        tail = " ".join(parts[1:])
        if PROMO_TITLE_TAIL.search(tail):
            return parts[0].strip()
    return title


# A few origins reject curl's TLS fingerprint but serve the same page to a
# normal Python client. Keep the fallback site-scoped so curl stays the default.
REQUESTS_ONLY_HOSTS = {"www.allianz.com.au"}


def fetch_with_requests(url, timeout=45):
    import requests

    try:
        resp = requests.get(
            url,
            headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AU,en;q=0.9",
            },
            timeout=timeout,
            allow_redirects=True,
        )
        return str(resp.status_code), resp.url, resp.text
    except Exception as exc:  # noqa: BLE001 - collector should record and continue
        return "ERR", url, str(exc)


def fetch(url, timeout=45):
    if urlparse(url).netloc.lower() in REQUESTS_ONLY_HOSTS:
        return fetch_with_requests(url, timeout)
    try:
        proc = subprocess.run(
            [
                "curl",
                "-sSL",
                "--max-time",
                str(timeout),
                "--compressed",
                "-A",
                UA,
                "-o",
                "-",
                "-w",
                "\n__META__%{http_code} %{url_effective}",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        body, _, meta = proc.stdout.rpartition("\n__META__")
        parts = meta.split(" ", 1)
        code = parts[0] if parts else "0"
        final = parts[1].strip() if len(parts) > 1 else url
        return code, final, body
    except Exception as exc:  # noqa: BLE001 - collector should record and continue
        return "ERR", url, str(exc)


def robots_policy(url, timeout=20):
    """Return (crawl_delay, disallow_paths) for the site's wildcard agent."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    code, _, body = fetch(robots_url, timeout)
    if code != "200":
        return 0, []
    delay = 0
    disallow = []
    in_wildcard = False
    for raw in body.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            in_wildcard = value == "*"
        elif in_wildcard and key == "crawl-delay":
            try:
                delay = float(value)
            except ValueError:
                pass
        elif in_wildcard and key == "disallow" and value:
            disallow.append(value)
    return delay, disallow


def is_disallowed(path, disallow_paths):
    return any(path == p or path.startswith(p.rstrip("/") + "/") for p in disallow_paths)


def slug_from_url(url):
    path = urlparse(url).path.strip("/")
    slug = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-")
    return slug or "index"


def insurer_slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def text_stats(element):
    text = element.get_text(" ", strip=True)
    link_text = " ".join(a.get_text(" ", strip=True) for a in element.find_all("a"))
    ratio = len(link_text) / max(1, len(text))
    return len(text), ratio


def find_main(soup):
    """Locate the article body without relying on one site's CSS classes."""
    h1 = soup.find("h1")
    if h1:
        for parent in h1.parents:
            if parent.name in ("body", "html"):
                break
            length, link_ratio = text_stats(parent)
            if length >= 800 and link_ratio < 0.35:
                return parent

    candidates = soup.select("main, article, [role=main], .aem-Grid, .cmp-container")
    best = None
    best_score = 0.0
    for element in candidates:
        length, link_ratio = text_stats(element)
        if length < 500:
            continue
        score = length * (1.0 - min(link_ratio, 1.0))
        if score > best_score:
            best = element
            best_score = score
    return best or soup.body or soup


def repair_nested_list_items(element):
    """Flatten malformed lists where one <li> swallows the following items.

    Several sites omit the closing </li> (and </p>), so the parser nests the
    next item inside the previous one. markdownify then renders the whole list
    as a single line. Real nested lists always wrap their items in <ul>/<ol>,
    so an <li> with an <li> ancestor but no list element in between is always a
    parsing artifact.
    """
    changed = True
    while changed:
        changed = False
        for item in element.find_all("li"):
            node = item.parent
            owner = None
            while node is not None and node.name not in ("ul", "ol", "body", "html"):
                if node.name == "li":
                    owner = node
                    break
                node = node.parent
            if owner is None:
                continue
            item.extract()
            owner.insert_after(item)
            changed = True
            break


def prune(element):
    repair_nested_list_items(element)
    # Footnote markers are rendered as <sup>; they glue digits onto words and
    # can leave a leading "#" that markdownify turns into a fake heading.
    for tag in element.find_all("sup"):
        tag.decompose()
    # Buttons often wrap FAQ question labels; keep their text, drop the control.
    for tag in element.find_all("button"):
        tag.unwrap()
    for tag in element.find_all(BOILERPLATE_TAGS):
        tag.decompose()
    for tag in element.find_all(True):
        if tag.attrs is None:
            continue
        marker = " ".join(filter(None, [tag.get("id", ""), " ".join(tag.get("class", []))]))
        if marker and BOILERPLATE_ATTR.search(marker) and not CONTENT_KEEP_ATTR.search(marker):
            tag.decompose()
    for tag in element.find_all(["img", "picture", "source"]):
        tag.decompose()
    for anchor in element.find_all("a"):
        anchor.attrs.pop("title", None)
        anchor.attrs.pop("target", None)


def strip_tracking_params(url):
    parsed = urlparse(url)
    if not parsed.query:
        return url
    kept = [
        part
        for part in parsed.query.split("&")
        if part and not re.match(r"^(?:utm_|_gl|_ga|gclid|fbclid)", part)
    ]
    return parsed._replace(query="&".join(kept)).geturl()


def absolutize_links(element, base_url):
    for anchor in element.find_all("a", href=True):
        href = anchor["href"].strip()
        if href.startswith("javascript:"):
            del anchor["href"]
        elif href and not href.startswith(("mailto:", "tel:", "#")):
            anchor["href"] = strip_tracking_params(urljoin(base_url, href))


def drop_aami_calculators(root):
    """Remove calculator promo tiles; calculators are out of corpus scope."""
    for node in root.find_all("div"):
        kids = [kid for kid in node.find_all(recursive=False) if kid.name]
        if len(kids) < 2:
            continue
        if kids[0].get_text(" ", strip=True).lower() != "calculator":
            continue
        node.decompose()


def drop_aami_cross_sell(root):
    """Remove "Need cover for ...?" carousels and calculator promos."""
    drop_aami_calculators(root)
    for carousel in root.select(".product-carousel"):
        first = ""
        for node in carousel.find_all("div"):
            text = node.get_text(" ", strip=True)
            if text:
                first = text
                break
        if not first or AAMI_CROSS_SELL.match(first):
            carousel.decompose()


def drop_qbe_news_cards(root):
    """Remove QBE's "Read article" cards and "View all ... articles" links.

    QBE renders news/blog teasers as cards inside the product body; they link
    out to /au/news/ and carry no policy information.
    """
    for card in root.select("li.q-columnContent__card"):
        if card.select_one('a[href*="/au/news"]'):
            card.decompose()
    for anchor in root.select('a[href*="/au/news"]'):
        label = anchor.get_text(" ", strip=True)
        if re.match(r"^(?:view all|read|see)\b", label, re.I):
            header = anchor.find_parent("header")
            (header or anchor).decompose()


def group_aami_items(root):
    """Turn AAMI's per-item "What's covered" labels into section headings."""
    labels = {
        "what's covered",
        "what’s covered",
        "what's not covered",
        "what’s not covered",
        "what's included",
        "what’s included",
        "what's not included",
        "what’s not included",
    }
    for container in root.select(".feature-tab, .icon-list"):
        groups = []
        for child in list(container.find_all(recursive=False)):
            if child.name != "div":
                continue
            kids = [kid for kid in child.find_all(recursive=False) if kid.name]
            if len(kids) < 3:
                continue
            if kids[0].get_text(" ", strip=True).lower() not in ("tick", "cross"):
                continue
            label = kids[-1].get_text(" ", strip=True)
            if label.lower() not in labels:
                continue
            kids[-1].decompose()
            if groups and groups[-1][0] == label:
                groups[-1][1].append(child)
            else:
                groups.append((label, [child]))

        for label, items in groups:
            heading = root.new_tag("h2")
            heading.string = label
            items[0].insert_before(heading)


def inject_aami_headings(root):
    """Rebuild headings on AAMI pages, which use styled divs instead of h1-h6.

    Content blocks follow a consistent shape: ``<div>title</div><div>body</div>``
    (sometimes preceded by icon/tone token divs). Promoting the title div to a
    real heading lets the normalizer, linter and RAG chunker see structure.
    """
    group_aami_items(root)

    for tag in root.find_all(["div", "span", "p"]):
        if tag.find(True):
            continue
        text = tag.get_text(" ", strip=True)
        if not text:
            continue
        if AAMI_TOKEN.match(text) or AAMI_ICON_TOKEN.match(text) or AAMI_CAMEL_TOKEN.match(text):
            tag.decompose()

    # Collapse wrappers emptied by token removal.
    for _ in range(4):
        removed = False
        for tag in root.find_all("div"):
            if tag.find(True) or tag.get_text(" ", strip=True):
                continue
            tag.decompose()
            removed = True
        if not removed:
            break

    # Unwrap redundant single-child wrappers so question/answer pairs sit
    # directly beside each other.
    for _ in range(4):
        changed = False
        for tag in root.find_all("div"):
            kids = [kid for kid in tag.find_all(recursive=False) if kid.name]
            if len(kids) != 1:
                continue
            if any(isinstance(child, NavigableString) and child.strip() for child in tag.children):
                continue
            tag.unwrap()
            changed = True
        if not changed:
            break

    for container in root.find_all("div"):
        children = [child for child in container.find_all(recursive=False) if child.name]
        for index in range(len(children) - 1):
            title = children[index]
            body = children[index + 1]
            if title.name != "div" or body.name != "div":
                continue
            # Never collapse a block that already has real headings.
            if title.find(["h1", "h2", "h3", "h4", "h5", "h6"]):
                continue
            # A genuine title/body pair has a single label block. Card lists such
            # as "Home Building Insurance" + "Includes flood cover" expose two
            # label blocks and a link, so they must stay as list items.
            if title.find("a"):
                continue
            title_parts = [
                part.get_text(" ", strip=True)
                for part in title.find_all(recursive=False)
                if part.get_text(" ", strip=True)
            ]
            if len(title_parts) > 1:
                continue
            title_text = title.get_text(" ", strip=True)
            body_text = body.get_text(" ", strip=True)
            if not title_text or len(title_text) > 120:
                continue
            if title_text.endswith((".", ":", ";", ",")):
                continue
            if len(body_text) < 40:
                continue
            heading = root.new_tag("h3")
            heading.string = title_text
            title.replace_with(heading)
            children[index] = heading


def dedupe_repeated_lines(lines):
    """Drop long paragraphs that appear more than once on the same page."""
    seen = set()
    kept = []
    for line in lines:
        stripped = line.strip()
        if len(stripped) >= 80 and not stripped.startswith("#"):
            key = re.sub(r"\s+", " ", stripped).lower()
            if key in seen:
                continue
            seen.add(key)
        kept.append(line)
    return kept


def drop_empty_headings(lines):
    """Remove headings whose section has no body (e.g. a removed promo block)."""
    kept = []
    for index, line in enumerate(lines):
        stripped = line.strip()
        match = re.match(r"^(#{2,6})\s+\S", stripped)
        if not match:
            kept.append(line)
            continue
        level = len(match.group(1))
        has_body = False
        for candidate in lines[index + 1 :]:
            text = candidate.strip()
            if not text:
                continue
            next_match = re.match(r"^(#{1,6})\s+", text)
            if next_match and len(next_match.group(1)) <= level:
                break
            has_body = True
            break
        if has_body:
            kept.append(line)
    return kept


# Template headings that wrap a logo or a navigation region rather than the page.
GENERIC_HEADINGS = {
    "main navigation",
    "navigation",
    "menu",
    "breadcrumbs",
    "site footer",
    "skip to content",
    "skip to main content",
    "home",
    "search results",
}


def page_title(soup, insurer=""):
    """Pick the most descriptive title from <title> and the page's H1 elements.

    Component-driven sites often emit several H1s: a logo, a template label
    ("Main Navigation") and the real heading. Prefer a heading that matches the
    <title>; otherwise keep <title> when it is descriptive, and only fall back
    to the first meaningful H1 when the title is generic or too short.
    """
    title_tag = soup.find("title")
    head = title_tag.get_text(" ", strip=True) if title_tag else ""
    if "|" in head:
        head = head.split("|", 1)[0].strip()
    head = clean_title(head)

    generic = set(GENERIC_HEADINGS)
    if insurer:
        generic.add(insurer.strip().lower())

    candidates = []
    for tag in soup.find_all("h1"):
        text = tag.get_text(" ", strip=True)
        if text and text.lower() not in generic and text not in candidates:
            candidates.append(text)

    def norm(value):
        return re.sub(r"\W+", " ", value.lower()).strip()

    if head and head.lower() not in generic and len(head) >= 8:
        for candidate in candidates:
            if norm(candidate) == norm(head):
                return clean_title(candidate)
        return head
    if candidates:
        return clean_title(candidates[0])
    return head


def extract_markdown(html, base_url, insurer=""):
    soup = BeautifulSoup(html, "html.parser")
    title = page_title(soup, insurer)

    host = urlparse(base_url).netloc.lower()
    site_noise = SITE_NOISE.get(host)
    drop_selectors = SITE_DROP_SELECTORS.get(host, ())

    main = find_main(soup)
    if host in SITE_MAIN_SELECTOR:
        override = soup.select_one(SITE_MAIN_SELECTOR[host])
        if override is not None:
            main = override
    prune(main)
    for selector in drop_selectors:
        for element in main.select(selector):
            element.decompose()
    if host == "www.aami.com.au":
        drop_aami_cross_sell(main)
        inject_aami_headings(main)
    if host == "www.qbe.com":
        drop_qbe_news_cards(main)
    absolutize_links(main, base_url)

    markdown = markdownify(str(main), heading_style="ATX", bullets="-")
    markdown = markdown.replace("\xa0", " ").replace("\u200b", "")
    # A heading wrapped in an anchor becomes "[### Label](url)" after markdownify.
    markdown = re.sub(r"\[#{1,6}\s+", "[", markdown)
    markdown = re.sub(r"!\[[^\]\n]*\]\([^)\n]*\)", "", markdown)
    markdown = INLINE_TOOLTIP.sub("", markdown)
    markdown = INLINE_PROMO.sub("", markdown)
    markdown = INLINE_PSST.sub("", markdown)
    markdown = re.sub(r"[ \t]+", " ", markdown)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)

    cleaned_lines = []
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped:
            cleaned_lines.append("")
            continue
        candidate = re.sub(r"^#{1,6}\s+", "", stripped)
        if CTA_LINES.match(candidate) or CTA_LINKS.match(candidate):
            continue
        if PROMO_LINES.match(stripped):
            continue
        if site_noise and site_noise.match(candidate):
            continue
        if (
            BARE_URL_LINE.match(stripped)
            or ANCHOR_PLACEHOLDER.match(stripped)
            or TEL_PLACEHOLDER.match(stripped)
            or PATH_LINK_LINE.match(stripped)
            or QUERY_LINE.match(stripped)
        ):
            continue
        # An icon-only list item leaves a bare heading marker behind ("- ##").
        if EMPTY_HEADING_ITEM.match(stripped):
            continue
        if stripped in {"---", "***", "___"}:
            continue
        # Footnote markers are rendered as a trailing hash on the sentence.
        line = re.sub(r"(?<=\S)#$", "", line.rstrip())
        cleaned_lines.append(line.rstrip())

    # Drop short "Explore <thing>" teaser labels that only front a dead link.
    filtered_lines = []
    for line in cleaned_lines:
        stripped = line.strip()
        if stripped.startswith("Explore ") and len(stripped) <= 60 and not stripped.endswith("."):
            continue
        filtered_lines.append(line)
    cleaned_lines = dedupe_repeated_lines(filtered_lines)
    cleaned_lines = drop_empty_headings(cleaned_lines)

    markdown = "\n".join(cleaned_lines)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip()
    if title and not re.search(r"^#\s+", markdown, re.M):
        markdown = f"# {title}\n\n{markdown}"
    return title, markdown


def content_hash(markdown):
    normalized = re.sub(r"\s+", " ", markdown).strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def load_existing():
    records = []
    seen_urls = set()
    seen_hashes = set()
    if not os.path.isdir(GUIDES_DIR):
        return records, seen_urls, seen_hashes
    for root, _, files in os.walk(GUIDES_DIR):
        for name in files:
            if not name.endswith(".json"):
                continue
            path = os.path.join(root, name)
            try:
                record = json.load(open(path, encoding="utf-8"))
            except Exception:
                continue
            records.append(record)
            if record.get("canonical_url"):
                seen_urls.add(record["canonical_url"])
            if record.get("content_hash"):
                seen_hashes.add(record["content_hash"])
    return records, seen_urls, seen_hashes


def write_manifest(records):
    fields = [
        "insurer",
        "product",
        "category",
        "doc_type",
        "url",
        "canonical_url",
        "title",
        "retrieved_at",
        "http_status",
        "text_length",
        "content_hash",
        "json_file",
        "html_file",
    ]
    # Later records win so `--force` re-fetches replace stale manifest rows.
    deduped = {}
    for record in records:
        deduped[record.get("canonical_url") or record.get("url")] = record

    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for record in sorted(deduped.values(), key=lambda r: (r["insurer"], r["canonical_url"])):
            writer.writerow({field: record.get(field, "") for field in fields})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "seed",
        nargs="?",
        default=os.path.join(SEEDS_DIR, "nrma_home.csv"),
        help="Seed CSV with insurer,url,product,category columns",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--delay", type=float, default=0.0, help="Minimum delay between requests")
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument(
        "--min-chars",
        type=int,
        default=500,
        help="Skip pages whose extracted body is shorter than this",
    )
    parser.add_argument("--force", action="store_true", help="Refetch pages already on disk")
    args = parser.parse_args()

    with open(args.seed, newline="", encoding="utf-8") as handle:
        seeds = list(csv.DictReader(handle))

    records, seen_urls, seen_hashes = load_existing()
    robots_cache = {}
    fetched = 0
    skipped = 0
    failed = 0

    for index, seed in enumerate(seeds, 1):
        if args.limit and fetched >= args.limit:
            break
        url = seed["url"].strip()
        insurer = seed["insurer"].strip()
        product = seed["product"].strip()
        category = seed["category"].strip()

        if url in seen_urls and not args.force:
            print(f"[{index}/{len(seeds)}] skip existing: {url}", flush=True)
            skipped += 1
            continue

        parsed = urlparse(url)
        if parsed.netloc not in robots_cache:
            robots_cache[parsed.netloc] = robots_policy(url, args.timeout)
        crawl_delay, disallow = robots_cache[parsed.netloc]
        if is_disallowed(parsed.path, disallow):
            print(f"[{index}/{len(seeds)}] robots disallow: {url}", flush=True)
            skipped += 1
            continue

        code, final, body = fetch(url, args.timeout)
        fetched += 1
        if code != "200" or len(body) < 500:
            print(f"[{index}/{len(seeds)}] FAIL {code} {url}", flush=True)
            failed += 1
            continue

        try:
            title, markdown = extract_markdown(body, final, insurer)
        except Exception as exc:  # noqa: BLE001 - record parse failures
            print(f"[{index}/{len(seeds)}] PARSE ERROR {url}: {exc}", flush=True)
            failed += 1
            continue

        if len(markdown) < args.min_chars:
            print(
                f"[{index}/{len(seeds)}] thin page ({len(markdown)} chars), skip: {url}",
                flush=True,
            )
            skipped += 1
            continue

        digest = content_hash(markdown)
        if digest in seen_hashes and not args.force:
            print(f"[{index}/{len(seeds)}] duplicate content, skip: {url}", flush=True)
            skipped += 1
            continue

        slug = slug_from_url(final)
        out_dir = os.path.join(GUIDES_DIR, insurer_slug(insurer))
        os.makedirs(out_dir, exist_ok=True)
        html_path = os.path.join(out_dir, f"{slug}.html")
        json_path = os.path.join(out_dir, f"{slug}.json")
        with open(html_path, "w", encoding="utf-8") as handle:
            handle.write(body)

        record = {
            "insurer": insurer,
            "insurer_code": insurer.upper().replace(" ", "-"),
            "product": product,
            "category": category,
            "doc_type": "GUIDE",
            "url": url,
            "canonical_url": final,
            "title": title,
            "retrieved_at": "2026-10-25",
            "http_status": code,
            "text_length": len(markdown),
            "content_hash": digest,
            "markdown": markdown,
            "json_file": os.path.relpath(json_path, ROOT),
            "html_file": os.path.relpath(html_path, ROOT),
        }
        with open(json_path, "w", encoding="utf-8") as handle:
            json.dump(record, handle, indent=2, ensure_ascii=False)

        records.append(record)
        seen_urls.add(final)
        seen_hashes.add(digest)
        print(
            f"[{index}/{len(seeds)}] {code} {len(markdown):>6} chars -> {record['json_file']}",
            flush=True,
        )

        sleep_for = max(args.delay, crawl_delay)
        if sleep_for and index < len(seeds):
            time.sleep(sleep_for)

    write_manifest(records)
    unique_count = len({r.get("canonical_url") or r.get("url") for r in records})
    print(
        f"Done: {fetched} fetched, {skipped} skipped, {failed} failed, "
        f"{unique_count} records -> {os.path.relpath(MANIFEST_PATH, ROOT)}",
        flush=True,
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
