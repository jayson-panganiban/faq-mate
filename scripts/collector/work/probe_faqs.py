#!/usr/bin/env python3
"""Probe insurer sites for FAQ / help pages."""

import concurrent.futures
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
OUT = os.path.join(JSONDIR, "faq_pages")
os.makedirs(OUT, exist_ok=True)

SITES = {
    "1Cover": "1cover.com.au",
    "AAMI": "aami.com.au",
    "AIA": "aia.com.au",
    "APIA": "apia.com.au",
    "Acenda": "acenda.com.au",
    "Allianz": "allianz.com.au",
    "Asteron Life": "asteronlife.com.au",
    "Bingle": "bingle.com.au",
    "Budget Direct": "budgetdirect.com.au",
    "CGU": "cgu.com.au",
    "Challenger": "challenger.com.au",
    "ClearView": "clearview.com.au",
    "Cover-More": "covermore.com.au",
    "Fast Cover": "fastcover.com.au",
    "GIO": "gio.com.au",
    "Go Insurance": "goinsurance.com.au",
    "HCF Life": "hcf.com.au",
    "InsureandGo": "insureandgo.com.au",
    "MetLife": "metlife.com.au",
    "NEOS": "neosprotect.com.au",
    "NRMA": "nrma.com.au",
    "NobleOak": "nobleoak.com.au",
    "PPS Mutual": "ppsmutual.com.au",
    "QBE": "qbe.com.au",
    "RAA": "raa.com.au",
    "RAC WA": "rac.com.au",
    "RACQ": "racq.com.au",
    "RACT": "ract.com.au",
    "RACV": "racv.com.au",
    "Shannons": "shannons.com.au",
    "Southern Cross Travel Insurance": "scti.com.au",
    "Suncorp": "suncorp.com.au",
    "TAL": "tal.com.au",
    "TIO": "tio.com.au",
    "Travel Insurance Direct": "travelinsurancedirect.com.au",
    "Vero": "vero.com.au",
    "Youi": "youi.com.au",
    "Zoom": "zoomtravelinsurance.com.au",
    "Zurich": "zurich.com.au",
}

PATHS = [
    "/faqs",
    "/faq",
    "/frequently-asked-questions",
    "/frequently-asked-questions/",
    "/help",
    "/help/",
    "/support",
    "/support/",
    "/contact-us/faqs",
    "/contact-us/faq",
    "/contact/faqs",
    "/customer-service/faqs",
    "/help-and-support",
    "/help-and-support/faqs",
    "/about-us/faqs",
    "/insurance/faqs",
    "/insurance/faq",
    "/car-insurance/faqs",
    "/home-insurance/faqs",
    "/travel-insurance/faqs",
    "/life-insurance/faqs",
    "/pet-insurance/faqs",
    "/business-insurance/faqs",
    "/claims/faqs",
    "/faqs/",
    "/faq/",
    "/en/faqs",
    "/en/faq",
]

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def slug(u):
    return re.sub(r"[^a-z0-9]+", "-", u.lower()).strip("-")[:90]


def fetch(item):
    insurer, url = item
    try:
        p = subprocess.run(
            [
                "curl",
                "-sSL",
                "--max-time",
                "20",
                "--compressed",
                "-A",
                UA,
                "-o",
                "-",
                "-w",
                "\n__CODE__%{http_code}__URL__%{url_effective}",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=25,
        )
        body, _, meta = p.stdout.rpartition("\n__CODE__")
        code = meta.split("__URL__")[0] if "__URL__" in meta else "0"
        final = meta.split("__URL__")[-1].strip() if "__URL__" in meta else url
        if code != "200" or len(body) < 800:
            return {
                "insurer": insurer,
                "url": url,
                "status": code,
                "final": final,
                "bytes": len(body),
                "title": "",
                "hits": 0,
            }
        m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
        title = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
        low = body.lower()
        hits = low.count("faq") + low.count("frequently asked") + low.count("question")
        if code == "200":
            fn = os.path.join(OUT, f"{insurer.replace(' ', '_')}__{slug(final)}.html")
            open(fn, "w", encoding="utf-8").write(body)
        return {
            "insurer": insurer,
            "url": url,
            "status": code,
            "final": final,
            "bytes": len(body),
            "title": title[:120],
            "hits": hits,
        }
    except Exception as e:
        return {
            "insurer": insurer,
            "url": url,
            "status": "ERR",
            "final": url,
            "bytes": 0,
            "title": str(e)[:80],
            "hits": 0,
        }


items = []
for ins, host in SITES.items():
    for path in PATHS:
        items.append((ins, f"https://www.{host}{path}"))

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
    for r in ex.map(fetch, items):
        results.append(r)

json.dump(results, open(os.path.join(JSONDIR, "faq_probe.json"), "w"), indent=2)
ok = [r for r in results if r["status"] == "200"]
print("probes", len(results), "200s", len(ok))
for r in sorted(ok, key=lambda r: (r["insurer"], -r["hits"])):
    print(f"{r['insurer'][:30]:30} hits={r['hits']:4} {r['bytes']:7}B  {r['final'][:95]}")
