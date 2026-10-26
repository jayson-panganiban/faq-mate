#!/usr/bin/env python3
"""Ingest guide pages captured with the desktop browser.

Two insurers (QBE and NobleOak) reject non-browser clients: QBE sits behind a
Cloudflare JS challenge and NobleOak behind Akamai, so `crawl_guides.py` gets a
403 for every URL. The pages themselves are public and robots.txt permits them,
so they are captured once in a real browser and handed to the same extraction
path here.

Input is a CSV manifest of captures:

    insurer,url,final_url,product,category,html_file

`html_file` points at the captured HTML (usually a transfer staging directory).
This script runs `extract_markdown` from `crawl_guides.py`, so the resulting
JSON/HTML records and manifest rows are identical to a normal crawl.
"""

import argparse
import csv
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from crawl_guides import (  # noqa: E402
    GUIDES_DIR,
    ROOT,
    content_hash,
    extract_markdown,
    insurer_slug,
    load_existing,
    slug_from_url,
    write_manifest,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", help="CSV of browser captures")
    parser.add_argument("--min-chars", type=int, default=500)
    args = parser.parse_args()

    with open(args.manifest, newline="", encoding="utf-8") as handle:
        captures = list(csv.DictReader(handle))

    records, seen_urls, seen_hashes = load_existing()
    written = 0
    skipped = 0
    failed = 0

    for index, capture in enumerate(captures, 1):
        url = capture["url"].strip()
        final = (capture.get("final_url") or url).strip()
        insurer = capture["insurer"].strip()
        product = capture["product"].strip()
        category = capture["category"].strip()
        html_file = capture["html_file"].strip()

        label = f"[{index}/{len(captures)}]"
        if not os.path.isfile(html_file):
            print(f"{label} MISSING html: {html_file}", flush=True)
            failed += 1
            continue

        with open(html_file, encoding="utf-8", errors="replace") as handle:
            body = handle.read()

        try:
            title, markdown = extract_markdown(body, final, insurer)
        except Exception as exc:  # noqa: BLE001 - record parse failures
            print(f"{label} PARSE ERROR {url}: {exc}", flush=True)
            failed += 1
            continue

        if len(markdown) < args.min_chars:
            print(f"{label} thin page ({len(markdown)} chars), skip: {url}", flush=True)
            skipped += 1
            continue

        digest = content_hash(markdown)
        if digest in seen_hashes:
            print(f"{label} duplicate content, skip: {url}", flush=True)
            skipped += 1
            continue

        slug = slug_from_url(final)
        out_dir = os.path.join(GUIDES_DIR, insurer_slug(insurer))
        os.makedirs(out_dir, exist_ok=True)
        html_path = os.path.join(out_dir, f"{slug}.html")
        json_path = os.path.join(out_dir, f"{slug}.json")
        shutil.copyfile(html_file, html_path)

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
            "http_status": "200",
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
        written += 1
        print(f"{label} {len(markdown):>6} chars -> {record['json_file']}", flush=True)

    write_manifest(records)
    print(f"\nwritten {written}, skipped {skipped}, failed {failed}", flush=True)


if __name__ == "__main__":
    main()
