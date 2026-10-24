#!/usr/bin/env python3
"""Extract FAQ question/answer pairs from an HTML page."""

import json
import re

from bs4 import BeautifulSoup
from markdownify import markdownify as md

NOISE = ["script", "style", "noscript", "svg", "iframe", "form"]
NOISE_SELECTORS = [
    "body > header",
    "body > nav",
    "body > footer",
    "header.site-header",
    "header.global-header",
    "nav.navbar",
    ".site-header",
    ".global-header",
    ".site-footer",
    ".cookie",
    ".modal",
    ".breadcrumb",
]


def clean_soup(html):
    soup = BeautifulSoup(html, "html.parser")
    for sel in NOISE:
        for el in soup.select(sel):
            if el.name == "script" and el.get("type") == "application/ld+json":
                continue
            el.decompose()
    for sel in NOISE_SELECTORS:
        for el in soup.select(sel):
            el.decompose()
    return soup


def main_node(soup):
    for sel in [
        "main",
        "[role=main]",
        "#main",
        "#main-content",
        ".main-content",
        ".page-content",
        "article",
    ]:
        node = soup.select_one(sel)
        if node and len(node.get_text(" ", strip=True)) > 500:
            return node
    return soup.body or soup


def norm(t):
    return re.sub(r"\s+", " ", (t or "")).strip()


def is_question(t):
    t = norm(t)
    if len(t) < 8 or len(t) > 300:
        return False
    if t.endswith("?"):
        return True
    if len(t) < 20:
        return False
    return bool(
        re.match(
            r"^(how|what|when|where|why|who|can|do|does|is|are|will|should|"
            r"i |my |am i|if i|which|may|must|would|could)\b",
            t,
            re.I,
        )
    )


def is_junk_question(t):
    t = norm(t).lower()
    if t in {
        "questions?",
        "faqs",
        "faq",
        "search",
        "menu",
        "close",
        "back",
        "read more",
        "learn more",
        "contact us",
        "get a quote",
        "login",
        "home",
        "next",
        "previous",
        "submit",
        "send",
        "subscribe",
    }:
        return True
    return bool(
        re.match(
            r"^(my account|looking for|need help|want to|have a question|"
            r"get in touch|find out|learn more|read more|back to|skip to|"
            r"login|pay or renew|make or track|find my policy|contact)\b",
            t,
        )
    )


def answer_md(node):
    if node is None:
        return ""
    # Drop obvious UI leftovers.
    for sel in [
        "script",
        "style",
        "svg",
        "button",
        ".share",
        ".social",
        ".tags",
        ".tag",
        ".read-more",
        ".sr-only",
    ]:
        for el in node.select(sel):
            el.decompose()
    text = md(str(node), heading_style="ATX", bullets="-")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"^\s*[-*]\s*$", "", text, flags=re.M)
    return text.strip()


def find_answer(soup, el):
    # aria-controls / data-target / href
    for attr in (
        "aria-controls",
        "data-target",
        "data-bs-target",
        "data-toggle-target",
        "data-accordion-target",
        "href",
    ):
        val = el.get(attr)
        if not val:
            continue
        m = re.search(r"#([A-Za-z0-9_:.\-]+)", val)
        if m:
            node = soup.find(id=m.group(1))
            if node and node is not el:
                return node
    # sibling / parent's sibling walk
    node = el
    for _ in range(4):
        sib = node.find_next_sibling()
        while sib and sib.name in ("span", "i", "svg", "path"):
            sib = sib.find_next_sibling()
        if sib and len(sib.get_text(" ", strip=True)) > 10:
            return sib
        node = node.parent
        if node is None or node.name in ("body", "html"):
            break
    return None


def extract_jsonld(soup):
    out = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
        except Exception:
            continue
        stack = [data]
        while stack:
            x = stack.pop()
            if isinstance(x, dict):
                if x.get("@type") == "FAQPage":
                    for ent in x.get("mainEntity", []) or []:
                        q = norm(ent.get("name", ""))
                        ans = ent.get("acceptedAnswer", {})
                        if isinstance(ans, list):
                            ans = ans[0] if ans else {}
                        a = ans.get("text", "") if isinstance(ans, dict) else ""
                        if q and a:
                            node = BeautifulSoup(a, "html.parser")
                            a = answer_md(node)
                            if a:
                                out.append(("", q, a))
                stack.extend(x.values())
            elif isinstance(x, list):
                stack.extend(x)
    return out


