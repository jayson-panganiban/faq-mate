#!/usr/bin/env python3
"""Generate READMEs and per-insurer manifests for the Tier 3 life archive."""

from manifest_utils import (
    load_manifest,
    write_insurer_archive_bundle,
)

ROWS = load_manifest("life_manifest.csv")

META = {
    "TAL": {
        "source": "https://www.tal.com.au/about-us/documents-and-forms",
        "notes": """
- TAL publishes its retail **Accelerated Protection** PDS as a combined PDS and policy document,
  and separate PDS documents for **Group Plus Life** and **Group Plus Salary Continuance**.
- Target Market Determinations, Key Facts sheets, forms and the Financial Services Guide are
  excluded.
""",
    },
    "Asteron Life": {
        "source": "https://www.asteronlife.com.au/about-us/disclosure-documents-and-forms",
        "notes": """
- Asteron Life publishes a single combined **Asteron Life Complete PDS** (August 2026) covering
  Life, TPD, Trauma, Income Protection, Business Expenses and Child Cover.
- Target Market Determinations and forms are excluded. Asteron Life is part of the TAL group.
""",
    },
    "NEOS": {
        "source": "https://www.neosprotect.com.au/pds/",
        "notes": """
- NEOS publishes separate PDS documents for **NEOS Protection** and the **Protect Super Plan**
  (including Protect Super Plan 2 and the earlier NEOS Super Plan).
- Every edition still linked by the page is included, from 2018 through 2026.
""",
    },
    "PPS Mutual": {
        "source": "https://www.ppsmutual.com.au/legal-compliance/",
        "notes": """
- PPS Mutual publishes two PDS documents: **Professionals Choice** (26 September 2026) and the
  **PPS Mutual Super Fund** PDS (13 December 2024).
- Target Market Determinations, the Financial Services Guide, annual reports and governance
  documents are excluded.
""",
    },
    "AIA": {
        "source": "https://www.aia.com.au/en/help-and-support/policyholder-information",
        "notes": """
- AIA Australia publishes PDS documents for **Priority Protection** (including the Platform
  Investors edition), **Tailored Protection**, **Professional Insurance Portfolio**, **Simple
  Life**, **Accident Protection**, **Crisis Recovery Protection**, **Home Loan Protection**,
  **Injury Cash Protection**, **Lifestyle Protection** and **Term Life Protection**.
- The **combined PDS and policy document** used for TCPS/SMSF replacement policies is stored
  under `Replacement Policies`.
- Historical editions are included from the policyholder information page, dating back to 2009.
- Target Market Determinations, Key Facts sheets, Financial Services Guides, policy-only
  documents, addenda, significant event notices and PDS updates are excluded.
""",
    },
    "ClearView": {
        "source": "https://www.clearview.com.au/pds-and-brochures/",
        "notes": """
- ClearView publishes combined PDS and policy documents for **ClearChoice** and
  **LifeSolutions**, plus a separate **ClearChoice Super Rollover** PDS.
- Web updates, additional information brochures and marketing flyers are excluded.
""",
    },
    "Zurich": {
        "source": "https://www.zurich.com.au/life-insurance/documents",
        "notes": """
- Zurich publishes PDS and Supplementary PDS documents for **Wealth Protection** (including
  Income Replacement and superannuation editions), **Zurich Active**, the **Insurance-only
  Superannuation Plan**, **Ezicover Life**, **Ezicover Income Protection**, **Home Loan
  Protection**, **Sumo**, **FutureWise** and **Super Protector**.
- This is a deep archive: every edition still linked by Zurich is included, from 2003 through
  2026.
- PDS updates, notices and forms are excluded.
""",
    },
    "Acenda": {
        "source": "https://www.acenda.com.au/using-your-insurance/documents-and-forms/product-disclosure-statements",
        "notes": """
- Acenda is the new name for **MLC Life Insurance**. It publishes PDS documents for
  **Acenda Insurance** (including the Super version), **Personal Protection Portfolio and Life
  Cover Super**, **Protectionfirst** and **Whole of Life**, plus an SPDS for level premiums.
- Certificates of insurance, the Financial Services Guide and corporate governance documents
  are excluded.
""",
    },
    "MetLife": {
        "source": "https://www.metlife.com.au/insurance-products/insurance-through-your-adviser/",
        "notes": """
- MetLife publishes a combined **MetLife Protect and MetLife Protect Super** PDS and policy
  terms document, plus a Supplementary PDS (SPDS).
- The current edition (16 November 2025), the 30 June 2024 edition and the 2 February 2025
  SPDS are included.
""",
    },
    "Challenger": {
        "source": "https://www.challenger.com.au/individual/help-and-support/forms-pds-tmd",
        "notes": """
- Challenger Life publishes PDS documents for its **Guaranteed Annuity (Fixed Term Direct)**,
  **Guaranteed Annuity (Fixed Term)**, **Lifetime Annuity (Liquid Lifetime)** and **CarePlus**
  products.
- The Challenger Guaranteed Income Fund PDS is a managed-investment product and is excluded, as
  are TMDs and forms.
""",
    },
    "NobleOak": {
        "source": "https://www.nobleoak.com.au/product-disclosure-statements/",
        "notes": """
- NobleOak publishes PDS documents for **Premium Life Direct** (direct), **My Protection Plan**
  (marketing partners) and **FlexiCover** (bank and credit union partners).
- The archive also covers the discontinued **FiftyUp Life** and **SMSF Direct Life** products,
  with editions dating back to 2009.
- Target Market Determinations and older Product Information documents are excluded.
""",
    },
    "HCF Life": {
        "source": "https://www.hcf.com.au/lifeinfo",
        "notes": """
- HCF Life publishes PDS documents for **Life Protect**, **Income Protect**, **Critical
  Illness**, **Personal Accident**, **Cash Back Cover**, **Kids' Accident Cover** and
  **Funeral Insurance**.
- Target Market Determinations and product comparison sheets are excluded.
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
        rerun_script_name="more_download.py life_links.json life_manifest.csv",
        excluded_types=(
            "Excluded: Target Market Determinations (TMD), Key Fact Sheets (KFS), Financial Services "
            "Guides (FSG), Product Information documents, PDS update notices, significant event "
            "notices, addenda, policy-only documents, forms and brochures."
        ),
    )
