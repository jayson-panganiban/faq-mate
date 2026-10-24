#!/usr/bin/env python3
"""Extract PDS/SPDS links for Tier 3 Australian life insurers."""

import json
import os
import re
from html.parser import HTMLParser
from urllib.parse import unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.a = None
        self.items = []
        self.cur = None
        self.buf = []
        self.h = ""

    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "h2", "h3", "h4", "h5"):
            self.cur = tag
            self.buf = []
        elif tag == "a":
            self.a = [dict(attrs).get("href") or "", []]

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4", "h5") and self.cur == tag:
            self.h = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            self.cur = None
        elif tag == "a" and self.a:
            href, txt = self.a
            if ".pdf" in href.lower():
                self.items.append((self.h, re.sub(r"\s+", " ", "".join(txt)).strip(), href))
            self.a = None

    def handle_data(self, d):
        if self.cur:
            self.buf.append(d)
        if self.a is not None:
            self.a[1].append(d)


def items(fname):
    p = P()
    p.feed(open(os.path.join(JSONDIR, fname + ".html"), encoding="utf-8", errors="replace").read())
    return p.items


def absurl(base, href):
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return base + href
    return base + "/" + href


def dedupe(rows):
    seen = {}
    for r in rows:
        key = re.sub(r"^https?://(www\.)?", "", r["url"]).rstrip("/")
        key = re.sub(r"(\.pdf)+$", ".pdf", key, flags=re.I)
        seen.setdefault(key, r)
    return list(seen.values())


MONTHS = {
    m: i
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1
    )
}


def date_from(text):
    m = re.search(r"(\d{1,2})[-_ ]([A-Za-z]{3,9})[-_ ](20\d{2})", text)
    if m and MONTHS.get(m.group(2)[:3].lower()):
        return f"{m.group(3)}-{MONTHS[m.group(2)[:3].lower()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"(20\d{2})[-_ ]?(\d{2})[-_ ]?(\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"([A-Za-z]{3,9})[-_ ](20\d{2})", text)
    if m and MONTHS.get(m.group(1)[:3].lower()):
        return f"{m.group(2)}-{MONTHS[m.group(1)[:3].lower()]:02d}-01"
    return ""


