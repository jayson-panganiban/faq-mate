#!/usr/bin/env python3
"""Extract PDS/SPDS links for Budget Direct, RAC WA, RAA, RACT, CGU and TIO."""

import json
import os
import re
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")

PAGES = {
    "Budget Direct": [("", "bd_findpds", "https://www.budgetdirect.com.au")],
    "RAC WA": [
        ("Car", "racwa_car-insurance", "https://rac.com.au"),
        ("Classic Car", "racwa_classic-car-insurance", "https://rac.com.au"),
        ("Home", "racwa_building-contents-valuables-insurance", "https://rac.com.au"),
        ("Basic Contents", "racwa_basic-contents-insurance", "https://rac.com.au"),
        ("Motorcycle", "racwa_motorcycle-insurance", "https://rac.com.au"),
        ("Boat", "racwa_boat-insurance", "https://rac.com.au"),
        ("Pet", "racwa_pet-insurance", "https://rac.com.au"),
        ("Caravan & Trailer", "racwa_caravan-trailer-insurance", "https://rac.com.au"),
        ("Landlord", "racwa_landlords-insurance", "https://rac.com.au"),
        ("Life", "racwa_life", "https://rac.com.au"),
        ("Travel", "racwa_travel", "https://rac.com.au"),
    ],
    "RAA": [("", "raa_pds", "https://www.raa.com.au")],
    "RACT": [
        ("", "ract_docs", "https://www.ract.com.au"),
        ("Travel", "ract_travel", "https://www.ract.com.au"),
    ],
    "CGU": [("", "cgu_pb", "https://www.cgu.com.au")],
    "TIO": [("", "tio_pds", "https://www.tiofi.com.au")],
}

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
        self.cur = None
        self.buf = []
        self.h = ""

    def handle_starttag(self, tag, attrs):
        if tag in ("h2", "h3", "h4", "h5"):
            self.cur = tag
            self.buf = []
        elif tag == "a":
            self.a = [dict(attrs).get("href") or "", []]

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "h4", "h5") and self.cur == tag:
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


def product_for(insurer, page_product, heading, title, url):
    text = f"{heading} {title} {url.rsplit('/', 1)[-1]}"
    if insurer == "Budget Direct":
        if re.search(r"gold car.*low", text, re.I):
            return "Gold Car - Low Kilometres"
        if re.search(r"gold car", text, re.I):
            return "Gold Car"
        if re.search(r"car.*low kilomet", text, re.I):
            return "Car - Low Kilometres"
        if re.search(r"lady driver", text, re.I):
            return "Lady Driver Car"
        if re.search(r"retired driver", text, re.I):
            return "Retired Driver Car"
        if re.search(r"motorcycle", text, re.I):
            return "Motorcycle"
        if re.search(r"smart home", text, re.I):
            return "Smart Home"
        if re.search(r"home", text, re.I):
            return "Home"
        if re.search(r"pet", text, re.I):
            return "Pet"
        if re.search(r"travel", text, re.I):
            return "Travel"
        if re.search(r"income protection", text, re.I):
            return "Income Protection"
        if re.search(r"life", text, re.I):
            return "Life"
        if re.search(r"car", text, re.I):
            return "Car"
        return page_product or "Other"
    if insurer == "RAC WA":
        return page_product
    if insurer == "RAA":
        text = title
        if re.search(r"premium comprehensive", text, re.I):
            return "Car - Premium Comprehensive"
        if re.search(r"standard comprehensive", text, re.I):
            return "Car - Standard Comprehensive"
        if re.search(r"third party", text, re.I):
            return "Car - Third Party"
        if re.search(r"home and contents", text, re.I):
            return "Home & Contents"
        if re.search(r"landlord", text, re.I):
            return "Landlord"
        if re.search(r"motorcycle", text, re.I):
            return "Motorcycle"
        if re.search(r"caravan", text, re.I):
            return "Caravan & Trailer"
        if re.search(r"veteran|vintage", text, re.I):
            return "Veteran & Vintage"
        if re.search(r"hard.?to.?place|h2p", text, re.I):
            return "Hard To Place"
        if re.search(r"boat", text, re.I):
            return "Boat"
        if re.search(r"comprehensive car", text, re.I):
            return "Car - Comprehensive"
        return page_product or "Other"
    if insurer == "RACT":
        if page_product:
            return page_product
        text = title
        if re.search(r"home, contents", text, re.I):
            return "Home & Contents"
        if re.search(r"collector", text, re.I):
            return "Collector's Car"
        if re.search(r"\bboat\b", text, re.I):
            return "Boat"
        if re.search(r"caravan", text, re.I):
            return "Caravan & Trailer"
        if re.search(r"investor", text, re.I):
            return "Investor"
        if re.search(r"strata", text, re.I):
            return "Strata"
        if re.search(r"comprehensive car|third party", text, re.I):
            return "Car"
        return page_product or "Other"
    if insurer == "CGU":
        if re.search(r"motor trade", text, re.I):
            return "Motor Trade"
        if re.search(r"farm", text, re.I):
            return "Farm"
        if re.search(r"business", text, re.I):
            return "Business"
        if re.search(r"travel", text, re.I):
            return "Travel"
        if re.search(r"boat", text, re.I):
            return "Boat"
        if re.search(r"caravan", text, re.I):
            return "Caravan"
        if re.search(r"strata", text, re.I):
            return "Residential Strata"
        if re.search(r"landlord", text, re.I):
            return "Landlord"
        if re.search(r"first choice", text, re.I):
            return "Home - First Choice"
        if re.search(r"accidental damage", text, re.I):
            return "Home - Premium Accidental Damage"
        if re.search(r"listed events", text, re.I):
            return "Home - Quality Listed Events"
        if re.search(r"fundamentals", text, re.I):
            return "Home - Basic Fundamentals"
        if re.search(r"home", text, re.I):
            return "Home"
        if re.search(r"motor vehicle", text, re.I):
            return "Motor Vehicle"
        return page_product or "Other"
    if insurer == "TIO":
        if re.search(r"caravan", text, re.I):
            return "Caravan & Trailer"
        if re.search(r"motorcycle", text, re.I):
            return "Motorcycle"
        if re.search(r"landlord", text, re.I):
            return "Landlord"
        if re.search(r"home", text, re.I):
            return "Home"
        if re.search(r"business insurance pack", text, re.I):
            return "Business"
        if re.search(r"trades", text, re.I):
            return "Trades & Services"
        if re.search(r"office", text, re.I):
            return "Office"
        if re.search(r"commercial motor", text, re.I):
            return "Commercial Motor"
        if re.search(r"travel", text, re.I):
            return "Travel"
        if re.search(r"car", text, re.I):
            return "Car"
        return page_product or "Other"
    return page_product or "Other"


