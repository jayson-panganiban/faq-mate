#!/usr/bin/env python3
"""Extract PDS/SPDS links for RACV, RACQ, Youi and Vero."""

import json
import os
import re
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")

RACV = [
    ("Home", "racv_home"),
    ("Motor", "racv_motor"),
    ("Travel", "racv_travel"),
    ("Business", "racv_business"),
]

RACQ = [("Motor", "racq")]

VERO = [
    ("Home & Contents", "vero_home-and-contents-insurance"),
    ("Landlord", "vero_landlord-insurance"),
    ("Secure Motor", "vero_secure-motor"),
    ("Travel", "vero_travel"),
    ("Business", "vero_sme-insurance_business-insurance"),
    ("Business Insurance Solutions", "vero_sme-insurance_business-insurance-solutions"),
    ("Commercial Motor", "vero_sme-insurance_commercial-motor"),
    ("Mobile Business", "vero_sme-insurance_mobile-business"),
    ("Motor Trade", "vero_sme-insurance_motor-trade"),
    ("Not-for-Profit", "vero_sme-insurance_not-for-profit"),
    ("Professional & Office Services", "vero_sme-insurance_professional-services"),
    ("Retail Services", "vero_sme-insurance_retail-services"),
    ("Tax Audit", "vero_sme-insurance_tax-audit-insurance"),
    ("Equipment Breakdown", "vero_equipment-breakdown"),
    ("Workers Compensation", "vero_workers-compensation"),
    ("Property - ISR", "vero_property-Insurance"),
    ("Motor Fleet", "vero_motor-fleet_motor-fleet-insurance"),
    ("Heavy Vehicle", "vero_motor-fleet_heavy-vehicle"),
    ("Professional Indemnity", "vero_professional-indemnity"),
    ("Design & Engineering PI", "vero_engineers-professional-indemnity"),
    ("Association Liability", "vero_professional-financial-risks_association-liability"),
    ("Directors & Officers", "vero_professional-financial-risks_directors-officers-liability"),
    ("iTech Liability", "vero_professional-financial-risks_itech-liability"),
    ("Management Liability", "vero_professional-financial-risks_management-liability"),
    (
        "Medical Malpractice",
        "vero_professional-financial-risks_medical-malpractice-civil-liability",
    ),
    (
        "Super Fund Trustee",
        "vero_professional-financial-risks_superannuation-fund-trustee-liability",
    ),
    ("Public & Products Liability", "vero_public-and-products-liability"),
    ("Residential Strata", "vero_residential-strata"),
    ("Surety Bonds", "vero_surety-bonds"),
]

YOU = [
    ("Car", "car-pds", "Car Insurance"),
    ("Home", "home-pds", "Home Insurance"),
    ("Motorcycle", "motorcycle-pds", "Motorcycle Insurance"),
    ("Caravan & Trailer", "caravan-and-trailer-pds", "Caravan & Trailer Insurance"),
    ("Watercraft", "watercraft-pds", "Watercraft Insurance"),
    ("Small Business", "business-pds", "Small Business Insurance"),
]

PAT = re.compile(r"\bPDS\b|SPDS|product[\s_-]*disclosure", re.I)
EXCL = re.compile(
    r"update pursuant|additional information|target market|\bTMD\b|premium excess|"
    r"\bPED\b|key fact|\bKFS\b|ASIC Corporations|ASIC Class|pursuant to ASIC|pds update|product disclosure statement update|"
    r"customer info booklet|financial services guide(?!.*\bPDS\b)",
    re.I,
)


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.a = None
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.a = [dict(attrs).get("href", ""), []]

    def handle_endtag(self, tag):
        if tag == "a" and self.a:
            href, txt = self.a
            if ".pdf" in href.lower():
                self.items.append((re.sub(r"\s+", " ", "".join(txt)).strip(), href))
            self.a = None

    def handle_data(self, d):
        if self.a is not None:
            self.a[1].append(d)


def classify(product, text):
    rules = [
        (r"landlord", "Landlord"),
        (r"caravan|trailer", "Caravan & Trailer"),
        (r"veteran|vintage|classic", "Veteran & Classic"),
        (r"\bboat\b|marine", "Boat"),
        (r"motor trade", "Motor Trade"),
        (r"easyfarm|farm", "Farm"),
        (r"easybiz@home|easybiz at home", "EasyBiz@Home"),
        (r"tradesperson|tradesman", "EasyBiz Tradesperson"),
        (r"easybiz", "EasyBiz"),
        (r"professional indemnity", "Professional Indemnity"),
        (r"\bict\b|information and communication technology", "ICT Liability"),
        (r"home build|building", "Home Building"),
        (r"home content|contents", "Home Contents"),
        (r"\bpet\b", "Pet"),
        (r"household", "Household"),
        (r"\btravel\b", "Travel"),
        (r"motor vehicle|\bmotor\b|\bcar\b", "Motor"),
        (r"\bbusiness\b", "Business"),
    ]
    for pat, name in rules:
        if re.search(pat, text, re.I):
            return name
    return product


def extract(pages, insurer, base, use_classify=True):
    out = []
    seen = {}
    for product, fname in pages:
        path = os.path.join(JSONDIR, fname + ".html")
        if not os.path.exists(path):
            print("MISSING", path)
            continue
        p = P()
        p.feed(open(path, encoding="utf-8", errors="replace").read())
        for title, href in p.items:
            blob = title + " " + href.rsplit("/", 1)[-1]
            if not PAT.search(blob) or EXCL.search(blob):
                continue
            url = href if href.startswith("http") else base + href
            if url in seen:
                if len(title) > len(seen[url]["title"]):
                    seen[url]["title"] = title
                continue
            prod = classify(product, blob) if use_classify else product
            if re.search(r"\bAFCA\b", title, re.I):
                prod = "General"
            seen[url] = {"insurer": insurer, "product": prod, "title": title, "url": url}
    out.extend(seen.values())
    return out


def main():
    out = []
    out += extract(RACV, "RACV", "https://www.racv.com.au")
    out += extract(RACQ, "RACQ", "https://www.racq.com.au")
    out += extract(VERO, "Vero", "https://www.vero.com.au", use_classify=False)

    # Youi: current + the two historical versions linked on the page.
    for product, slug, label in YOU:
        out.append(
            {
                "insurer": "Youi",
                "product": product,
                "title": f"{label} PDS (current)",
                "url": f"https://www.youi.com.au/documents/{slug}",
            }
        )
        for date in ("2024-07-03", "2023-07-05"):
            out.append(
                {
                    "insurer": "Youi",
                    "product": product,
                    "title": f"{label} PDS ({date})",
                    "url": f"https://www.youi.com.au/documents/{slug}/{date}",
                }
            )

    json.dump(out, open(os.path.join(ROOT, "more_links.json"), "w"), indent=2)
    from collections import Counter

    print(len(out), Counter(x["insurer"] for x in out))
    for x in out:
        print(f"{x['insurer']:6} | {x['product'][:28]:28} | {x['title'][:75]}")


if __name__ == "__main__":
    main()
