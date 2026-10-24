#!/usr/bin/env python3
"""Find FAQ/help URLs from each insurer's sitemap."""

import concurrent.futures
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

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


def get(url, timeout=20):
    try:
        p = subprocess.run(
            ["curl", "-sSL", "--max-time", str(timeout), "--compressed", "-A", UA, url],
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        return p.stdout
    except Exception:
        return ""


def locs(xml):
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml, re.I)


def crawl(host):
    urls = []
    for path in (
        "/sitemap.xml",
        "/sitemap_index.xml",
        "/sitemap-index.xml",
        "/sitemap1.xml",
        "/sitemap.xml?page=1",
    ):
        xml = get(f"https://www.{host}{path}")
        if "<loc>" in xml:
            found = locs(xml)
            urls.extend(found)
            # follow child sitemaps
            children = [u for u in found if u.endswith(".xml") or "sitemap" in u.lower()]
            for child in children[:12]:
                if child.rstrip("/") == f"https://www.{host}{path}".rstrip("/"):
                    continue
                sub = get(child)
                if "<loc>" in sub:
                    urls.extend(locs(sub))
            break
    # robots.txt fallback
    if not urls:
        robots = get(f"https://www.{host}/robots.txt")
        for u in re.findall(r"(?im)^sitemap:\s*(\S+)", robots):
            xml = get(u)
            urls.extend(locs(xml))
            for child in [x for x in locs(xml) if "sitemap" in x.lower()][:12]:
                urls.extend(locs(get(child)))
    return urls


def main():
    out = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(crawl, h): ins for ins, h in SITES.items()}
        for f in concurrent.futures.as_completed(futs):
            ins = futs[f]
            try:
                urls = f.result()
            except Exception:
                urls = []
            hits = sorted(
                {u for u in urls if re.search(r"faq|frequently|question|help|support", u, re.I)}
            )
            out[ins] = hits
            print(f"===== {ins} ({len(urls)} urls, {len(hits)} hits)")
            for u in hits[:25]:
                print("  ", u)
    json.dump(out, open(os.path.join(JSONDIR, "faq_sitemaps.json"), "w"), indent=2)


if __name__ == "__main__":
    main()
