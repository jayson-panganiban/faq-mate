#!/usr/bin/env python3
"""Generate per-insurer README files for the Suncorp-owned brand archive."""

from manifest_utils import (
    load_manifest,
    write_insurer_archive_bundle,
)

ROWS = load_manifest("suncorp_manifest.csv")

SOURCES = {
    "AAMI": "https://www.aami.com.au/policy-documents",
    "GIO": "https://www.gio.com.au/policy-documents",
    "APIA": "https://www.apia.com.au/policy-documents.html",
    "Shannons": "https://www.shannons.com.au/policy-documents",
    "Bingle": "https://www.bingle.com.au/policy-documents",
}

NOTES = {
    "AAMI": """
- **Health insurance excluded.** The AAMI health page publishes a policy booklet and
  cover-specific fact sheets, not a PDS (health insurance is not a financial product
  requiring a PDS).
- **PDS updates excluded.** One-page "Product Disclosure Statement Update (PDS Update)"
  notices are not standalone PDS documents.
- **Business@Home** is published as separate PDS parts (Part 1 product sections, Part 2
  customer information booklet, Part 3 PDS). The Part 1 and Part 3 documents are included
  for completeness; the Part 2 customer information booklet is excluded.
- **Pet insurance** documents are branded *Best in Show*, the product name used for AAMI's
  pet cover.
- Historical and superseded editions are included where the page still links them.
""",
    "GIO": """
- **CTP and MAI pages** contain no downloadable PDFs; CTP documents are handled by the
  state/territory CTP schemes rather than GIO's policy-documents library.
- **Workers compensation** documents are published on a separate page; no PDS-tagged PDFs
  were present there.
- Historical and superseded editions (including 2012–2013 motor PDS/SPDS) are included
  where the page still links them.
""",
    "APIA": """
- **Home and retirement products.** APIA publishes separate PDS/SPDS sets for Home &
  Contents, Apartment, Village and Assisted Living cover, each stored in its own folder.
- **Health insurance excluded.** The APIA health page publishes a policy booklet and fact
  sheets, not a PDS.
- **CTP and MAI page** contains no downloadable PDFs.
- Historical and superseded editions are included where the page still links them.
""",
    "Shannons": """
- Shannons publishes PDS and SPDS documents for Motor and Home & Contents cover, including
  historical editions. The generic supplementary PDS is stored under both product folders
  because the page links a product-specific copy from each.
""",
    "Bingle": """
- Bingle publishes Comprehensive Car and Third Party Car PDS/SPDS documents, plus archived
  2017 PDS parts. All are included.
""",
}


for insurer, source in SOURCES.items():
    rows = [r for r in ROWS if r["insurer"] == insurer]
    if not rows:
        continue
    write_insurer_archive_bundle(
        insurer=insurer,
        source_url=source,
        rows=rows,
        scope_notes=NOTES.get(insurer, ""),
        rerun_script_name="suncorp_download.py",
    )
