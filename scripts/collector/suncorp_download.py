#!/usr/bin/env python3
"""Download PDS/SPDS PDFs for the Suncorp-owned brands (AAMI, GIO, APIA, Shannons, Bingle)."""

import csv
import json
import os
import re
import subprocess
import sys

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
MANIFEST = os.path.join(ROOT, "suncorp_manifest.csv")


def safe(name, maxlen=150):
    name = re.sub(r"[\\/:*?\"<>|]", "-", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name[:maxlen]


def valid_pdf(path):
    try:
        with open(path, "rb") as fh:
            return fh.read(4) == b"%PDF" and os.path.getsize(path) > 1000
    except OSError:
        return False


def download(url, dest, referer):
    tmp = dest + ".part"
    cmd = [
        "curl",
        "-sSL",
        "--fail",
        "--compressed",
        "--retry",
        "3",
        "--retry-delay",
        "2",
        "--connect-timeout",
        "30",
        "--max-time",
        "240",
        "-A",
        UA,
        "-e",
        referer,
        "-o",
        tmp,
        url,
    ]
    try:
        subprocess.run(cmd, check=True, timeout=300)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        return False
    if not valid_pdf(tmp):
        os.remove(tmp)
        return False
    os.replace(tmp, dest)
    return True


def main():
    links = json.load(open(os.path.join(ROOT, "suncorp_links.json")))
    done = {}
    if os.path.exists(MANIFEST):
        for r in csv.DictReader(open(MANIFEST)):
            if valid_pdf(os.path.join(ROOT, r["file"])):
                done[r["url"]] = r

    rows = []
    failures = []
    assigned = {r["file"]: r["url"] for r in done.values()}
    for i, item in enumerate(links, 1):
        insurer, product = item["insurer"], item["product"]
        url = item["url"]
        if url in done:
            rows.append(done[url])
            print(f"[{i}/{len(links)}] SKIP {done[url]['file']}")
            continue
        folder = os.path.join(ROOT, f"{insurer} PDS", safe(product))
        os.makedirs(folder, exist_ok=True)
        stem = safe(re.sub(r"\.pdf$", "", url.split("?")[0].rsplit("/", 1)[-1], flags=re.I))
        dest = os.path.join(folder, stem + ".pdf")
        n = 2
        while (
            os.path.relpath(dest, ROOT) in assigned and assigned[os.path.relpath(dest, ROOT)] != url
        ):
            dest = os.path.join(folder, f"{stem}-{n}.pdf")
            n += 1
        assigned[os.path.relpath(dest, ROOT)] = url
        ref = f"https://www.{insurer.lower()}.com.au/policy-documents"
        ok = download(url, dest, ref)
        if ok:
            size = os.path.getsize(dest)
            row = {
                "insurer": insurer,
                "product": product,
                "title": item["title"],
                "file": os.path.relpath(dest, ROOT),
                "bytes": size,
                "url": url,
            }
            rows.append(row)
            print(
                f"[{i}/{len(links)}] OK   {size/1024:8.0f} KB  {insurer}/{product}/{os.path.basename(dest)}"
            )
        else:
            failures.append(item)
            print(f"[{i}/{len(links)}] FAIL {insurer}/{product}/{os.path.basename(dest)}  {url}")
    with open(MANIFEST, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["insurer", "product", "title", "file", "bytes", "url"])
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (r["insurer"], r["product"], r["file"])))
    print(f"\nDownloaded {len(rows)} files, {len(failures)} failures.")
    if failures:
        json.dump(failures, open(os.path.join(ROOT, "suncorp_failures.json"), "w"), indent=2)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
