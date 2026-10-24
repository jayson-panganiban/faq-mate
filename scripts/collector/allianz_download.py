#!/usr/bin/env python3
"""Download Allianz PDS/SPDS PDFs listed on the policy documents page."""

import csv
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
SRC = "https://www.allianz.com.au/my-allianz/policy-information/policy-documents.html"
LINKS = os.path.join(ROOT, "allianz_links.json")
OUT = os.path.join(ROOT, "Allianz PDS")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

GENERIC = {
    "Business Insurance",
    "Life Insurance",
    "Caravan and Trailer Insurance",
}


def slug(s):
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
    print(f"{len(docs)} documents; {len({d[3] for d in docs})} unique URLs")

    jobs, used = [], set()
    for tab, section, title, url, kind in docs:
        folder = os.path.join(OUT, slug(tab))
        if section and section != tab and section not in GENERIC:
            folder = os.path.join(folder, slug(section))
        name = slug(title) + ".pdf"
        dest = os.path.join(folder, name)
        n = 2
        while dest.lower() in used:
            dest = os.path.join(folder, f"{slug(title)} ({n}).pdf")
            n += 1
        used.add(dest.lower())
        jobs.append((tab, section, kind, title, url, dest))

    ok = bad = 0
    failures, rows = [], []

    def one(job):
        tab, section, kind, title, url, dest = job
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            return (True, dest, "cached")
        err = None
        for _ in range(3):
            try:
                data, ctype = fetch(url)
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
            tab, section, kind, title, url, _ = job
            if good:
                ok += 1
                rows.append(
                    [
                        tab,
                        section,
                        kind,
                        title,
                        os.path.relpath(dest, OUT),
                        round(os.path.getsize(dest) / 1024),
                        url,
                    ]
                )
            else:
                bad += 1
                failures.append((dest, msg))
                print("FAILED:", dest, "|", msg)

    rows.sort(key=lambda r: (r[0], r[1], r[2], r[3]))
    with open(os.path.join(OUT, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Tab", "Section", "Type", "Document", "File", "SizeKB", "URL"])
        w.writerows(rows)

    print(f"\nDone: {ok} downloaded/cached, {bad} failed")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
