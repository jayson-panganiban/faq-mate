#!/usr/bin/env python3
"""Generate READMEs and per-insurer manifests for Budget Direct, RAC WA, RAA, RACT, CGU and TIO."""

from manifest_utils import (
    load_manifest,
    write_insurer_archive_bundle,
)

ROWS = load_manifest("more2_manifest.csv")

META = {
    "Budget Direct": {
        "source": "https://www.autogeneral.com.au/customers/find-pds/budd/",
        "notes": """
- Budget Direct PDS documents are published through the Auto & General PDS finder. Current
  editions are hosted on `secure.budgetdirect.com.au`, which blocks plain HTTP clients; they
  were retrieved through a real browser and saved to disk. Historical editions are hosted on
  `autogeneral.com.au`.
- **Car** cover is published as **Part A** (the PDS) and **Part B** (the policy wording), plus a
  separate Supplementary PDS. All parts are included.
- Product variants have their own Part B documents: Gold Car, Gold Car – Low Kilometres,
  Car – Low Kilometres, Lady Driver Car and Retired Driver Car.
- **Travel** is a combined PDS/FSG document, with previous editions included.
- **Life** documents include Premium Life Direct and Budget Direct Life & Accidental Death;
  **Income Protection** is stored separately.
- Historical editions are dated in the document title where the source filename carries a date.
""",
    },
    "RAC WA": {
        "source": "https://rac.com.au/products/insurance/policy-documents",
        "notes": """
- RAC WA publishes a combined **PDS and Financial Services Guide** for each general insurance
  product, plus separate **Supplementary PDS** documents. Historical editions are included
  where the product page still links them.
- Products covered: Car, Classic Car, Home (building, contents and valuables), Basic Contents,
  Motorcycle, Boat, Pet, Caravan & Trailer, Landlord, Life and Travel.
- **Life** cover (RAC My Protection Plan) is issued by NobleOak and hosted on
  `rac.nobleoak.com.au`. Those PDFs also block plain HTTP clients and were retrieved through a
  real browser.
- **Travel** is a single combined PDS/FSG document.
""",
    },
    "RAA": {
        "source": "https://www.raa.com.au/help-centre/insurance-support/pds-and-fact-sheets",
        "notes": """
- RAA publishes **PDS** documents for each product, some as combined **PDS and Supplementary
  PDS** documents and some with a separate Supplementary PDS. Both forms are included.
- Products covered: Comprehensive Car, Premium Comprehensive Car, Standard Comprehensive Car,
  Third Party Vehicle, Home & Contents, Landlord & Short Stay, Motorcycle & Mobility Scooter,
  Caravan & Trailer, Veteran & Vintage, Hard to Place and Boat.
- A standalone generic Supplementary PDS is stored under `General`.
- Historical editions are included where the page still links them.
""",
    },
    "RACT": {
        "source": "https://www.ract.com.au/insurance-and-finance/insurance-documents",
        "notes": """
- RACT publishes **PDS** and **Supplementary PDS** documents for Home & Contents, Car
  (comprehensive and third party), Collector's Car, Caravan & Trailer, Boat, Strata Building
  and Investor insurance. All editions linked by the page are included.
- **Travel** documents are combined Financial Services Guide and PDS documents, with previous
  editions included. Source page:
  <https://www.ract.com.au/travel-and-experience/travel-insurance/travel-insurance-documents>.
- One linked May 2023 travel PDS is a dead link (HTTP 404) and could not be retrieved.
""",
    },
    "CGU": {
        "source": "https://www.cgu.com.au/policy-booklets",
        "notes": """
- CGU publishes PDS and Supplementary PDS documents for its personal and commercial products.
- **Home** cover has four tiers, each with its own PDS and SPDS: Premium – Accidental Damage,
  Quality – Listed Events, Basic – Fundamentals and First Choice Home.
- Other products covered: Motor Vehicle, Landlord, Residential Strata, Travel, Boat, Caravan,
  Business, Farm and Motor Trade.
- Current and immediately previous editions are included where the page links them.
""",
    },
    "TIO": {
        "source": "https://www.tiofi.com.au/my-tio/policy-documents/",
        "notes": """
- TIO (Territory Insurance Office) publishes a PDS for each product, with effective-date
  ranges stated in the document title. Current and previous editions are included.
- Products covered: Territory Car, Territory Home, Territory Landlord, Territory Caravan &
  Trailer, Motorcycle, Business Insurance Pack, Trades & Services Pack, Office Pack and
  Commercial Motor.
- The Motorcycle PDS is marked as no longer available for purchase but is retained because it
  remains the governing document for existing policies.
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
        rerun_script_name="more_download.py more2_links.json more2_manifest.csv",
        excluded_types=(
            "Excluded: Target Market Determinations (TMD), Premium Excess and Discount Guides "
            "(PED), Key Fact Sheets (KFS), Financial Services Guides (FSG), Additional "
            "Information Guides (AIG), PDS update notices, ASIC instruments, forms and brochures."
        ),
    )
