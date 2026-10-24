#!/usr/bin/env python3
"""Crawl FAQ pages for an insurer and save extracted Q&A pairs as JSON."""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from urllib.parse import urlparse

from extract_faqs import extract_page

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
SITEMAPS = os.path.join(JSONDIR, "faq_sitemaps.json")
OUTDIR = os.path.join(ROOT, "faq_json")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def fetch(url, timeout=30):
    try:
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
    except Exception:
        return "ERR", url, ""


def load_urls(insurer, regex=None):
    data = json.load(open(SITEMAPS))
    urls = data.get(insurer, [])
    urls = [re.sub(r"^https://https://", "https://", u) for u in urls]
    if regex:
        urls = [u for u in urls if re.search(regex, u)]
    # dedupe, keep order
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def category_from_url(url):
    path = urlparse(url).path.strip("/")
    parts = [p for p in path.split("/") if p]
    for key in ("faqs", "faq"):
        if key in parts:
            i = parts.index(key)
            if i + 1 < len(parts):
                seg = parts[i + 1]
                if seg.endswith(".html"):
                    seg = seg[:-5]
                return seg.replace("-", " ").replace("_", " ").title()
    if "help-and-support" in parts:
        seg = parts[-1].replace(".html", "")
        return seg.replace("-", " ").title()
    if "help-centre" in parts:
        seg = parts[-1].replace(".html", "")
        return seg.replace("-", " ").title()
    if "insurance" in parts:
        return "Insurance"
    return ""


def crawl(insurer, urls, workers=12, limit=None, timeout=30):
    if limit:
        urls = urls[:limit]
    results = []
    pairs = []
    seen_q = {}

    def work(u):
        code, final, body = fetch(u, timeout)
        if code != "200" or len(body) < 500:
            return {"url": u, "final": final, "status": code, "pairs": []}
        try:
            ps = extract_page(body, final)
        except Exception as e:
            return {
                "url": u,
                "final": final,
                "status": "parse-error:" + str(e)[:80],
                "pairs": [],
            }
        return {"url": u, "final": final, "status": "200", "pairs": ps}

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(work, u): u for u in urls}
        for i, f in enumerate(concurrent.futures.as_completed(futs), 1):
            r = f.result()
            results.append(r)
            for p in r["pairs"]:
                if not p.get("category"):
                    p["category"] = category_from_url(r.get("final") or r.get("url", ""))
                q = p["question"]
                k = re.sub(r"\W+", "", q.lower())[:140]
                if not k:
                    continue
                if k in seen_q:
                    # keep the longer answer
                    if len(p["answer"]) > len(seen_q[k]["answer"]):
                        seen_q[k]["answer"] = p["answer"]
                    continue
                seen_q[k] = p
            if i % 50 == 0:
                print(
                    f"  {insurer}: {i}/{len(urls)} pages, {len(seen_q)} pairs",
                    flush=True,
                )

    pairs = list(seen_q.values())
    out = {
        "insurer": insurer,
        "source": urls[0] if urls else "",
        "pages": results,
        "pairs": pairs,
    }
    os.makedirs(OUTDIR, exist_ok=True)
    path = os.path.join(OUTDIR, insurer.replace(" ", "_").replace("/", "_") + ".json")
    json.dump(out, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"{insurer}: {len(urls)} pages -> {len(pairs)} pairs -> {path}", flush=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("insurer")
    ap.add_argument("--regex", default=None, help="filter sitemap URLs")
    ap.add_argument("--url", action="append", default=[], help="extra URL")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--timeout", type=int, default=30)
    args = ap.parse_args()
    urls = load_urls(args.insurer, args.regex) + args.url
    if not urls:
        print("no urls")
        return
    crawl(args.insurer, urls, workers=args.workers, limit=args.limit, timeout=args.timeout)


if __name__ == "__main__":
    main()
