#!/usr/bin/env python3
"""Write the root README and a per-insurer summary CSV."""

import csv
import os
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
ROWS = list(csv.DictReader(open(os.path.join(ROOT, "all_manifest.csv"))))

CATEGORY = {
    "Suncorp": "Suncorp Group",
    "AAMI": "Suncorp Group",
    "GIO": "Suncorp Group",
    "APIA": "Suncorp Group",
    "Shannons": "Suncorp Group",
    "Bingle": "Suncorp Group",
    "QBE": "Major insurers",
    "NRMA": "Major insurers",
    "Allianz": "Major insurers",
    "Vero": "Major insurers",
    "Youi": "Challengers & auto clubs",
    "Budget Direct": "Challengers & auto clubs",
    "RACV": "Challengers & auto clubs",
    "RACQ": "Challengers & auto clubs",
    "RAC WA": "Challengers & auto clubs",
    "RAA": "Challengers & auto clubs",
    "RACT": "Challengers & auto clubs",
    "CGU": "Challengers & auto clubs",
    "TIO": "Challengers & auto clubs",
    "Cover-More": "Travel specialists",
    "Fast Cover": "Travel specialists",
    "InsureandGo": "Travel specialists",
    "1Cover": "Travel specialists",
    "Travel Insurance Direct": "Travel specialists",
    "Southern Cross Travel Insurance": "Travel specialists",
    "Zoom": "Travel specialists",
    "Go Insurance": "Travel specialists",
    "TAL": "Life insurers",
    "Asteron Life": "Life insurers",
    "NEOS": "Life insurers",
    "PPS Mutual": "Life insurers",
    "AIA": "Life insurers",
    "ClearView": "Life insurers",
    "Zurich": "Life insurers",
    "Acenda": "Life insurers",
    "MetLife": "Life insurers",
    "Challenger": "Life insurers",
    "NobleOak": "Life insurers",
    "HCF Life": "Life insurers",
}

ORDER = [
    "Suncorp Group",
    "Major insurers",
    "Challengers & auto clubs",
    "Travel specialists",
    "Life insurers",
]


def human(n):
    return f"{n/1048576:.1f} MB"


by_ins = defaultdict(list)
for r in ROWS:
    by_ins[r["insurer"]].append(r)

summary = []
for ins, rs in by_ins.items():
    pds = sum(1 for r in rs if r["type"] == "PDS")
    spds = sum(1 for r in rs if r["type"] == "SPDS")
    eq = sum(1 for r in rs if r["type"].startswith("PDS ("))
    summary.append(
        {
            "insurer": ins,
            "category": CATEGORY.get(ins, "Other"),
            "files": len(rs),
            "pds": pds,
            "spds": spds,
            "pds_equivalent": eq,
            "bytes": sum(int(r["bytes"]) for r in rs),
            "products": len(set(r["product"] for r in rs)),
        }
    )

summary.sort(
    key=lambda r: (
        ORDER.index(r["category"]) if r["category"] in ORDER else 99,
        -r["files"],
        r["insurer"],
    )
)
with open(os.path.join(ROOT, "archive_summary.csv"), "w", newline="") as fh:
    w = csv.DictWriter(
        fh,
        fieldnames=[
            "insurer",
            "category",
            "files",
            "pds",
            "spds",
            "pds_equivalent",
            "products",
            "bytes",
        ],
    )
    w.writeheader()
    w.writerows(summary)

cat_totals = defaultdict(lambda: {"files": 0, "bytes": 0})
for r in summary:
    cat_totals[r["category"]]["files"] += r["files"]
    cat_totals[r["category"]]["bytes"] += r["bytes"]

