#!/usr/bin/env python3
"""Crawl simple server-rendered FAQ pages with site-specific selectors."""

import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

from bs4 import BeautifulSoup
from markdownify import markdownify

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
SITEMAPS = os.path.join(JSONDIR, "faq_sitemaps.json")
OUTDIR = os.path.join(ROOT, "faq_json")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def fetch(url, timeout=30):
    p = subprocess.run(
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
    body, _, meta = p.stdout.rpartition("\n__META__")
    code = meta.split()[0] if meta else "0"
    final = meta.split(" ", 1)[1].strip() if " " in meta else url
    return code, final, body


def md(node):
    if not node:
        return ""
    text = markdownify(str(node), heading_style="ATX", bullets="-")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_insureandgo(html, url):
    soup = BeautifulSoup(html, "html.parser")
    q_el = soup.select_one(".faqs_detail .top_row .title")
    a_el = soup.select_one(".faqs_detail article.answer")
    if not q_el or not a_el:
        return []
    q = re.sub(r"\s+", " ", q_el.get_text(" ", strip=True)).strip()
    a = md(a_el)
    if not q or len(a) < 10:
        return []
    return [{"category": "Travel Insurance FAQs", "question": q, "answer": a}]


def extract_go(html, url):
    soup = BeautifulSoup(html, "html.parser")
    q_el = soup.select_one("h1.entry-title") or soup.find("h1")
    a_el = soup.select_one(".entry-content")
    if not q_el or not a_el:
        return []
    q = re.sub(r"\s+", " ", q_el.get_text(" ", strip=True)).strip()
    a = md(a_el)
    if not q or len(a) < 10:
        return []
    # category from article class
    art = soup.select_one("article")
    cat = "Travel Insurance FAQs"
    if art:
        for c in art.get("class", []):
            if c.startswith("wpb_af_faq_category-"):
                cat = c.replace("wpb_af_faq_category-", "").replace("-", " ").title()
    return [{"category": cat, "question": q, "answer": a}]


EXTRACTORS = {
    "InsureandGo": extract_insureandgo,
    "Go Insurance": extract_go,
}


def main():
    insurer = sys.argv[1]
    fn = EXTRACTORS[insurer]
    data = json.load(open(SITEMAPS))
    urls = data.get(insurer, [])
    urls = [re.sub(r"^https://https://", "https://", u) for u in urls]
    urls = [u for u in urls if "/faq" in u]
    # dedupe
    urls = list(dict.fromkeys(urls))
    print(f"{insurer}: {len(urls)} urls", flush=True)

    pairs = {}
    pages = []

    def work(u):
        try:
            code, final, body = fetch(u)
            if code != "200" or len(body) < 1000:
                return {"url": u, "final": final, "status": code, "pairs": []}
            return {"url": u, "final": final, "status": "200", "pairs": fn(body, final)}
        except Exception as e:
            return {"url": u, "final": u, "status": "ERR:" + str(e)[:80], "pairs": []}

    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(work, u) for u in urls]
        for i, f in enumerate(as_completed(futs), 1):
            r = f.result()
            pages.append(r)
            for p in r["pairs"]:
                k = re.sub(r"\W+", "", p["question"].lower())[:140]
                if k and k not in pairs:
                    pairs[k] = p
            if i % 20 == 0:
                print(f"  {i}/{len(urls)} pages, {len(pairs)} pairs", flush=True)

    out = {
        "insurer": insurer,
        "source": urls[0] if urls else "",
        "pages": pages,
        "pairs": list(pairs.values()),
    }
    path = os.path.join(OUTDIR, insurer.replace(" ", "_") + ".json")
    json.dump(out, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"{insurer}: {len(pairs)} pairs -> {path}", flush=True)


if __name__ == "__main__":
    main()
