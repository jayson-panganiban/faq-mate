#!/usr/bin/env python3
"""Extract PDS/SPDS PDF links from saved Suncorp-brand policy document pages."""

import json
import os
import re
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")

PAGES = {
    "AAMI": [
        ("Comprehensive Car", "aami_comprehensive"),
        ("Third Party Car", "aami_thirdparty"),
        ("CTP", "aami_ctp"),
        ("Home Building", "aami_homebuilding"),
        ("Home Contents", "aami_homecontents"),
        ("Fire & Theft Contents", "aami_firetheft"),
        ("Landlord", "aami_landlord"),
        ("Strata", "aami_strata"),
        ("Business", "aami_businessins"),
        ("Market Stalls", "aami_marketstalls"),
        ("Business Home", "aami_businesshome"),
        ("Commercial Motor", "aami_commmotor"),
        ("Life", "aami_lifeins"),
        ("Life Express", "aami_lifeexpress"),
        ("Income Protection", "aami_income"),
        ("Bill Protect", "aami_billprotect"),
        ("Accidental Injury", "aami_accinjury"),
        ("Health", "aami_health"),
        ("Motorcycle", "aami_moto"),
        ("Caravan", "aami_caravan"),
        ("Pet", "aami_pet"),
    ],
    "GIO": [
        ("Car", "gio_car-insurance"),
        ("Home & Contents", "gio_home-contents"),
        ("Landlord", "gio_landlord-insurance"),
        ("Strata", "gio_strata-insurance"),
        ("CTP", "gio_ctp-insurance"),
        ("MAI", "gio_mai-insurance"),
        ("Caravan", "gio_caravan-insurance"),
        ("Motorcycle", "gio_motorcycle-insurance"),
        ("Boat", "gio_boat-insurance"),
        ("Business", "gio_business-insurance-policy-docs"),
        ("Life Protect", "gio_life-protect"),
        ("Accidental Injury", "gio_accidental-injury"),
        ("Accidental Death", "gio_accidental-death"),
        ("Bill Protect", "gio_bill-protect"),
        ("Funeral", "gio_funeral-insurance"),
        ("Workers Compensation", "gio_workers-compensation-policy-docs"),
    ],
    "APIA": [
        ("Car", "apia_car2"),
        ("Landlord", "apia_landlord-insurance"),
        ("Home Contents", "apia_home-and-contents-insurance"),
        ("Apartment", "apia_apartment-insurance"),
        ("Village", "apia_village-insurance"),
        ("Assisted Living", "apia_assisted-living-insurance"),
        ("CTP & MAI", "apia_ctp"),
        ("Health", "apia_health2"),
        ("Funeral", "apia_funeral2"),
    ],
    "Shannons": [("", "shannons")],
    "Bingle": [
        ("Comprehensive Car", "bingle_car"),
        ("Third Party Car", "bingle_tp"),
        ("Other", "bingle_other"),
    ],
}

PAT = re.compile(r"\bPDS\b|SPDS|product disclosure|supplementary product disclosure", re.I)
EXCL = re.compile(
    r"update pursuant|additional information|target market|\bTMD\b|premium excess|"
    r"\bPED\b|key fact|\bKFS\b|roadside|product development|terms and conditions|"
    r"pds update|product disclosure statement update|customer info booklet|"
    r"financial services guide(?!.*\bPDS\b)",
    re.I,
)

REASSIGN = [
    (r"assisted.living", "Assisted Living"),
    (r"\bvillage\b", "Village"),
    (r"apartment", "Apartment"),
    (r"landlord", "Landlord"),
    (r"strata", "Strata"),
    (r"motorhome", "Motorhome"),
    (r"caravan", "Caravan"),
    (r"motorcycle", "Motorcycle"),
    (r"\bboat\b|marine", "Boat"),
    (r"commercial.motor", "Commercial Motor"),
    (r"motor (insurance|vehicle)", "Motor"),
    (r"home.build|building", "Home Building"),
    (r"fire.?(and|&)?.?theft", "Fire & Theft Contents"),
    (r"home.?(and|&)?.?contents|contents", "Home Contents"),
    (r"business.?at.?home|businessathome", "Business Home"),
    (r"commercial.motor", "Commercial Motor"),
    (r"market.stall", "Market Stalls"),
    (r"workers.?comp", "Workers Compensation"),
    (r"life.express", "Life Express"),
    (r"income.protection", "Income Protection"),
    (r"bill.protect", "Bill Protect"),
    (r"accidental.injury", "Accidental Injury"),
    (r"accidental.death", "Accidental Death"),
    (r"funeral", "Funeral"),
    (r"\bpet\b|best.in.show", "Pet"),
    (r"\blife\b", "Life"),
    (r"\bbusiness\b", "Business"),
]


def reassign(product, text):
    for pat, name in REASSIGN:
        if re.search(pat, text, re.I):
            return name
    return product


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.h = ""
        self.cur = None
        self.buf = []
        self.a = None
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag in ("h2", "h3", "h4", "h5"):
            self.cur = tag
            self.buf = []
        elif tag == "a":
            self.a = [dict(attrs).get("href", ""), []]

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "h4", "h5") and self.cur == tag:
            self.h = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            self.cur = None
        elif tag == "a" and self.a:
            href, txt = self.a
            if ".pdf" in href.lower():
                self.items.append(
                    {
                        "heading": self.h,
                        "title": re.sub(r"\s+", " ", "".join(txt)).strip(),
                        "url": href,
                    }
                )
            self.a = None

    def handle_data(self, d):
        if self.cur:
            self.buf.append(d)
        if self.a is not None:
            self.a[1].append(d)


def main():
    out = []
    for insurer, pages in PAGES.items():
        seen = {}
        for product, fname in pages:
            p = P()
            p.feed(
                open(
                    os.path.join(JSONDIR, f"{fname}.html"), encoding="utf-8", errors="replace"
                ).read()
            )
            for it in p.items:
                blob = " ".join([it["title"], it["url"].rsplit("/", 1)[-1]])
                if not PAT.search(blob):
                    continue
                if EXCL.search(blob):
                    continue
                url = it["url"]
                if url.startswith("/"):
                    url = "https://www." + insurer.lower() + ".com.au" + url
                key = url
                title = it["title"]
                if (
                    not title
                    or title.startswith(("/", "http"))
                    or title.lower().startswith(("download", "click here", "view pdf"))
                    or title.lower() in ("view", "pdf", "pds")
                ):
                    title = re.sub(r"[-_]", " ", url.rsplit("/", 1)[-1].rsplit(".", 1)[0])
                    title = re.sub(r"\s+", " ", title).strip().title()
                title = re.sub(r"\s*\((?:PDF[^)]*)\)\s*$", "", title, flags=re.I)
                title = re.sub(r"\s*\|\s*\d+(?:\.\d+)?\s*[KMG]B\s*$", "", title, flags=re.I)
                title = re.sub(r"\s+", " ", title).strip()
                if key in seen:
                    if len(title) > len(seen[key]["title"]):
                        seen[key]["title"] = title
                else:
                    fname = url.rsplit("/", 1)[-1]
                    prod = reassign(product, f"{title} {fname} {it['heading']}")
                    seen[key] = {
                        "insurer": insurer,
                        "product": prod or it["heading"] or "General",
                        "title": title,
                        "url": url,
                    }
        out.extend(seen.values())
        print(insurer, len(seen))
    json.dump(out, open(os.path.join(ROOT, "suncorp_links.json"), "w"), indent=2)
    for d in out:
        print(f"{d['insurer']:9} | {d['product'][:28]:28} | {d['title'][:80]}")


if __name__ == "__main__":
    main()
