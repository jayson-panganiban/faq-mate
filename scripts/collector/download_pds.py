#!/usr/bin/env python3
"""Download PDS (and optionally SPDS) PDFs listed on Suncorp's Policy Documents page."""

import csv
import html
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
BASE = "https://www.suncorp.com.au"
SRC = "https://www.suncorp.com.au/insurance/policy-documents.html"
OUT = os.path.join(ROOT, "Suncorp PDS")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.section = "General"
        self.sub = None
        self.status = ""
        self.in_h2 = False
        self.h2 = []
        self.cap = None
        self.subbuf = []
        self.cur = None
        self.linkbuf = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h2":
            self.in_h2, self.h2 = True, []
        if tag == "button" and "sg-Accordion-label" in (a.get("class") or ""):
            self.cap, self.subbuf = "button", []
        if tag == "a":
            self.cur, self.linkbuf = a.get("href") or "", []

    def handle_endtag(self, tag):
        if tag == "h2" and self.in_h2:
            self.section = clean("".join(self.h2))
            self.sub, self.in_h2 = None, False
        if tag == "button" and self.cap == "button":
            self.sub, self.cap = clean("".join(self.subbuf)), None
        if tag == "a" and self.cur is not None:
            href = self.cur
            text = clean("".join(self.linkbuf))
            if href.lower().split("?")[0].endswith(".pdf"):
                self.items.append((self.section, self.sub, self.status, text, html.unescape(href)))
            self.cur = None

    def handle_data(self, data):
        if self.in_h2:
            self.h2.append(data)
        if self.cap == "button":
            self.subbuf.append(data)
        if self.cur is not None:
            self.linkbuf.append(data)
        t = data.strip()
        if t in ("Current documents", "Past documents"):
            self.status = t.split()[0]


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def classify(text):
    """Return 'PDS', 'SPDS', or None for a link title."""
    t = text.lower()
    if "update" in t or "tmd" in t or "target market" in t:
        return None
    if "supplementary" in t or re.search(r"\bspds\b", t):
        return "SPDS"
    if "product disclosure statement" in t or re.search(r"\bpds\b", t):
        return "PDS"
    return None


def slug(s):
    s = re.sub(r"[^\w\s&-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:80]


def fetch(url):
    res = subprocess.run(
        [
            "curl",
            "-sSL",
            "--fail",
            "--max-time",
            "120",
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


def main(include_spds=False):
    res = subprocess.run(["curl", "-sSL", "--fail", "-A", UA, SRC], capture_output=True)
    if res.returncode != 0:
        sys.exit("Could not load page: " + res.stderr.decode("utf-8", "replace"))
    page = res.stdout.decode("utf-8", "replace")

    p = Parser()
    p.feed(page)
    wanted = {"PDS", "SPDS"} if include_spds else {"PDS"}
    docs = [x for x in p.items if classify(x[3]) in wanted]
    print(
        f"{len(docs)} links selected ({', '.join(sorted(wanted))}); "
        f"{len({x[4] for x in docs})} unique files"
    )

    jobs, used = [], {}
    for section, sub, status, text, href in docs:
        folder = os.path.join(OUT, slug(section or "General"), slug(sub) if sub else "")
        name = os.path.basename(href.split("?")[0])
        key = os.path.join(folder, name).lower()
        if key in used:
            name = f"{slug(text)} - {name}"
            key = os.path.join(folder, name).lower()
        n = 2
        while key in used:
            name = f"{slug(text)} ({n}) - {os.path.basename(href.split('?')[0])}"
            key = os.path.join(folder, name).lower()
            n += 1
        used[key] = True
        jobs.append((section, sub or "", status, classify(text), text, folder, name, href))

    # One download per URL, then a copy in every product folder that links to it.
    by_url = {}
    for job in jobs:
        by_url.setdefault(job[7], []).append(job)

    ok = bad = 0
    failures, rows = [], []

    def one(href, group):
        url = href if href.startswith("http") else BASE + href
        primary = os.path.join(group[0][5], group[0][6])
        if not (os.path.exists(primary) and os.path.getsize(primary) > 1000):
            os.makedirs(group[0][5], exist_ok=True)
            for attempt in range(3):
                try:
                    data, ctype = fetch(url)
                    if not data.startswith(b"%PDF") and "pdf" not in ctype.lower():
                        raise ValueError(f"not a PDF (content-type {ctype!r}, {len(data)} bytes)")
                    with open(primary, "wb") as f:
                        f.write(data)
                    break
                except Exception as e:  # noqa: BLE001
                    err = e
            else:
                return [(False, primary, str(err), group[0])]
        for job in group[1:]:
            dest = os.path.join(job[5], job[6])
            if not (os.path.exists(dest) and os.path.getsize(dest) > 1000):
                os.makedirs(job[5], exist_ok=True)
                shutil.copy2(primary, dest)
        return [(True, os.path.join(j[5], j[6]), "", j) for j in group]

    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = [ex.submit(one, href, group) for href, group in by_url.items()]
        for fut in futures:
            for good, dest, msg, job in fut.result():
                section, sub, status, kind, text, folder, name, href = job
                if good:
                    ok += 1
                    rows.append(
                        [
                            section,
                            sub,
                            status,
                            kind,
                            text,
                            os.path.relpath(dest, OUT),
                            round(os.path.getsize(dest) / 1024),
                            BASE + href,
                        ]
                    )
                else:
                    bad += 1
                    failures.append((dest, msg))
                    print("FAILED:", dest, "|", msg)

    rows.sort(key=lambda r: (r[0], r[1], r[3], r[2], r[4]))
    with open(os.path.join(OUT, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Section", "Subsection", "Status", "Type", "Document", "File", "SizeKB", "URL"])
        w.writerows(rows)

    print(f"\nDone: {ok} downloaded/cached, {bad} failed")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main(include_spds="--spds" in sys.argv)