lines = [
    "# Australian Insurer PDS / SPDS Archive",
    "",
    "A working archive of **Product Disclosure Statements (PDS)** and **Supplementary Product "
    "Disclosure Statements (SPDS)** for Australian insurance products, organised by insurer and "
    "product.",
    "",
    f"- **{len(ROWS):,} PDFs**, ~{sum(int(r['bytes']) for r in ROWS)/1048576:,.0f} MB",
    f"- **{len(by_ins)} insurer folders**, each with its own `README.md` and `manifest.csv`",
    "- Every PDF validated with `pdfinfo` — **zero corrupt or zero-page files**",
    "- Machine-readable index: [`all_manifest.csv`](all_manifest.csv) "
    "(insurer, category, product, type, title, file, bytes, URL)",
    "- Per-insurer summary: [`archive_summary.csv`](archive_summary.csv)",
    "",
    "## At a glance",
    "",
    "| Category | Insurers | PDFs | Size |",
    "|---|---:|---:|---:|",
]
for cat in ORDER:
    ins_count = sum(1 for r in summary if r["category"] == cat)
    lines.append(
        f"| {cat} | {ins_count} | {cat_totals[cat]['files']:,} | "
        f"{human(cat_totals[cat]['bytes'])} |"
    )
lines += [
    f"| **Total** | **{len(by_ins)}** | **{len(ROWS):,}** | "
    f"**{human(sum(int(r['bytes']) for r in ROWS))}** |",
    "",
    "## Insurer folders",
    "",
    "| Insurer | Category | Products | Files | PDS | SPDS | PDS-equivalent | Size |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
]
for r in summary:
    link = f"[{r['insurer']} PDS](<{r['insurer']} PDS/README.md>)"
    lines.append(
        f"| {link} | {r['category']} | {r['products']} | {r['files']} | "
        f"{r['pds']} | {r['spds']} | {r['pds_equivalent']} | {human(r['bytes'])} |"
    )
