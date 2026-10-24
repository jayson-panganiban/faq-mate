#!/usr/bin/env python3
"""Generate READMEs and per-insurer manifests for the Tier 2 travel archive."""

from manifest_utils import (
    load_manifest,
    write_insurer_archive_bundle,
)

ROWS = load_manifest("travel_manifest.csv")

META = {
    "Cover-More": {
        "source": "https://www.covermore.com.au/pds",
        "notes": """
- Cover-More publishes one combined PDS for its retail plans (Comprehensive+, Comprehensive,
  Basic and Inbound). The same PDF is linked from each plan, so it is stored once under
  `Travel`.
- **Business** and **Corporate** travel have separate PDS documents and folders.
- Historical editions from 2023–2024 are included where the page still links them.
""",
    },
    "Fast Cover": {
        "source": "https://www.fastcover.com.au/pds",
        "notes": """
- Fast Cover uses a single PDS for all of its travel insurance plans. Every edition published
  on the page is included, from 2017 through 2026.
""",
    },
    "InsureandGo": {
        "source": "https://www.insureandgo.com.au/policy-wordings/",
        "notes": """
- InsureandGo publishes separate PDS documents for **Single Trip**, **Cruise** and **Annual
  Multi-Trip**, plus historical policy wordings for **Domestic**, **One-Trip**, **Backpacker**
  and earlier annual/cruise editions.
- Current PDS documents are effective October 2026; earlier editions date back to 2020.
- Target Market Determinations and the Product Design and Distribution Policy are excluded.
""",
    },
    "1Cover": {
        "source": "https://www.1cover.com.au/policydetails/",
        "notes": """
- 1Cover publishes a single **Standard PDS** for its travel insurance plans, plus a separate
  **Ski PDS** for the 2015 ski season.
- Current PDS effective 4 March 2026; previous editions are listed on the
  [previous policy documents](https://www.1cover.com.au/policydetails-previous/) page and date
  back to 2015.
- One linked edition (19 December 2024) is a dead link (HTTP 404) and could not be retrieved.
""",
    },
    "Travel Insurance Direct": {
        "source": "https://www.travelinsurancedirect.com.au/",
        "notes": """
- Travel Insurance Direct serves its current PDS from a document API endpoint. The endpoint
  returns the PDF directly, so only the current edition is captured. TID does not publish a
  public archive of previous PDS editions.
""",
    },
    "Southern Cross Travel Insurance": {
        "source": "https://www.scti.com.au/our-policies/comprehensive/policy-wording",
        "notes": """
- SCTI publishes **International Comprehensive** and **TravelCare** PDS documents, plus
  Supplementary PDS documents for COVID-19 and TravelCare Delay Assist cover.
- Current International Comprehensive PDS effective 12 July 2025; earlier editions date back
  to 2018.
- Financial Services Guides and Target Market Determinations are excluded.
""",
    },
    "Zoom": {
        "source": "https://www.zoomtravelinsurance.com.au/policy/",
        "notes": """
- Zoom publishes a single **Standard PDS** for its travel insurance plans. The current edition
  is effective 4 March 2026, with previous editions from 2019–2023.
- The Supplementary FSG is excluded.
""",
    },
    "Go Insurance": {
        "source": "https://goinsurance.com.au/pds/",
        "notes": """
- Go Insurance publishes separate PDS documents for **Leisure Travel**, **Go Ultra**,
  **Group Travel**, **Corporate Travel** and **Inbound Travel**, plus SPDS documents for
  **Dental Tourism**, **Destination Wedding** and **Sailing**.
- Current and historical editions are included, with effective-date ranges shown on the page.
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
        rerun_script_name="more_download.py travel_links.json travel_manifest.csv",
        excluded_types=(
            "Excluded: Target Market Determinations (TMD), Key Fact Sheets (KFS), standalone "
            "Financial Services Guides (FSG), Additional Information Guides (AIG), PDS update "
            "notices, ASIC instruments, forms and brochures."
        ),
    )