def title_for(insurer, heading, title, url):
    base = url.split("?")[0].rsplit("/", 1)[-1]
    stem = re.sub(r"\.pdf$", "", base, flags=re.I)
    if insurer == "Budget Direct":
        # Heading names the document; filename often carries a YYYYMMDD date.
        date = re.match(r"(\d{8})", stem)
        out = heading or title
        if date:
            d = date.group(1)
            out = f"{out} ({d[:4]}-{d[4:6]}-{d[6:]})"
        return out
    if insurer == "RAC WA":
        if title and not re.match(r"(?i)^(pds|spds)", title):
            return re.sub(r"\s*\(PDF[^)]*\)\s*$", "", title, flags=re.I)
        kind = "SPDS" if re.search(r"spds|supplementary", stem, re.I) else "PDS & FSG"
        return f"RAC {kind} — {stem}"
    if insurer == "RACT":
        return re.sub(r"\s*\(PDF[^)]*\)\s*$", "", title or heading, flags=re.I)
    return re.sub(r"\s*\(PDF[^)]*\)\s*$", "", title or heading, flags=re.I)


def main():
    out = []
    for insurer, pages in PAGES.items():
        seen = {}
        for page_product, fname, base in pages:
            path = os.path.join(JSONDIR, fname + ".html")
            p = P()
            p.feed(open(path, encoding="utf-8", errors="replace").read())
            for heading, title, href in p.items:
                blob = f"{heading} {title} {href.rsplit('/', 1)[-1]}"
                if not PAT.search(blob) or EXCL.search(blob):
                    continue
                url = href if href.startswith("http") else base + href
                if url in seen:
                    continue
                seen[url] = {
                    "insurer": insurer,
                    "product": product_for(insurer, page_product, heading, title, url),
                    "title": title_for(insurer, heading, title, url),
                    "url": url,
                }
        out.extend(seen.values())
    json.dump(out, open(os.path.join(ROOT, "more2_links.json"), "w"), indent=2)
    from collections import Counter

    print(len(out), Counter(x["insurer"] for x in out))
    for x in out:
        print(f"{x['insurer']:12} | {x['product'][:30]:30} | {x['title'][:80]}")


if __name__ == "__main__":
    main()