lines += [
    "",
    "## What is included",
    "",
    "- **PDS** and **SPDS** documents published on each insurer's product-disclosure page.",
    "- **Combined PDS and policy documents** where the insurer publishes the PDS and policy "
    "terms as one document.",
    "- **Combined PDS and FSG** documents where that combined document is the only PDS the "
    "insurer publishes.",
    "- **PDS-equivalent policy wordings** only where the insurer does not publish a separate "
    "PDS (three documents, marked as such in `all_manifest.csv`).",
    "- **Historical and superseded editions** wherever the insurer still links them from its "
    "site. This is why several folders are much deeper than the current product range — for "
    "example Zurich (2003–2026), AIA (2009–2026), NobleOak (2009–2024) and Suncorp.",
    "- **Current editions** for every product range that publishes a public PDS.",
    "",
    "## What is excluded",
    "",
    "- Target Market Determinations (TMD), Key Fact Sheets (KFS), Premium Excess and Discount "
    "Guides (PED) and Additional Information Guides (AIG).",
    "- Standalone Financial Services Guides (FSG) — except where the FSG is combined with the "
    "PDS in the one document.",
    "- PDS updates, significant event notices, addenda and policy-only documents that are not "
    "part of a combined PDS.",
    "- Application forms, claim forms, brochures, annual reports, constitutions and governance "
    "documents.",
    "- Health-fund policy booklets and fact sheets (for example the AAMI and APIA health "
    "pages), which are not PDS documents.",
    "- Investment and superannuation PDS where the issuer is not an insurer (for example the BT "
    "platform, Australian Unity Lifeplan investment bonds and the Challenger Guaranteed Income "
    "Fund).",
    "- White-label brand PDS (Coles, Woolworths, Kmart, Bupa, NIB, bank travel and similar). "
    "Those documents are issued by the underlying insurer and duplicate the PDS in the relevant "
    "insurer folder; the underlying insurer's current and historical PDS are archived here.",
    "",
    "## How it was built",
    "",
    "1. Each insurer's public policy-document page was fetched and parsed for PDF links.",
    "2. Links were filtered to PDS/SPDS (plus combined PDS/policy and PDS-equivalent wordings), "
    "de-duplicated by URL, and grouped into product folders.",
    "3. PDFs were downloaded with a browser user-agent and a per-insurer referer, validated by "
    "the `%PDF` header, and retried up to three times.",
    "4. Sites that block plain HTTP clients (Budget Direct's secure host, RAC's NobleOak host, "
    "NobleOak, and some CDN links) were fetched through a real browser and saved through a "
    "local upload server.",
    "5. Every file was verified with `pdfinfo`; the final audit compares the manifest against "
    "the files on disk (no orphans, no missing files).",
    "",
    "## Known gaps and dead links",
    "",
    "- **1Cover** — the 19 December 2024 Standard PDS link is a dead 404. The current edition "
    "and the other historical editions are present.",
    "- **RACT** — the May 2023 travel PDS link is a dead 404. The other travel editions are "
    "present.",
    "- **Vero** — the 27 October 2022 retail PDS link is a dead 404. The other Vero editions "
    "are present.",
    "- **Integrity Life** — the business was transferred to AIA; there is no standalone public "
    "PDS site. AIA's archive is included.",
    "- **Australian Unity** — no longer publishes a life-risk PDS; its general insurance is "
    "issued by Allianz and its investment bonds are not insurance PDS. Not archived as a life "
    "insurer.",
    "- **BT** — a wealth and superannuation platform rather than a life insurer; excluded.",
    "- **HCF Life** — `hcflife.com.au` timed out; the PDS documents were taken from "
    "`hcf.com.au/lifeinfo`.",
    "",
    "## Top-level files",
    "",
    "| File | Purpose |",
    "|---|---|",
    "| `all_manifest.csv` | Every PDF in the archive, normalised to insurer / category / "
    "product / type / title / file / bytes / URL. |",
    "| `archive_summary.csv` | Per-insurer counts and sizes. |",
    "| `suncorp_manifest.csv` | Combined manifest for AAMI, GIO, APIA, Shannons and Bingle. |",
    "| `more_manifest.csv` | Combined manifest for Vero, RACV, RACQ and Youi. |",
    "| `more2_manifest.csv` | Combined manifest for Budget Direct, RAC WA, RAA, RACT, CGU and "
    "TIO. |",
    "| `travel_manifest.csv` | Combined manifest for the eight travel specialists. |",
    "| `life_manifest.csv` | Combined manifest for the twelve life insurers. |",
    "| `*_links.json` | Source link lists used by the downloader. |",
    "| `more_download.py` | Generic downloader (link list → PDFs → manifest). |",
    "| `scripts/collector/` | Extraction, README-generation, audit and browser-upload scripts. |",
    "",
    "## Re-running",
    "",
    "Each insurer folder's `README.md` shows the source page and the command to re-run that "
    "batch. The combined batches are:",
    "",
    "```bash",
    'cd "Default Project"',
    "python3 more_download.py suncorp_links.json suncorp_manifest.csv",
    "python3 more_download.py more_links.json more_manifest.csv",
    "python3 more_download.py more2_links.json more2_manifest.csv",
    "python3 more_download.py travel_links.json travel_manifest.csv",
    "python3 more_download.py life_links.json life_manifest.csv",
    "```",
    "",
    "`more_download.py` keeps existing valid files (cached), so re-running only fetches missing "
    "or failed documents. `scripts/collector/work/make_all_manifest.py` rebuilds `all_manifest.csv`; "
    "`scripts/collector/work/make_root_readme.py` rebuilds this README and `archive_summary.csv`.",
    "",
    "## Provenance",
    "",
    "All PDFs are copyright of the respective insurers and are stored here for reference and "
    "research. Source URLs are recorded for every file. Where a document has been superseded, "
    "the effective date or edition is preserved in the title and filename.",
    "",
]
open(os.path.join(ROOT, "README.md"), "w").write("\n".join(lines))
print("wrote README.md and archive_summary.csv")
