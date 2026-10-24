#!/usr/bin/env python3
"""Download QBE Australia PDS/SPDS PDFs (direct products + broker document library)."""

import csv
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
SRC = "https://www.qbe.com/au/policy-documents"
LINKS = os.path.join(ROOT, "qbe_links.json")
OUT = os.path.join(ROOT, "QBE PDS")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

TRANSLATE = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u00a0": " ",
    }
)


def slug(s):
    s = s.translate(TRANSLATE)
    s = s.replace("/", "-").replace(":", " -")
    s = re.sub(r"[^\w\s&()',.\-]", "", s)
    s = re.sub(r"\s+", " ", s).strip(" .")
    if len(s) > 150:
        s = s[:150].rsplit(" ", 1)[0].rstrip(" .")
    return s


def rev_id(url):
    m = re.search(r"revision=([0-9A-Fa-f-]+)", url)
    if m:
        return m.group(1).split("-")[0].upper()
    m = re.search(r"/([^/?]+)\.pdf", url, re.I)
    return m.group(1)[-12:].upper() if m else ""


def pretty_date(d):
    if not d or len(d) < 8:
        return ""
    return f"{d[0:4]}-{d[4:6]}-{d[6:8]}"


def fetch(url):
    res = subprocess.run(
        [
            "curl",
            "-sSL",
            "--fail",
            "--max-time",
            "180",
            "-A",
            UA,
            "-e",
            SRC,
            "-w",
            "\n__CT__%{content_type}",
            url,
        ],
        capture_output=True,
    )
    if res.returncode != 0:
        raise RuntimeError(
            res.stderr.decode("utf-8", "replace").strip() or f"curl exit {res.returncode}"
        )
    data, _, ctype = res.stdout.rpartition(b"\n__CT__")
    return data, ctype.decode("utf-8", "replace")


def main():
    docs = json.load(open(LINKS, encoding="utf-8"))

    seen_urls, unique = set(), []
    for d in docs:
        key = (rev_id(d["url"]) or d["url"]).upper()
        if key in seen_urls:
            continue
        seen_urls.add(key)
        unique.append(d)
    print(f"{len(unique)} unique documents from {len(docs)} entries")

    jobs, used = [], set()
    for d in unique:
        folder = os.path.join(OUT, slug(d["product"] or "Other"))
        base = slug(d["title"])
        date = pretty_date(d.get("date", ""))
        if date:
            base += f" ({date[:7]})"
        dest = os.path.join(folder, base + ".pdf")
        if dest.lower() in used:
            dest = os.path.join(folder, f"{base} [{rev_id(d['url'])}].pdf")
        n = 2
        while dest.lower() in used:
            dest = os.path.join(folder, f"{base} [{rev_id(d['url'])}] ({n}).pdf")
            n += 1
        used.add(dest.lower())
        jobs.append((d, dest))

    ok = bad = 0
    failures, rows = [], []

    def one(job):
        d, dest = job
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            return (True, dest, "cached")
        err = None
        for _ in range(3):
            try:
                data, ctype = fetch(d["url"])
                if not data.startswith(b"%PDF") and "pdf" not in ctype.lower():
                    raise ValueError(f"not a PDF (content-type {ctype!r}, {len(data)} bytes)")
                with open(dest, "wb") as f:
                    f.write(data)
                return (True, dest, f"{len(data)//1024} KB")
            except Exception as e:  # noqa: BLE001
                err = e
        return (False, dest, str(err))

    with ThreadPoolExecutor(max_workers=5) as ex:
        for job, (good, dest, msg) in zip(jobs, ex.map(one, jobs)):
            d, _ = job
            if good:
                ok += 1
                rows.append(
                    [
                        d["product"],
                        d["type"],
                        d.get("code", ""),
                        d["title"],
                        pretty_date(d.get("date", "")),
                        os.path.relpath(dest, OUT),
                        round(os.path.getsize(dest) / 1024),
                        d["source"],
                        d["url"],
                    ]
                )
            else:
                bad += 1
                failures.append((dest, msg))
                print("FAILED:", dest, "|", msg)

    rows.sort(key=lambda r: (r[0], r[1], r[3]))
    with open(os.path.join(OUT, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            ["Product", "Type", "Code", "Document", "Effective", "File", "SizeKB", "Source", "URL"]
        )
        w.writerows(rows)

    print(f"\nDone: {ok} downloaded/cached, {bad} failed")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
