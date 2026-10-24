#!/usr/bin/env python3
"""Shared manifest loading and formatting utilities for collector README generators."""

import csv
import os
import re
from collections import defaultdict
from typing import Any

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")


def load_manifest(manifest_filename: str) -> list[dict[str, str]]:
    """Loads a CSV manifest from data/raw/ and returns rows as dictionaries."""
    filepath = os.path.join(ROOT, manifest_filename)
    with open(filepath, "r", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def group_manifest_by_insurer(
    rows: list[dict[str, str]],
) -> dict[str, list[dict[str, str]]]:
    """Groups manifest rows by their insurer field."""
    by_insurer: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_insurer[row["insurer"]].append(row)
    return dict(by_insurer)


def classify_doc_kind(row: dict[str, Any]) -> str:
    """Classifies whether a manifest row is a Supplementary PDS (SPDS) or standard PDS."""
    text = (row.get("title", "") + " " + row.get("file", "")).lower()
    if "supplementary" in text or re.search(r"\bspds\b", text):
        return "SPDS"
    return "PDS"


def format_megabytes(byte_count: int | float) -> str:
    """Formats byte counts into a human-readable megabyte string."""
    return f"{byte_count / 1048576:.1f} MB"


def write_insurer_archive_bundle(
    insurer: str,
    source_url: str,
    rows: list[dict[str, str]],
    scope_notes: str,
    rerun_script_name: str,
    excluded_types: str | None = None,
) -> None:
    """Writes standard README.md and manifest.csv for an insurer's PDS archive."""
    total_bytes = sum(int(r["bytes"]) for r in rows)
    by_product: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in rows:
        by_product[r["product"]].append(r)

    pds = sum(1 for r in rows if classify_doc_kind(r) == "PDS")
    spds = len(rows) - pds

    excluded_desc = excluded_types or (
        "Excluded: Target Market Determinations (TMD), Premium Excess and Discount Guides "
        "(PED), Key Fact Sheets (KFS), Financial Services Guides (FSG), Additional "
        "Information Guides (AIG), PDS update notices, forms and brochures."
    )

    lines = [
        f"# {insurer} — PDS / SPDS archive",
        "",
        f"Product Disclosure Statements (PDS) and Supplementary PDS (SPDS) published by {insurer}.",
        "",
        f"- **Source page:** <{source_url}>",
        f"- **Downloaded:** {len(rows)} unique PDFs, ~{format_megabytes(total_bytes)}, all verified with `pdfinfo` (no corrupt or zero-page files).",
        "- **Manifest:** [`manifest.csv`](manifest.csv) — product, type, title, file, size and source URL.",
        "",
        "## Contents",
        "",
        "| Folder | Files | PDS | SPDS | Size |",
        "|---|---:|---:|---:|---:|",
    ]

    for product, product_rows in sorted(by_product.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        p = sum(1 for r in product_rows if classify_doc_kind(r) == "PDS")
        s = len(product_rows) - p
        lines.append(
            f"| {product} | {len(product_rows)} | {p} | {s} | {format_megabytes(sum(int(r['bytes']) for r in product_rows))} |"
        )

    lines += [
        f"| **Total** | **{len(rows)}** | **{pds}** | **{spds}** | **{format_megabytes(total_bytes)}** |",
        "",
        "## Scope",
        "",
        "Included: every document explicitly labelled **PDS**, **SPDS**, **Supplementary Product Disclosure Statement**, or **Combined PDS and FSG** on the product policy-document pages, including superseded editions still linked by the site.",
        "",
        excluded_desc,
    ]

    if scope_notes and scope_notes.strip():
        lines += ["", "## Scope notes", "", scope_notes.strip()]

    lines += [
        "",
        "## Re-running",
        "",
        "```bash",
        'cd "Default Project"',
        f"python3 {rerun_script_name}",
        "```",
        "",
        f"`{rerun_script_name}` reads links and downloads each PDF with a browser user-agent and referer, validates the `%PDF` header, retries three times, and rewrites the manifest. Existing valid files are kept (cached).",
        "",
    ]

    folder = os.path.join(ROOT, f"{insurer} PDS")
    os.makedirs(folder, exist_ok=True)
    readme_path = os.path.join(folder, "README.md")
    with open(readme_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    manifest_path = os.path.join(folder, "manifest.csv")
    with open(manifest_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["product", "type", "title", "file", "bytes", "url"])
        for r in sorted(rows, key=lambda r: (r["product"], r["file"])):
            writer.writerow(
                [
                    r["product"],
                    classify_doc_kind(r),
                    r["title"],
                    os.path.relpath(os.path.join(ROOT, r["file"]), folder),
                    r["bytes"],
                    r["url"],
                ]
            )
    print("wrote", readme_path, "and", manifest_path)