def extract_accordions(soup, root):
    out = []
    seen = set()
    candidates = root.find_all(["button", "summary", "a"])
    for el in candidates:
        q = norm(el.get_text(" ", strip=True))
        if not is_question(q) or is_junk_question(q):
            continue
        cls = " ".join(el.get("class") or []) + " " + " ".join((el.parent.get("class") or []))
        if not re.search(r"accordion|faq|collapse|question|toggle|panel|expand|card", cls, re.I):
            # allow aria-expanded buttons anyway
            if el.get("aria-expanded") is None and el.name != "summary":
                continue
        if q.lower() in seen:
            continue
        ans = find_answer(soup, el)
        if not ans:
            continue
        a = answer_md(ans)
        if len(a) < 15:
            continue
        seen.add(q.lower())
        out.append((category_for(el), q, a))
    return out


def extract_headings(soup, root):
    out = []
    seen = set()
    headings = root.find_all(["h1", "h2", "h3", "h4", "h5"])
    for h in headings:
        q = norm(h.get_text(" ", strip=True))
        if not is_question(q) or is_junk_question(q):
            continue
        if q.lower() in seen:
            continue
        # collect following siblings until next heading
        parts = []
        for sib in h.next_siblings:
            if getattr(sib, "name", None) in ("h1", "h2", "h3", "h4", "h5"):
                break
            if getattr(sib, "name", None):
                parts.append(sib)
        if not parts:
            parent = h.parent
            sib = parent.find_next_sibling() if parent else None
            if sib and len(sib.get_text(" ", strip=True)) > 15:
                parts = [sib]
        a = "\n\n".join(answer_md(p) for p in parts).strip()
        if len(a) < 15:
            continue
        seen.add(q.lower())
        out.append(("", q, a))
    return out


def extract_dl(soup, root):
    out = []
    for dl in root.find_all("dl"):
        for dt in dl.find_all("dt"):
            q = norm(dt.get_text(" ", strip=True))
            dd = dt.find_next_sibling("dd")
            if is_question(q) and dd:
                a = answer_md(dd)
                if len(a) > 10:
                    out.append(("", q, a))
    return out


def category_for(el):
    prev = el.find_previous(["h1", "h2", "h3", "h4"])
    while prev is not None:
        t = norm(prev.get_text(" ", strip=True))
        if t and not is_question(t) and not is_junk_question(t) and len(t) < 120:
            return t
        prev = prev.find_previous(["h1", "h2", "h3", "h4"])
    return ""


def extract_page(html, url=""):
    soup = clean_soup(html)
    root = main_node(soup)
    pairs = []
    pairs.extend(extract_jsonld(soup))
    pairs.extend(extract_accordions(soup, root))
    pairs.extend(extract_headings(soup, root))
    pairs.extend(extract_dl(soup, root))
    # dedupe, keep first (JSON-LD first)
    seen = set()
    final = []
    for cat, q, a in pairs:
        k = re.sub(r"\W+", "", q.lower())[:120]
        if k in seen:
            continue
        seen.add(k)
        final.append({"category": cat, "question": q, "answer": a})
    # attach categories for heading questions
    for item in final:
        if item["category"]:
            continue
        # find the question heading in the DOM and its category
        for h in root.find_all(["h2", "h3", "h4", "h5"]):
            if norm(h.get_text(" ", strip=True)) == item["question"]:
                item["category"] = category_for(h)
                break
    return final


if __name__ == "__main__":
    import sys

    html = open(sys.argv[1], encoding="utf-8", errors="replace").read()
    pairs = extract_page(html, sys.argv[1])
    print("pairs", len(pairs))
    for p in pairs[:8]:
        print("---", p["category"], "|", p["question"])
        print(p["answer"][:300])
