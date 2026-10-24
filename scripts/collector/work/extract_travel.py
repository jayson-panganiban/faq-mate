#!/usr/bin/env python3
"""Extract PDS/SPDS links for Tier 2 travel insurers."""

import json
import os
import re
from html.parser import HTMLParser
from urllib.parse import unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")

PAT = re.compile(r"\bPDS\b|SPDS|product[\s_-]*disclosure|policy wording|[_-]PW[_-]", re.I)
EXCL = re.compile(
    r"target market|\bTMD\b|financial services guide(?!.*\bPDS\b)|"
    r"product design and distribution|family violence|privacy|"
    r"pds update|product disclosure statement update",
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
        key = re.sub(r"^https?://(www\.)?", "", r["url"]).rstrip("/").replace("%20", " ")
        seen.setdefault(key, r)
    return list(seen.values())


def clean_title(t):
    t = re.sub(r"\s*\((?:PDF[^)]*)\)\s*$", "", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip()


MONTHS = {
    m: i
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1
    )
}


def date_from(text):
    m = re.search(r"(20\d{2})[-_ ]?(\d{2})[-_ ]?(\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"(\d{1,2})[-_ ]([A-Za-z]{3,9})[-_ ](20\d{2})", text)
    if m and MONTHS.get(m.group(2)[:3].lower()):
        return f"{m.group(3)}-{MONTHS[m.group(2)[:3].lower()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"([A-Za-z]{3,9})[-_ ](20\d{2})", text)
    if m and MONTHS.get(m.group(1)[:3].lower()):
        return f"{m.group(2)}-{MONTHS[m.group(1)[:3].lower()]:02d}-01"
    m = re.search(r"[_-](\d{2})(\d{2})(\d{2})(?:[_-]|$)", text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mo <= 12:
            return f"20{y:02d}-{mo:02d}-{d:02d}"
    m = re.search(r"[_-](\d{2})(\d{2})(?:[_-]|$)", text)
    if m:
        mo, y = int(m.group(1)), int(m.group(2))
        if 1 <= mo <= 12:
            return f"20{y:02d}-{mo:02d}-01"
    return ""


def main():
    out = []

    # Cover-More
    for h, t, u in items("pd_covermore"):
        url = absurl("https://www.covermore.com.au", u)
        if re.search(r"business", h, re.I):
            prod = "Business"
        elif re.search(r"corporate", h, re.I):
            prod = "Corporate"
        else:
            prod = "Travel"
        out.append(
            {
                "insurer": "Cover-More",
                "product": prod,
                "title": clean_title(t) + (f" — {h}" if h else ""),
                "url": url,
            }
        )

    # Fast Cover
    for h, t, u in items("pd_fastcover"):
        url = absurl("https://www.fastcover.com.au", u)
        stem = unquote(url.rsplit("/", 1)[-1])
        d = date_from(stem)
        out.append(
            {
                "insurer": "Fast Cover",
                "product": "Travel",
                "title": "Fast Cover PDS" + (f" ({d})" if d else ""),
                "url": url,
            }
        )

    # InsureandGo
    for h, t, u in items("pd_insureandgo"):
        blob = f"{t} {u.rsplit('/', 1)[-1]}"
        if EXCL.search(blob):
            continue
        if not PAT.search(blob):
            continue
        stem = unquote(u.rsplit("/", 1)[-1])
        if re.search(r"(^|[_-])ST([_-]|$)|single", blob, re.I):
            prod = "Single Trip"
        elif re.search(r"(^|[_-])CR(S)?([_-]|$)|cruise", blob, re.I):
            prod = "Cruise"
        elif re.search(r"AMT|annual", blob, re.I):
            prod = "Annual Multi-Trip"
        elif re.search(r"(^|[_-])DOM([_-]|$)|domestic", blob, re.I):
            prod = "Domestic"
        elif re.search(r"(^|[_-])OT([_-]|$)|one.?trip", blob, re.I):
            prod = "One-Trip"
        elif re.search(r"BKP|backpack", blob, re.I):
            prod = "Backpacker"
        else:
            prod = "Travel"
        d = date_from(stem)
        title = clean_title(t) if t and len(t) > 3 else f"InsureandGo {prod} PDS / Policy Wording"
        if d and d not in title:
            title += f" ({d})"
        out.append(
            {
                "insurer": "InsureandGo",
                "product": prod,
                "title": title,
                "url": absurl("https://www.insureandgo.com.au", u),
            }
        )

    # 1Cover: current, the two policy-wording pages, and the previous-documents list.
    out.append(
        {
            "insurer": "1Cover",
            "product": "Travel",
            "title": "1Cover Standard PDS (2026-03-04)",
            "url": "https://1cover.com.au/assets/pdf/1Cover-AU-Standard-PDS_20260304.pdf",
        }
    )
    for d in ("20250725", "20241219"):
        for h, t, u in items("1cover_" + d):
            out.append(
                {
                    "insurer": "1Cover",
                    "product": "Travel",
                    "title": f"1Cover Standard PDS ({d[:4]}-{d[4:6]}-{d[6:]})",
                    "url": absurl("https://www.1cover.com.au", u),
                }
            )
    for h, t, u in items("1cover_prev"):
        if not re.search(r"\.pdf", u, re.I):
            continue
        d = date_from(t + " " + u)
        prod = "Ski" if re.search(r"ski", u, re.I) else "Travel"
        out.append(
            {
                "insurer": "1Cover",
                "product": prod,
                "title": f"1Cover {prod} PDS" + (f" ({d})" if d else ""),
                "url": absurl("https://www.1cover.com.au", u),
            }
        )

    # TID: the PDS endpoint serves the current PDS directly.
    out.append(
        {
            "insurer": "Travel Insurance Direct",
            "product": "Travel",
            "title": "Travel Insurance Direct PDS (current)",
            "url": "https://cft-onex-api.agaassistance.com.au/api/document/pds/tid/",
        }
    )

    # SCTI
    for h, t, u in items("pd_scti"):
        blob = f"{t} {u.rsplit('/', 1)[-1]}"
        if EXCL.search(blob) or not re.search(r"PDS|SPDS|product[\s_-]*disclosure", blob, re.I):
            continue
        prod = (
            "TravelCare" if re.search(r"travelcare", blob, re.I) else "International Comprehensive"
        )
        d = date_from(t + " " + u)
        title = clean_title(t)
        out.append(
            {
                "insurer": "Southern Cross Travel Insurance",
                "product": prod,
                "title": title,
                "url": absurl("https://www.scti.com.au", u),
            }
        )

    # Zoom
    out.append(
        {
            "insurer": "Zoom",
            "product": "Travel",
            "title": "Zoom Standard PDS (2026-03-04)",
            "url": "https://zoomtravelinsurance.com.au/pdf/pds/Zoom-AU-Standard-PDS_20260304.pdf",
        }
    )
    for h, t, u in items("pd_zoom"):
        if not re.search(r"standard-pds", u, re.I):
            continue
        d = date_from(t + " " + u)
        out.append(
            {
                "insurer": "Zoom",
                "product": "Travel",
                "title": "Zoom Standard PDS" + (f" ({d})" if d else ""),
                "url": absurl("https://www.zoomtravelinsurance.com.au", u),
            }
        )

    # Go Insurance
    for h, t, u in items("pd_goinsurance"):
        stem = unquote(u.rsplit("/", 1)[-1])
        if re.search(r"ultra", stem, re.I):
            prod = "Go Ultra"
        elif re.search(r"group", stem, re.I):
            prod = "Group Travel"
        elif re.search(r"corporate", stem, re.I):
            prod = "Corporate Travel"
        elif re.search(r"inbound", stem, re.I):
            prod = "Inbound Travel"
        elif re.search(r"dental", stem, re.I):
            prod = "Dental Tourism"
        elif re.search(r"wedding", stem, re.I):
            prod = "Destination Wedding"
        elif re.search(r"sailing", stem, re.I):
            prod = "Sailing"
        elif re.search(r"leisure", stem, re.I):
            prod = "Leisure Travel"
        else:
            prod = "Travel"
        d = date_from(stem)
        title = clean_title(h) if h and not re.search(r"find the pds", h, re.I) else prod + " PDS"
        if d and d not in title:
            title += f" ({d})"
        out.append(
            {
                "insurer": "Go Insurance",
                "product": prod,
                "title": title,
                "url": absurl("https://goinsurance.com.au", u),
            }
        )

    out = dedupe(out)
    json.dump(out, open(os.path.join(ROOT, "travel_links.json"), "w"), indent=2)
    from collections import Counter

    print(len(out), Counter(x["insurer"] for x in out))
    for x in out:
        print(f"{x['insurer'][:30]:30} | {x['product'][:24]:24} | {x['title'][:70]}")


if __name__ == "__main__":
    main()
