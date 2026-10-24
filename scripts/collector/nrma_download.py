#!/usr/bin/env python3
"""Download NRMA Insurance PDS/SPDS PDFs from the policy booklets page."""

import csv
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
SRC = "https://www.nrma.com.au/policy-booklets"
LINKS = os.path.join(ROOT, "nrma_links.json")
OUT = os.path.join(ROOT, "NRMA PDS")
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
    print(f"{len(docs)} documents; {len({d['url'] for d in docs})} unique URLs")

    jobs, used = [], set()
    for d in docs:
        folder = os.path.join(OUT, slug(d["product"]))
        base = slug(d["title"])
        dest = os.path.join(folder, base + ".pdf")
        n = 2
        while dest.lower() in used:
            dest = os.path.join(folder, f"{base} ({n}).pdf")
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
                        d["title"],
                        d.get("note", ""),
                        os.path.relpath(dest, OUT),
                        round(os.path.getsize(dest) / 1024),
                        d["url"],
                    ]
                )
            else:
                bad += 1
                failures.append((dest, msg))
                print("FAILED:", dest, "|", msg)

    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    with open(os.path.join(OUT, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Product", "Type", "Document", "Note", "File", "SizeKB", "URL"])
        w.writerows(rows)

    print(f"\nDone: {ok} downloaded/cached, {bad} failed")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