def main():
    out = []

    # ---- TAL -------------------------------------------------------------
    for h, t, u in items("tal_docs"):
        if "accelerated-protection-combined-pds" in u:
            out.append(
                {
                    "insurer": "TAL",
                    "product": "Accelerated Protection",
                    "title": "TAL Accelerated Protection Combined PDS & Policy Document",
                    "url": absurl("https://www.tal.com.au", u),
                }
            )
        elif "corporate_pds_life_insurance" in u:
            out.append(
                {
                    "insurer": "TAL",
                    "product": "Group Plus",
                    "title": "TAL Group Plus Life Insurance PDS",
                    "url": absurl("https://www.tal.com.au", u),
                }
            )
        elif "corporate_pds_salary_continuance" in u:
            out.append(
                {
                    "insurer": "TAL",
                    "product": "Group Plus",
                    "title": "TAL Group Plus Salary Continuance Insurance PDS",
                    "url": absurl("https://www.tal.com.au", u),
                }
            )

    # ---- Asteron Life ----------------------------------------------------
    for h, t, u in items("asteron_docs"):
        if "asteron-life-complete-pds" in u:
            out.append(
                {
                    "insurer": "Asteron Life",
                    "product": "Asteron Life Complete",
                    "title": "Asteron Life Complete PDS (August 2026)",
                    "url": absurl("https://www.asteronlife.com.au", u),
                }
            )

    # ---- NEOS ------------------------------------------------------------
    for h, t, u in items("neos_pds"):
        if not re.search(r"\bPDS\b", h, re.I):
            continue
        prod = "Protect Super Plan" if re.search(r"super", h, re.I) else "NEOS Protection"
        out.append(
            {
                "insurer": "NEOS",
                "product": prod,
                "title": h,
                "url": absurl("https://www.neosprotect.com.au", u),
            }
        )

    # ---- PPS Mutual ------------------------------------------------------
    for h, t, u in items("pps_legal"):
        if "Professionals-Choice-PDS" in u:
            out.append(
                {
                    "insurer": "PPS Mutual",
                    "product": "Professionals Choice",
                    "title": "PPS Mutual Professionals Choice PDS (26 September 2026)",
                    "url": absurl("https://www.ppsmutual.com.au", u),
                }
            )
        elif "Super-fund_PDS" in u:
            out.append(
                {
                    "insurer": "PPS Mutual",
                    "product": "Super Fund",
                    "title": "PPS Mutual Super Fund PDS (13 December 2024)",
                    "url": absurl("https://www.ppsmutual.com.au", u),
                }
            )

    # ---- AIA Australia ---------------------------------------------------
    aia = {}
    for fname in ("aia_docs", "aia_policy"):
        for h, t, u in items(fname):
            name = unquote(u.split("?")[0].rsplit("/", 1)[-1])
            name = re.sub(r"\.coredownload\.inline\.pdf$", "", name, flags=re.I)
            name = re.sub(r"(\.pdf)+$", ".pdf", name, flags=re.I)
            low = name.lower()
            if not re.search(r"pds|product.disclosure", low):
                continue
            if re.search(
                r"tmd|target.market|key.facts|financial.services|significant|"
                r"enhancement|incorporated|core.disclosure|addendum|update",
                low,
            ):
                continue
            aia.setdefault(name.lower(), (name, u))
    for key, (name, u) in sorted(aia.items()):
        low = name.lower()
        if "platform_investors" in low or "platform-investors" in low:
            prod = "Priority Protection for Platform Investors"
        elif "priority_protection" in low or "priority-protection" in low:
            prod = "Priority Protection"
        elif "tailored-protection" in low:
            prod = "Tailored Protection"
        elif "dpm-pip" in low or "professional-insurance-portfolio" in low:
            prod = "Professional Insurance Portfolio"
        elif "combined-pds-policy-document" in low:
            prod = "Replacement Policies"
        elif "sl-insurance-pds" in low:
            prod = "Simple Life"
        elif "accident-protection" in low:
            prod = "Accident Protection"
        elif "crisis-recovery" in low:
            prod = "Crisis Recovery Protection"
        elif "home-loan-protection" in low:
            prod = "Home Loan Protection"
        elif "injury-cash" in low:
            prod = "Injury Cash Protection"
        elif "lifestyle-protection" in low:
            prod = "Lifestyle Protection"
        elif "term-life-protection" in low:
            prod = "Term Life Protection"
        else:
            prod = "Legacy"
        d = date_from(name)
        if prod == "Simple Life":
            title = "AIA Simple Life Combined PDS and Policy Document" + (f" ({d})" if d else "")
        elif prod == "Replacement Policies":
            title = "AIA Combined PDS and Policy Document for TCPS/SMSF Replacement Policies" + (
                f" ({d})" if d else ""
            )
        elif prod == "Legacy":
            title = "AIA Product Disclosure Statement (June 2009)"
        else:
            title = f"AIA {prod} PDS" + (f" ({d})" if d else "")
        out.append(
            {
                "insurer": "AIA",
                "product": prod,
                "title": title,
                "url": absurl("https://www.aia.com.au", u),
            }
        )

    # ---- ClearView -------------------------------------------------------
    for h, t, u in items("clearview"):
        blob = h + " " + t + " " + u
        if not re.search(r"PDS|product disclosure", blob, re.I):
            continue
        if re.search(
            r"web update|update|additional information|flyer|brochure", (h + " " + t), re.I
        ):
            continue
        if "ClearChoice-Combined-PDS" in u:
            out.append(
                {
                    "insurer": "ClearView",
                    "product": "ClearChoice",
                    "title": "ClearView ClearChoice Combined PDS and Policy Document (13 May 2026)",
                    "url": u,
                }
            )
        elif "ClearChoice-Super-Rollover-PDS" in u:
            out.append(
                {
                    "insurer": "ClearView",
                    "product": "ClearChoice Super Rollover",
                    "title": "ClearView ClearChoice Super Rollover PDS (12 February 2024)",
                    "url": u,
                }
            )
        elif "Life-Solutions-Product-Disclosure-Statement" in u:
            out.append(
                {
                    "insurer": "ClearView",
                    "product": "LifeSolutions",
                    "title": "ClearView LifeSolutions Combined PDS and Policy Document (5 April 2026)",
                    "url": u,
                }
            )

    # ---- Zurich ----------------------------------------------------------
    for h, t, u in items("zurich_docs"):
        blob = h + " " + u
        if not re.search(r"\bPDS\b|SPDS|product disclosure", blob, re.I):
            continue
        if re.search(r"update|notice", blob, re.I):
            continue
        low = u.lower()
        if "wealth-protection" in low or "income-replacement" in low:
            prod = "Wealth Protection"
        elif "zurich-active" in low or "active-pds" in low:
            prod = "Zurich Active"
        elif "insurance-only-superannuation" in low:
            prod = "Insurance-only Superannuation Plan"
        elif "ezlu" in low:
            prod = "Ezicover Life"
        elif "ezig" in low:
            prod = "Ezicover Income Protection"
        elif "home-loan-protection" in low:
            prod = "Home Loan Protection"
        elif "sumo" in low:
            prod = "Sumo"
        elif "futurewise" in low:
            prod = "FutureWise"
        elif "super-protector" in low:
            prod = "Super Protector"
        else:
            prod = "Other"
        out.append(
            {
                "insurer": "Zurich",
                "product": prod,
                "title": h or t or u.rsplit("/", 1)[-1],
                "url": absurl("https://www.zurich.com.au", u),
            }
        )

    # ---- Acenda (formerly MLC Life) --------------------------------------
    acenda_products = {
        "ocm0349": ("Acenda Insurance", "Acenda Insurance and Acenda Insurance (Super) PDS"),
        "ac6451": (
            "Personal Protection Portfolio",
            "Personal Protection Portfolio and Life Cover Super PDS",
        ),
        "ac6446": ("Protectionfirst", "Protectionfirst PDS"),
        "ac6799": (
            "Acenda Insurance",
            "Acenda Insurance and Acenda Insurance Super SPDS for Level Premiums",
        ),
        "ac6108": ("Whole of Life", "Whole of Life PDS"),
    }
    for h, t, u in items("acenda"):
        for key, (prod, title) in acenda_products.items():
            if key in u:
                out.append(
                    {
                        "insurer": "Acenda",
                        "product": prod,
                        "title": title,
                        "url": absurl("https://www.acenda.com.au", u),
                    }
                )
                break

    # ---- MetLife ---------------------------------------------------------
    for title, u in [
        (
            "MetLife Protect and MetLife Protect Super Combined PDS and Policy Terms (16 November 2025)",
            "https://www.metlife.com.au/content/dam/metlifecom/au/pds/MET-R_MetLife-Protect-and-Combined-PDS_Policy-Terms.pdf",
        ),
        (
            "MetLife Protect and MetLife Protect Super Combined PDS and Policy Terms (30 June 2024)",
            "https://www.metlife.com.au/content/dam/metlifecom/au/images/documents/retail-pds/PDS-metlife-protect_30062024.pdf",
        ),
        (
            "MetLife Protect and MetLife Protect Super SPDS (2 February 2025)",
            "https://www.metlife.com.au/content/dam/metlifecom/au/images/documents/retail-pds/SPDS-PDS-metlife-protect_02022025.pdf",
        ),
    ]:
        out.append({"insurer": "MetLife", "product": "MetLife Protect", "title": title, "url": u})

    # ---- Challenger ------------------------------------------------------
    challenger_products = {
        "GA-Fixed-Term-Direct-PDS": (
            "Guaranteed Annuity (Fixed Term Direct)",
            "Challenger Guaranteed Annuity (Fixed Term Direct) PDS",
        ),
        "GA-Fixed-Term-PDS": (
            "Guaranteed Annuity (Fixed Term)",
            "Challenger Guaranteed Annuity (Fixed Term) PDS",
        ),
        "GA-LL-PDS": (
            "Lifetime Annuity (Liquid Lifetime)",
            "Challenger Lifetime Annuity (Liquid Lifetime) PDS",
        ),
        "CarePlus-PDS": ("CarePlus", "Challenger CarePlus PDS"),
    }
    for h, t, u in items("challenger_pds"):
        for key, (prod, title) in challenger_products.items():
            if u.rsplit("/", 1)[-1] == key + ".pdf":
                out.append({"insurer": "Challenger", "product": prod, "title": title, "url": u})
                break

    # ---- NobleOak --------------------------------------------------------
    for prod, title, u in [
        (
            "Premium Life Direct",
            "Premium Life Direct PDS (15 December 2024)",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/14193441/PLDPDSCurrent.pdf",
        ),
        (
            "My Protection Plan",
            "My Protection Plan PDS (15 December 2024)",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/14193436/MPPPDSCurrent.pdf",
        ),
        (
            "FlexiCover",
            "FlexiCover PDS (15 December 2024)",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/14193431/FlexiCoverPDSCurrent.pdf",
        ),
    ]:
        out.append({"insurer": "NobleOak", "product": prod, "title": title, "url": u})

    nobleoak_archive = [
        (
            "Premium Life Direct",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16083857/PLD_PDS_30June23.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16083842/MPP_PDS_30June23.pdf",
        ),
        (
            "FlexiCover",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16083850/FlexiCover_PDS_30June23.pdf",
        ),
        (
            "Premium Life Direct",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093158/Premium-Life-Direct-14-Feb-2022.pdf",
        ),
        (
            "FlexiCover",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093118/Archived-FlexiCover-Plan-Issue-Date-01-October-2021.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093133/Archived-My-Protection-Plan-Oct-2021.pdf",
        ),
        (
            "Premium Life Direct",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093139/Archived-Premium-Life-Direct-Oct-2021.pdf",
        ),
        (
            "FlexiCover",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093114/Archived-FlexiCover-PDS-Issue-Date-05-April-2021.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093150/My-Protection-Plan-05-April-2021.pdf",
        ),
        (
            "Premium Life Direct",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093202/Premium-Life-Direct-April-2021.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093122/Archived-My-Protection-Plan-14-January-2019.pdf",
        ),
        (
            "FiftyUp Life",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093107/Archived-FiftyUp-Life-Insurance-Jan-2019.pdf",
        ),
        (
            "Premium Life Direct",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093154/Premium-Life-Direct-12-October-2018.pdf",
        ),
        (
            "FiftyUp Life",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093102/Archived-Fifty-Plus-Life-Insurance-October-2016.pdf",
        ),
        (
            "FiftyUp Life",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093110/Archived-FiftyUp-Life-Insurance-October-2016.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093136/Archived-My-Protection-Plan-October-2016.pdf",
        ),
        (
            "Premium Life Direct",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093143/Archived-Premium-Life-Direct-October-2016.pdf",
        ),
        (
            "SMSF Direct Life",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093146/Archived-SMSF-Direct-Life-October-2016.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093125/Archived-My-Protection-Plan-March-2010.pdf",
        ),
        (
            "My Protection Plan",
            "https://assets.nobleoak.com.au/wp-content/uploads/2024/12/16093128/Archived-My-Protection-Plan-Nov-2009.pdf",
        ),
    ]
    for prod, u in nobleoak_archive:
        name = u.rsplit("/", 1)[-1]
        d = date_from(name)
        out.append(
            {
                "insurer": "NobleOak",
                "product": prod,
                "title": f"{prod} PDS" + (f" ({d})" if d else ""),
                "url": u,
            }
        )

    # ---- HCF Life --------------------------------------------------------
    hcf_products = {
        "Cash_Back_Cover": ("Cash Back Cover", "HCF Cash Back Cover PDS"),
        "Critical_Illness_Insurance": (
            "Critical Illness Insurance",
            "HCF Critical Illness Insurance PDS",
        ),
        "Income_Protect_Insurance_IP2": (
            "Income Protect Insurance",
            "HCF Income Protect Insurance PDS",
        ),
        "Kids_Accident_Cover_KA4": ("Kids' Accident Cover", "HCF Kids' Accident Cover PDS"),
        "Life_Protect_Insurance": ("Life Protect Insurance", "HCF Life Protect Insurance PDS"),
        "Personal_Accident_Insurance": (
            "Personal Accident Insurance",
            "HCF Personal Accident Insurance PDS",
        ),
        "HCF_Funeral_Insurance": ("Funeral Insurance", "HCF Funeral Insurance PDS"),
    }
    for h, t, u in items("hcf_lifeinfo"):
        stem = u.rsplit("/", 1)[-1].replace(".pdf", "")
        for key, (prod, title) in hcf_products.items():
            if stem == key:
                out.append(
                    {
                        "insurer": "HCF Life",
                        "product": prod,
                        "title": title,
                        "url": absurl("https://www.hcf.com.au", u),
                    }
                )
                break

    out = dedupe(out)
    # Drop duplicate basenames within one insurer (same document served from two paths).
    final, seen = [], set()
    for r in out:
        base = r["url"].rsplit("/", 1)[-1].lower()
        if base in ("pds.pdf", "spds.pdf"):
            final.append(r)
            continue
        key = (r["insurer"], base)
        if key in seen:
            continue
        seen.add(key)
        final.append(r)
    out = final
    json.dump(out, open(os.path.join(ROOT, "life_links.json"), "w"), indent=2)
    from collections import Counter

    print(len(out), Counter(x["insurer"] for x in out))
    for x in out:
        print(f"{x['insurer'][:22]:22} | {x['product'][:34]:34} | {x['title'][:80]}")


if __name__ == "__main__":
    main()
