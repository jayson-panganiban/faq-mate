#!/usr/bin/env python3
"""Run FAQ crawls for insurers whose FAQ pages are server-rendered."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crawl_faqs import crawl, load_urls

CRAWLS = {
    "APIA": {
        "regex": r"/faqs/",
        "extra": ["https://www.apia.com.au/faqs.html"],
    },
    "GIO": {
        "regex": r"/faqs/",
        "extra": ["https://www.gio.com.au/faqs.html"],
    },
    "Suncorp": {
        "regex": r"/insurance/faqs/",
        "extra": ["https://www.suncorp.com.au/insurance/faqs.html"],
    },
    "Budget Direct": {
        "regex": r"/(car-insurance|home-contents-insurance|travel-insurance|life-insurance|motorcycle-insurance|roadside-assistance-australia)/[^/]*(faqs|faq)(/|\.html|$)",
    },
    "NEOS": {
        "regex": r"/faqs/",
    },
    "1Cover": {
        "regex": r"/faqs/",
    },
    "RACQ": {
        "regex": r"/help-contact/insurance",
        "extra": ["https://www.racq.com.au/hidden/insurance-faqs"],
    },
    "RACV": {
        "regex": r"/help-and-support/",
    },
    "RAA": {
        "regex": r"/help-centre/insurance-support/",
    },
    "RACT": {
        "regex": r"^$",
        "extra": [
            "https://www.ract.com.au/insurance-and-finance/insurance-claims/insurance-claims-faqs",
        ],
    },
    "CGU": {
        "extra": [
            "https://www.cgu.com.au/claims/claims-faq",
            "https://www.cgu.com.au/help-and-support",
        ],
    },
    "Cover-More": {
        "regex": r"^$",
        "extra": [
            "https://www.covermore.com.au/frequently-asked-questions",
            "https://www.covermore.com.au/refund-faqs",
        ],
    },
    "ClearView": {
        "regex": r"^$",
        "extra": [
            "https://www.clearview.com.au/faq",
            "https://www.clearview.com.au/making-a-claim/frequently-asked-questions",
        ],
    },
    "PPS Mutual": {
        "regex": r"^$",
        "extra": ["https://www.ppsmutual.com.au/faqs/"],
    },
    "RAC WA": {
        "extra": ["https://rac.com.au/faq"],
    },
    "AAMI": {
        "regex": r"/emergency-response/faqs|/contact/help-and-support",
    },
    "Zurich": {
        "regex": r"^$",
        "extra": [
            "https://www.zurich.com.au/home-loan-protection/faqs",
            "https://www.zurich.com.au/insuremytesla/faqs",
            "https://www.zurich.com.au/life-insurance/eofyfaq",
        ],
    },
    "TAL": {
        "regex": r"^$",
        "extra": [
            "https://www.tal.com.au/tools-and-faqs/insurance-faqs",
        ],
    },
    "Challenger": {
        "regex": r"^$",
        "extra": [
            "https://www.challenger.com.au/individual/help-and-support/frequently-asked-questions",
            "https://www.challenger.com.au/adviser/adviser-resources/Adviser-FAQs",
            "https://www.challenger.com.au/adviser/knowledge-hub/Articles/Aged-Care-reforms-FAQs",
            "https://www.challenger.com.au/adviser/knowledge-hub/Articles/Aged-care-questions-youve-asked-in-2024",
            "https://www.challenger.com.au/adviser/knowledge-hub/Articles/Home-care-reforms-FAQ",
            "https://www.challenger.com.au/adviser/knowledge-hub/Articles/Residential-care-reforms-FAQ",
        ],
    },
    "AIA": {
        "regex": r"/en/help-and-support",
    },
}


def main():
    only = sys.argv[1:]
    for ins, cfg in CRAWLS.items():
        if only and ins not in only:
            continue
        urls = load_urls(ins, cfg.get("regex")) + cfg.get("extra", [])
        # dedupe
        seen = set()
        urls = [u for u in urls if not (u in seen or seen.add(u))]
        if not urls:
            print(f"### {ins}: no urls", flush=True)
            continue
        print(f"### {ins}: {len(urls)} urls", flush=True)
        crawl(ins, urls, workers=12)


if __name__ == "__main__":
    main()
