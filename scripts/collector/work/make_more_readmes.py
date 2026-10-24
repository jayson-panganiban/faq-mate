#!/usr/bin/env python3
"""Generate READMEs and per-insurer manifests for RACV, RACQ, Youi and Vero."""

from manifest_utils import (
    load_manifest,
    write_insurer_archive_bundle,
)

ROWS = load_manifest("more_manifest.csv")

META = {
    "RACV": {
        "source": "https://www.racv.com.au/insurance/policy-documents.html",
        "notes": """
- Documents are grouped by RACV's four policy-document tabs: **Home**, **Motor**,
  **Travel** and **Business**. Product folders follow the product named in each document.
- **Travel** documents are combined Financial Services Guide and PDS documents.
- **Business** includes the Business, Farm, Motor Trade, EasyBiz, EasyBiz Tradesperson and
  EasyBiz@Home PDS/SPDS sets. The Professional Indemnity and ICT Liability policy wordings
  are not PDS-tagged and are excluded.
- Historical editions are included where the page still links them.
""",
    },
    "RACQ": {
        "source": "https://www.racq.com.au/insurance/insurance-disclosure-documents",
        "notes": """
- RACQ publishes a current PDS and SPDS for each product (Motor, Household, Pet, Boat,
  Caravan & Trailer) plus the immediately previous editions. All are included.
- **Travel** is a combined PDS/FSG document.
- Product versions are identified by RACQ's document code (e.g. `RCMV2.1224`).
""",
    },
    "Youi": {
        "source": "https://www.youi.com.au/documents",
        "notes": """
- Youi publishes a current PDS for Car, Home, Motorcycle, Caravan & Trailer, Watercraft and
  Small Business, plus the 2024 and 2023 historical versions for each product.
- Older PDS editions are not published on the site; Youi provides them on request.
- Target Market Determinations, Roadside Assist terms and Key Fact Sheets are excluded.
""",
    },
    "Vero": {
        "source": "https://www.vero.com.au/policy-documents.html",
        "notes": """
- Vero's policy-document library covers commercial, SME and specialty lines. Each product
  page has its own PDS, TMD and update documents; only PDS/SPDS documents are included.
- **Home & Contents:** only the Secure Home Extra PDS and the AFCA SPDS are published as
  full PDS documents. The Secure Home Elite PDS is not on the page (only its PED guide and
  PDS update), so it is not included.
- **Workers Compensation:** the page publishes GIO-branded policy wordings, forms and
  guides, not PDS documents, so it is excluded.
- **Property - ISR** and **Surety Bonds** pages contained no PDS PDFs.
- The **AFCA SPDS** applies across Vero products and is stored once under `General`.
- The **Forms & Brochures** page is excluded.
- One linked 2022 Retail Services PDS is a dead link (HTTP 404) and could not be retrieved.
- PED guides, TMDs, ASIC instruments and policy updates are excluded.
""",
    },
}


for insurer, meta in META.items():
    rows = [r for r in ROWS if r["insurer"] == insurer]
    if not rows:
        continue
    write_insurer_archive_bundle(
        insurer=insurer,
        source_url=meta["source"],
        rows=rows,
        scope_notes=meta["notes"],
        rerun_script_name="more_download.py",
        excluded_types=(
            "Excluded: Target Market Determinations (TMD), Premium Excess and Discount Guides "
            "(PED), Key Fact Sheets (KFS), Financial Services Guides (FSG), Additional "
            "Information Guides (AIG), PDS update notices, ASIC instruments, forms and brochures."
        ),
    )
