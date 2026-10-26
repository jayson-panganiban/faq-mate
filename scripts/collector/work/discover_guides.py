#!/usr/bin/env python3
"""Discover curated informational guide URLs from an insurer's sitemap.

Reads a sitemap (or sitemap index), keeps product / cover / claims / policy
servicing pages, drops blog, marketing, quote, form and legal pages, then writes
one seed CSV per insurer for ``crawl_guides.py``.

This is a discovery aid, not a crawler: the resulting seeds are reviewed before
anything is fetched.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import warnings
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
SEEDS_DIR = os.path.join(ROOT, "guide_seeds")

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 FAQMateCorpus/1.0"
)

# insurer -> (primary domain, category)
INSURERS = {
    "1Cover": ("www.1cover.com.au", "travel"),
    "AIA": ("www.aia.com.au", "life"),
    "AAMI": ("www.aami.com.au", "suncorp-group"),
    "APIA": ("www.apia.com.au", "suncorp-group"),
    "Acenda": ("www.acenda.com.au", "life"),
    "Allianz": ("www.allianz.com.au", "major-insurers"),
    "Asteron Life": ("asteronlife.com.au", "life"),
    "Bingle": ("www.bingle.com.au", "suncorp-group"),
    "Budget Direct": ("www.budgetdirect.com.au", "major-insurers"),
    "CGU": ("www.cgu.com.au", "iag"),
    "Challenger": ("www.challenger.com.au", "life"),
    "ClearView": ("www.clearview.com.au", "life"),
    "Cover-More": ("www.covermore.com.au", "travel"),
    "Fast Cover": ("fastcover.com.au", "travel"),
    "GIO": ("www.gio.com.au", "suncorp-group"),
    "Go Insurance": ("www.goinsurance.com.au", "travel"),
    "HCF Life": ("www.hcf.com.au", "life"),
    "InsureandGo": ("www.insureandgo.com.au", "travel"),
    "MetLife": ("www.metlife.com.au", "life"),
    "NEOS": ("www.neosprotect.com.au", "life"),
    "NRMA": ("www.nrma.com.au", "iag"),
    "NobleOak": ("www.nobleoak.com.au", "life"),
    "PPS Mutual": ("www.ppsmutual.com.au", "life"),
    "QBE": ("www.qbe.com", "major-insurers"),
    "RAA": ("www.raa.com.au", "motor-clubs"),
    "RACQ": ("www.racq.com.au", "motor-clubs"),
    "RACT": ("www.ract.com.au", "motor-clubs"),
    "RACV": ("www.racv.com.au", "motor-clubs"),
    "RAC WA": ("rac.com.au", "motor-clubs"),
    "Shannons": ("www.shannons.com.au", "suncorp-group"),
    "Southern Cross Travel Insurance": ("www.scti.com.au", "travel"),
    "Suncorp": ("www.suncorp.com.au", "suncorp-group"),
    "TAL": ("www.tal.com.au", "life"),
    "TIO": ("www.tiofi.com.au", "major-insurers"),
    "Travel Insurance Direct": ("www.travelinsurancedirect.com.au", "travel"),
    "Vero": ("www.vero.com.au", "suncorp-group"),
    "Youi": ("www.youi.com.au", "major-insurers"),
    "Zoom": ("www.zoomtravelinsurance.com.au", "travel"),
    "Zurich": ("www.zurich.com.au", "major-insurers"),
}

EXCLUDE = re.compile(
    r"(?:"
    r"/blog|/news|/media|/article|/insights|/stories|/press|/announcement|"
    r"/hub|/know-more|-good-life|/good-life|/learn|/resources?|/guides?/|/advice|"
    r"/about|/career|/job|/investor|/contact|/quote|/quotes|[-_]quotes?|"
    r"/get-a-quote|/find-a-quote|"
    r"/login|/sign-in|/signin|/my-account|/my-policy|/myaccount|/portal|/secure/|"
    r"/search|/sitemap|/pds|/spds|/policy-document|/policy-wording|/tmd|"
    r"/target-market|/forms?|/calculator|/review|/competition|/prize|"
    r"/sponsor|/community|/sustainab|/privacy|/terms|/cookie|/accessib|"
    r"/modern-slavery|/security|/fraud|/feedback|/complaint|/legal|"
    r"/disclaimer|/branch|/store|/agent|/broker|/help|/faq|/support|"
    r"/glossary|/media-centre|/corporate|/shareholder|/annual-report|"
    r"/diversity|/governance|/foundation|/grants|/scholarship|/campaign|"
    r"/references|/treasury|/customer-reviews?|/testimonial|"
    r"customer-reviews?|car-all-reviews|claims-reviews|"
    r"/(?:nsw|vic|qld|wa|sa|tas|act|nt)(?:/|$)|"
    r"/(?:new-south-wales|victoria|queensland|south-australia|western-australia|"
    r"northern-territory|tasmania|australian-capital-territory)(?:/|\.|$)|"
    r"/careers?/|/wps/|/wp-content|/assets?/|/tag/|/author/|/category/"
    r")",
    re.I,
)

EXCLUDE_EXT = re.compile(
    r"\.(?:pdf|jpg|jpeg|png|gif|svg|zip|docx?|xlsx?|mp4|xml|json|css|js)$", re.I
)

INCLUDE = re.compile(
    r"(?:insurance|insure|cover|claim|excess|landlord|tenant|strata|contents|"
    r"building|funeral|pet|travel|life|income|trauma|tpd|business|home|car|"
    r"motor|boat|caravan|policy|benefit|protection|superannuation|retirement)",
    re.I,
)

BOOST = [
    (re.compile(r"/claims?(?:/|$)", re.I), 6),
    (re.compile(r"/excess", re.I), 5),
    (re.compile(r"what(?:-|_)is|what-is", re.I), 4),
    (re.compile(r"landlord|strata|flood|storm|bushfire", re.I), 4),
    (re.compile(r"contents|building", re.I), 3),
    (re.compile(r"cover", re.I), 3),
    (re.compile(r"policy", re.I), 2),
    (re.compile(r"insurance", re.I), 2),
]

DROP_IF_LAST = re.compile(r"/(?:index|home|landing|default|overview)\.?s?html?$", re.I)


def fetch(url, session, timeout=25):
    try:
        resp = session.get(url, timeout=timeout, headers={"User-Agent": UA})
        if resp.status_code == 200:
            return resp.text
    except requests.RequestException:
        pass
    return ""


def parse_robots(domain, session):
    text = fetch(f"https://{domain}/robots.txt", session)
    delay = 1.0
    disallow = []
    sitemaps = []
    in_wildcard = False
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            in_wildcard = value == "*"
        elif key == "crawl-delay" and in_wildcard:
            try:
                delay = max(delay, float(value))
            except ValueError:
                pass
        elif key == "disallow" and in_wildcard and value:
            disallow.append(value)
        elif key == "sitemap" and value:
            sitemaps.append(value)
    return delay, disallow, sitemaps


def sitemap_urls(domain, session, seeds, limit=60):
    """Walk sitemap indexes breadth-first and return every <loc>."""
    queue = [urljoin(f"https://{domain}/", seed) for seed in seeds]
    if not queue:
        for candidate in (
            f"https://{domain}/sitemap.xml",
            f"https://{domain}/sitemap_index.xml",
            f"https://{domain}/sitemap-index.xml",
        ):
            queue.append(candidate)
    seen = set()
    urls = []
    fetched = 0
    while queue and fetched < limit:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        fetched += 1
        text = fetch(url, session)
        if not text:
            continue
        if "<sitemapindex" in text[:2000].lower():
            soup = BeautifulSoup(text, "html.parser")
            for loc in soup.find_all("loc"):
                child = loc.get_text(strip=True)
                if child and child not in seen:
                    queue.append(child)
            continue
        soup = BeautifulSoup(text, "html.parser")
        for loc in soup.find_all("loc"):
            value = loc.get_text(strip=True)
            if value:
                urls.append(value)
    return urls


def normalize_url(url):
    # A few sitemaps emit a doubled scheme ("https://https://host/path").
    url = re.sub(r"^(https?)://\1://", r"\1://", url.strip())
    parsed = urlparse(url)
    path = re.sub(r"/{2,}", "/", parsed.path)
    path = path.rstrip("/") or "/"
    return urlunparse((parsed.scheme, parsed.netloc.lower(), path, "", "", ""))


def allowed(path, disallow):
    for rule in disallow:
        if rule == "/":
            return False
        if path == rule or path.startswith(rule.rstrip("/") + "/"):
            return False
        if "*" in rule:
            pattern = re.escape(rule).replace(r"\*", ".*")
            if re.match(pattern, path):
                return False
    return True


def score(url):
    parsed = urlparse(url)
    path = parsed.path
    total = 0
    for pattern, weight in BOOST:
        if pattern.search(path):
            total += weight
    depth = len([part for part in path.split("/") if part])
    total -= max(0, depth - 2)
    total -= len(path) / 120.0
    return total


def discover(name, domain, session, cap):
    delay, disallow, sitemaps = parse_robots(domain, session)
    urls = sitemap_urls(domain, session, sitemaps)
    if not urls:
        return delay, []
    candidates = {}
    for raw in urls:
        url = normalize_url(raw)
        parsed = urlparse(url)
        if parsed.netloc.lower() not in {domain, f"www.{domain}"}:
            continue
        path = parsed.path
        if EXCLUDE_EXT.search(path) or EXCLUDE.search(path):
            continue
        if DROP_IF_LAST.search(path):
            continue
        if not INCLUDE.search(path):
            continue
        if not allowed(path, disallow):
            continue
        candidates[url] = score(url)
    ranked = sorted(candidates, key=lambda u: (-candidates[u], len(u)))
    return delay, ranked[:cap]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--insurer", action="append", default=[])
    parser.add_argument("--cap", type=int, default=14)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--show", action="store_true")
    args = parser.parse_args()

    targets = args.insurer or list(INSURERS)
    session = requests.Session()
    summary = []
    for name in targets:
        if name not in INSURERS:
            print(f"unknown insurer: {name}", file=sys.stderr)
            continue
        domain, category = INSURERS[name]
        delay, ranked = discover(name, domain, session, args.cap)
        summary.append((name, domain, delay, ranked))
        print(f"\n### {name} ({domain}) delay={delay} candidates={len(ranked)}")
        for url in ranked:
            print("  ", url)
        if args.write and ranked:
            path = os.path.join(SEEDS_DIR, f"{slug(name)}.csv")
            with open(path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(["insurer", "url", "product", "category"])
                for url in ranked:
                    product = urlparse(url).path.strip("/").split("/")[-1]
                    product = re.sub(r"\.html?$", "", product)
                    product = re.sub(r"[-_]+", " ", product).strip().title()
                    writer.writerow([name, url, product or "Insurance", category])
            print(f"  -> wrote {path}")
        time.sleep(max(1.0, delay))

    if args.write:
        with open(os.path.join(ROOT, "guide_discovery.json"), "w", encoding="utf-8") as handle:
            json.dump(
                [
                    {"insurer": n, "domain": d, "delay": delay, "urls": urls}
                    for n, d, delay, urls in summary
                ],
                handle,
                indent=2,
            )


if __name__ == "__main__":
    main()
