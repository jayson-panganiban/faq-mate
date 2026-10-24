#!/usr/bin/env python3
"""Build a single normalised manifest for the whole archive."""

import csv
import os
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
OUT = os.path.join(ROOT, "all_manifest.csv")
FIELDS = ["insurer", "category", "product", "type", "title", "file", "bytes", "url"]
rows = []


def add(insurer, category, product, type_, title, file, size, url):
    path = file.replace("\\", "/")
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        # Some per-insurer manifests store paths relative to their own folder.
        alt = os.path.join(ROOT, f"{insurer} PDS", path)
        if os.path.exists(alt):
            path = os.path.relpath(alt, ROOT)
            full = alt
    if not os.path.exists(full):
        print("MISSING", insurer, path)
        return
    rows.append(
        {
            "insurer": insurer,
            "category": category,
            "product": product,
            "type": type_,
            "title": title,
            "file": path,
            "bytes": os.path.getsize(full),
            "url": url,
        }
    )


# Combined manifests (already normalised, root-relative paths)
for fname in (
    "suncorp_manifest.csv",
    "more_manifest.csv",
    "more2_manifest.csv",
    "travel_manifest.csv",
    "life_manifest.csv",
):
    for r in csv.DictReader(open(os.path.join(ROOT, fname))):
        add(
            r["insurer"],
            "",
            r["product"],
            r.get("type", "PDS"),
            r.get("title", ""),
            r["file"],
            r.get("bytes", 0),
            r.get("url", ""),
        )

# QBE
for r in csv.DictReader(open(os.path.join(ROOT, "QBE PDS", "manifest.csv"))):
    add(
        "QBE",
        "",
        r["Product"],
        r["Type"],
        r["Document"],
        os.path.join("QBE PDS", r["File"]),
        int(float(r["SizeKB"]) * 1024),
        r["URL"],
    )

# NRMA
for r in csv.DictReader(open(os.path.join(ROOT, "NRMA PDS", "manifest.csv"))):
    add(
        "NRMA",
        "",
        r["Product"],
        r["Type"],
        r["Document"],
        os.path.join("NRMA PDS", r["File"]),
        int(float(r["SizeKB"]) * 1024),
        r["URL"],
    )

# Allianz
for r in csv.DictReader(open(os.path.join(ROOT, "Allianz PDS", "manifest.csv"))):
    add(
        "Allianz",
        r.get("Tab", ""),
        r.get("Section") or r.get("Tab", ""),
        r["Type"],
        r["Document"],
        os.path.join("Allianz PDS", r["File"]),
        int(float(r["SizeKB"]) * 1024),
        r["URL"],
    )

# Suncorp (own products)
for r in csv.DictReader(open(os.path.join(ROOT, "Suncorp PDS", "manifest.csv"))):
    add(
        "Suncorp",
        r["Section"],
        r["Subsection"],
        r["Type"],
        r["Document"],
        os.path.join("Suncorp PDS", r["File"]),
        int(float(r["SizeKB"]) * 1024),
        r["URL"],
    )

# De-duplicate by (insurer, url) then by (insurer, file)
seen_file, final = set(), []
for r in rows:
    fkey = (r["insurer"], r["file"].lower())
    if fkey in seen_file:
        continue
    seen_file.add(fkey)
    final.append(r)


def norm_type(t, title, file):
    blob = (str(t or "") + " " + str(title or "") + " " + str(file or "")).lower()
    if "spds" in blob or "supplementary" in blob:
        return "SPDS"
    if "pds equivalent" in blob:
        return "PDS (PDS-equivalent wording)"
    if "policy wording" in blob and "pds" not in blob and "product disclosure" not in blob:
        return "PDS (PDS-equivalent wording)"
    return "PDS"


for r in final:
    r["type"] = norm_type(r["type"], r["title"], r["file"])

final.sort(key=lambda r: (r["insurer"], r["category"], r["product"], r["file"]))
with open(OUT, "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=FIELDS)
    w.writeheader()
    w.writerows(final)

print("rows", len(final))
print("insurers", len(set(r["insurer"] for r in final)))
print("bytes", sum(int(r["bytes"]) for r in final) / 1048576, "MB")
for ins, n in Counter(r["insurer"] for r in final).most_common():
    print(f"{ins:34} {n:4}")
