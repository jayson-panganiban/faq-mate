#!/usr/bin/env python3
"""Build the FAQs/ markdown archive from faq_json/*.json."""

import json
import os
import re
from collections import OrderedDict
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from markdownify import markdownify

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
OUTDIR = os.path.join(ROOT, "FAQs")
RETRIEVED = "24 October 2026"

INSURERS = [
    "1Cover",
    "AAMI",
    "AIA",
    "Allianz",
    "APIA",
    "Acenda",
    "Asteron Life",
    "Bingle",
    "Budget Direct",
    "CGU",
    "Challenger",
    "ClearView",
    "Cover-More",
    "Fast Cover",
    "GIO",
    "Go Insurance",
    "HCF Life",
    "InsureandGo",
    "MetLife",
    "NEOS",
    "NRMA",
    "NobleOak",
    "PPS Mutual",
    "QBE",
    "RAA",
    "RACQ",
    "RACT",
    "RACV",
    "RAC WA",
    "Shannons",
    "Southern Cross Travel Insurance",
    "Suncorp",
    "TAL",
    "Travel Insurance Direct",
    "Vero",
    "Youi",
    "Zoom",
    "Zurich",
    "TIO",
]

GRAPHQL = (
    "https://www.bingle.com.au/graphql/execute.json/"
    "aeminsuranceeds/FAQListSortable;tag=insurance"
)

NOTES = {
    "Acenda": (
        "No dedicated FAQ page was found. Six Q&As were extracted from "
        "Acenda's customer support pages (top support requests and "
        "identity-theft guidance)."
    ),
    "Allianz": (
        "Allianz has no working /faqs page. Q&As were extracted from "
        "the help-and-contact page and the car, home, life and business "
        "product FAQ sections."
    ),
    "Asteron Life": (
        "Sixteen claims Q&As were extracted from the public claims "
        "FAQ page. The adviser FAQ host returns 403/TLS errors and "
        "the old /faqs path is a 404."
    ),
    "Bingle": (
        "Bingle's FAQ page is rendered from an AEM GraphQL endpoint rather "
        "than static HTML. The Q&As below were extracted from that "
        "endpoint."
    ),
    "AAMI": (
        "AAMI has no general FAQ page. Its Q&As were extracted from the "
        "shared Suncorp AEM FAQ GraphQL endpoint used by Bingle; the "
        "content covers motor, home, business, pet, life/income and "
        "general topics."
    ),
    "Shannons": (
        "Shannons has no general FAQ page. Its Q&As were extracted from "
        "the shared Suncorp AEM FAQ GraphQL endpoint used by Bingle."
    ),
    "Fast Cover": (
        "Fast Cover's /faq page is a link hub. The Q&As below were "
        "crawled from 1,869 individual /faq/ pages."
    ),
    "Southern Cross Travel Insurance": (
        "The main /faqs page provides 10 Q&As. Individual FAQ URLs listed in the "
        "sitemap return blank/404 pages, so only the main page is included."
    ),
    "Travel Insurance Direct": (
        "Only eight Q&As were available on the current homepage. Legacy "
        "/customer-service FAQ pages redirect to nib.travelinsurancedirect.com.au "
        "or return 404."
    ),
    "Vero": (
        "No public consumer FAQ page was found. Vero distributes through "
        "brokers; its public help/support pages cover domestic and family "
        "violence, financial hardship and additional resources, but do not "
        "publish a Q&A FAQ."
    ),
    "Youi": (
        "No dedicated public FAQ page was found. Youi publishes car, home "
        "and motorcycle articles and guides, including a 'Top 5 questions "
        "about motorcycle insurance' article, but no general FAQ Q&A page."
    ),
    "TIO": (
        "No public FAQ page was found on tiofi.com.au. TIO publishes "
        "customer support and contact pages, but no Q&A FAQ."
    ),
    "NRMA": ("NRMA's /faq page provides 11 Q&As across the visible categories."),
    "HCF Life": (
        "Q&As were extracted from the Recover Cover FAQ page, where "
        "questions are published as bold paragraph leads."
    ),
    "QBE": (
        "QBE has no working /faqs page. Q&As were extracted from the car, "
        "home, claims and workers compensation FAQ pages."
    ),
    "MetLife": ("Q&As were extracted from the MetLife Australia resources/faqs " "page."),
    "RACT": (
        "Only the insurance claims FAQ page is included; RACT's driving "
        "lesson, online booking and P1 assessment FAQs are out of scope."
    ),
    "RAA": ("Q&As were extracted from RAA's insurance-support help centre pages."),
    "RACV": (
        "Q&As were extracted from RACV's help-and-support pages, including "
        "product FAQ sections and help articles."
    ),
    "Budget Direct": (
        "Q&As were extracted from Budget Direct's car, home, "
        "travel, life, motorcycle and roadside-assistance FAQ "
        "pages. Product notices and photo-upload instructions "
        "were excluded."
    ),
    "AIA": (
        "AIA has no dedicated FAQ page. Q&As were extracted from its " "help-and-support articles."
    ),
    "Challenger": (
        "Includes Challenger's individual annuities FAQ, adviser FAQ " "and aged-care FAQ articles."
    ),
    "Cover-More": (
        "Q&As were extracted from Cover-More's main FAQ page and " "COVID-19 refund FAQ page."
    ),
    "ClearView": ("Q&As were extracted from ClearView's FAQ page and claims FAQ " "page."),
    "PPS Mutual": ("Q&As were extracted from PPS Mutual's /faqs/ page."),
    "RAC WA": ("Q&As were extracted from RAC WA's /faq page."),
    "CGU": ("Q&As were extracted from CGU's claims FAQ page and help-and-support " "page."),
    "TAL": ("Q&As were extracted from TAL's insurance FAQs page."),
    "Zurich": (
        "Q&As were extracted from Zurich's home-loan-protection, "
        "insuremytesla and end-of-financial-year FAQ pages."
    ),
    "NEOS": ("Q&As were extracted from NEOS Protection's individual /faqs/ " "pages."),
    "1Cover": ("Q&As were extracted from 1Cover's individual /faqs/ pages."),
    "APIA": ("Q&As were extracted from APIA's individual /faqs/ pages."),
    "GIO": (
        "Q&As were extracted from GIO's individual /faqs/ pages, including "
        "workers compensation, CTP, car, home, caravan and business topics."
    ),
    "Suncorp": ("Q&As were extracted from Suncorp's individual /insurance/faqs/ " "pages."),
    "RACQ": (
        "Q&As were extracted from RACQ's insurance help-contact pages and " "insurance FAQ page."
    ),
    "Go Insurance": ("Q&As were extracted from Go Insurance's individual /faq/ " "pages."),
    "InsureandGo": ("Q&As were extracted from InsureandGo's individual /faqs/ " "pages."),
    "Zoom": (
        "Q&As were extracted from Zoom Travel Insurance's /faqs/ page, "
        "including Q&As grouped under policy-cover headings."
    ),
    "NobleOak": (
        "Q&As were extracted from 12 NobleOak FAQ pages covering life, "
        "income protection, TPD, trauma, SMSF, business expenses, "
        "existing customers, underwriting, claims and payments. Careers "
        "FAQs were excluded."
    ),
}

NOQ_DROP = {"RAA", "Suncorp", "Budget Direct", "RACV", "APIA"}
JUNK_EXACT = {
    "further enquiries",
    "need further assistance?",
    "why choose 1cover travel insurance?",
    "archives: faq's",
    "how we can support you",
    "how to apply for support",
    "what we can do to help",
    "how we handle claims",
    "how to access our support",
    "roof work description",
}
JUNK_PREFIX = (
    "need further",
    "why choose",
    "archives:",
    "further enquiries",
    "how we can support you",
    "how to apply for support",
    "what we can do to help",
    "how we handle claims",
    "how to access our support",
)


def key(q):
    return re.sub(r"\W+", "", (q or "").lower())[:160]


def clean_answer(a, base_url=""):
    a = a or ""
    if re.search(r"<(p|br|ul|ol|li|a|strong|b|em|i|span|div)\b", a, re.I):
        soup = BeautifulSoup(a, "html.parser")
        a = markdownify(str(soup), heading_style="ATX", bullets="-")
    a = a.replace("\xa0", " ").replace("\u200b", "")
    a = re.sub(r"[ \t]+", " ", a)
    a = re.sub(r"\n{3,}", "\n\n", a).strip()
    a = re.sub(r"\n?See more\s*$", "", a, flags=re.I).strip()
    # Demote any headings inside answers so only real questions use ###.
    a = re.sub(r"^(#{1,6})\s+", lambda m: "#" * max(4, len(m.group(1))) + " ", a, flags=re.M)
    if base_url:
        a = re.sub(r"\]\((/[^)\s]+)\)", lambda m: "](" + urljoin(base_url, m.group(1)) + ")", a)
    return a


def normalize_category(ins, cat, url):
    c = (cat or "").strip()
    c = c.replace("Ctp", "CTP").replace("Tpd", "TPD").replace("Smsf", "SMSF")
    c = c.replace("Faqs", "FAQs").replace("FAQ's", "FAQs")
    if ins == "Fast Cover":
        return "Travel Insurance"
    if ins == "NEOS":
        return "NEOS Protection"
    if ins == "Allianz":
        if "car-insurance" in url:
            return "Car Insurance"
        if "home-insurance" in url:
            return "Home Insurance"
        if "life-insurance" in url:
            return "Life Insurance"
        if "business-insurance" in url:
            return "Business Insurance"
        if "policy-information" in url:
            return "Policy Information"
        return "Help & Contact"
    if ins == "NobleOak":
        if "/life-insurance/" in url:
            return "Life Insurance"
        if "/income-protection-insurance/" in url:
            return "Income Protection"
        if "/total-and-permanent-disability" in url:
            return "TPD"
        if "/trauma-insurance/" in url:
            return "Trauma"
        if "/smsf-insurance/" in url:
            return "SMSF"
        if "/business-expenses-insurance/" in url:
            return "Business Expenses"
        if "/re-pricing-faqs" in url:
            return "Re-pricing"
        if "/applications-and-underwriting" in url:
            return "Applications & Underwriting"
        if "/making-a-claim" in url:
            return "Claims"
        if "/payments-and-security" in url:
            return "Payments & Security"
        return "Existing Customers"
    if ins == "Budget Direct" and not c:
        if "car-insurance" in url:
            return "Car Insurance"
        if "home-contents-insurance" in url:
            return "Home Insurance"
        if "travel-insurance" in url:
            return "Travel Insurance"
        if "life-insurance" in url:
            return "Life Insurance"
        if "motorcycle-insurance" in url:
            return "Motorcycle Insurance"
        if "roadside-assistance" in url:
            return "Roadside Assistance"
    if ins == "CGU":
        return "Claims FAQs"
    if ins == "Challenger" and not c:
        return "Annuities"
    if ins == "ClearView":
        if c.startswith("If you have any concerns"):
            return "Complaints"
        if c.startswith("Policy administration changes"):
            return "Policy Administration"
    if ins == "Cover-More" and c.startswith("Skip ahead"):
        return "General"
    if ins == "Travel Insurance Direct" and (
        c == "IMPORTANT POLICY INFORMATION" or c.startswith("At Travel Insurance Direct")
    ):
        return "General"
    if ins == "HCF Life":
        return c.title().replace("Tpd", "TPD").replace("Smsf", "SMSF")
    if c == "Funnel":
        return "General"
    if ins == "RACQ" and c == "Roof work description":
        return "General"
    if ins == "Zoom" and ("0 Q&A Found" in c or not c):
        return "General"
    if ins in {"NRMA", "PPS Mutual", "Southern Cross Travel Insurance"} and not c:
        return "General"
    return c or "General"


def load_insurer(ins):
    path = os.path.join(JSONDIR, ins.replace(" ", "_") + ".json")
    if not os.path.exists(path):
        return None
    d = json.load(open(path, encoding="utf-8"))
    pages = d.get("pages", []) or []
    src_map = {}
    for page in pages:
        url = page.get("final") or page.get("url") or ""
        for p in page.get("pairs", []) or []:
            k = key(p.get("question"))
            if k and k not in src_map and url:
                src_map[k] = url
    primary = d.get("source") or (pages[0].get("final") if pages else "")
    if ins in {"AAMI", "Bingle", "Shannons"}:
        primary = GRAPHQL if ins != "Bingle" else "https://www.bingle.com.au/faqs"
    rows = []
    for p in d.get("pairs", []) or []:
        q = (p.get("question") or "").strip()
        a = clean_answer(p.get("answer") or "", primary or "")
        cat = (p.get("category") or "").strip()
        ql = q.lower()
        if len(q) < 8 or len(a) < 20:
            continue
        if ql in JUNK_EXACT or ql.startswith(JUNK_PREFIX):
            continue
        if ins == "NobleOak" and ("career" in cat.lower() or "culture" in ql):
            continue
        if not q.endswith("?") and ins in NOQ_DROP:
            continue
        if re.match(r"^(back|menu|search|home)\b", a.lower()) and len(a) < 120:
            continue
        src = src_map.get(key(q), primary)
        if ins in {"AAMI", "Bingle", "Shannons"}:
            src = primary
        cat = normalize_category(ins, cat, src)
        rows.append({"question": q, "answer": a, "category": cat, "source": src})
    # dedupe by question, keep longest answer
    merged = OrderedDict()
    for r in rows:
        k = key(r["question"])
        if not k:
            continue
        if k not in merged or len(r["answer"]) > len(merged[k]["answer"]):
            merged[k] = r
    rows = list(merged.values())
    # stable category grouping, keeping first-seen category order
    cats = OrderedDict()
    for r in rows:
        cats.setdefault(r["category"], []).append(r)
    return {
        "insurer": ins,
        "rows": rows,
        "categories": cats,
        "primary": primary,
        "pages": sorted(
            {p.get("final") or p.get("url") for p in pages if (p.get("final") or p.get("url"))}
        ),
    }


def write_markdown(data):
    ins = data["insurer"]
    rows = data["rows"]
    cats = data["categories"]
    primary = data["primary"]
    path = os.path.join(OUTDIR, f"{ins} FAQ.md")
    lines = [f"# {ins} — Frequently Asked Questions", ""]
    lines.append(f"**Insurer:** {ins}  ")
    lines.append(f"**Q&As:** {len(rows)}  ")
    lines.append(f"**Retrieved:** {RETRIEVED}  ")
    if primary:
        lines.append(f"**Primary source:** <{primary}>  ")
    if data["pages"]:
        lines.append(f"**Source pages crawled:** {len(data['pages'])}  ")
    lines.append("")
    note = NOTES.get(ins)
    if note:
        lines.append(f"> {note}")
        lines.append("")
    lines.append(
        "> Answers are reproduced from the insurer's public FAQ pages. "
        "Policy terms and cover can change; always check the current "
        "PDS/SPDS and policy wording before making a decision."
    )
    lines.append("")
    if not rows:
        lines.append("No public FAQ Q&As were found for this insurer.")
        lines.append("")
        lines.append("See the notes above for what was checked.")
        open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        return path, 0
    for cat, items in cats.items():
        lines.append(f"## {cat}")
        lines.append("")
        for r in items:
            q = r["question"].replace("\n", " ").strip()
            lines.append(f"### {q}")
            lines.append("")
            lines.append(r["answer"])
            lines.append("")
            if r["source"]:
                lines.append(f"*Source: <{r['source']}>*")
                lines.append("")
    # Source pages appendix
    if data["pages"]:
        lines.append("## Source pages")
        lines.append("")
        for u in data["pages"]:
            lines.append(f"- <{u}>")
        lines.append("")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return path, len(rows)


def write_readme(all_data):
    path = os.path.join(OUTDIR, "README.md")
    total = sum(len(d["rows"]) for d in all_data)
    lines = ["# Australian Insurers — Public FAQs", ""]
    lines.append(
        f"Public FAQ Q&As collected from Australian insurers' websites, "
        f"grouped by insurer. **{len(all_data)} insurers, {total:,} Q&As.**"
    )
    lines.append("")
    lines.append(f"**Retrieved:** {RETRIEVED}  ")
    lines.append(
        "**Format:** one Markdown file per insurer, with questions as "
        "`###` headings, answers as published, and source URLs."
    )
    lines.append("")
    lines.append("## Index")
    lines.append("")
    lines.append("| Insurer | Q&As | Categories | Notes |")
    lines.append("|---|---:|---|---|")
    for d in all_data:
        ins = d["insurer"]
        n = len(d["rows"])
        cats = ", ".join(list(d["categories"].keys())[:4])
        if len(d["categories"]) > 4:
            cats += f", +{len(d['categories']) - 4} more"
        note = NOTES.get(ins, "")
        note = note.replace("|", "\\|")
        if len(note) > 140:
            note = note[:137] + "..."
        lines.append(f"| [{ins}](<{ins} FAQ.md>) | {n:,} | {cats} | {note} |")
    lines.append("")
    lines.append("## Scope and method")
    lines.append("")
    lines.append(
        "- FAQs were collected from each insurer's public website using "
        "HTTP fetches and, where JavaScript, 403 responses or TLS issues "
        "blocked plain requests, a real browser."
    )
    lines.append(
        "- Server-rendered FAQ pages were crawled individually; "
        "accordions, `<details>` elements, question headings, "
        "JSON-LD `FAQPage` blocks and bold-question paragraphs were "
        "parsed."
    )
    lines.append(
        "- Where an insurer publishes no dedicated FAQ, the closest "
        "public support Q&As are included and the limitation is noted."
    )
    lines.append(
        "- Answers are reproduced as published. They are not legal or "
        "financial advice; cover is governed by the current PDS/SPDS."
    )
    lines.append("")
    lines.append("## Insurers with limited or no public FAQs")
    lines.append("")
    for ins in [
        "Vero",
        "Youi",
        "TIO",
        "Acenda",
        "Southern Cross Travel Insurance",
        "Travel Insurance Direct",
        "Asteron Life",
        "Bingle",
    ]:
        d = next((x for x in all_data if x["insurer"] == ins), None)
        n = len(d["rows"]) if d else 0
        lines.append(f"- **{ins}** ({n} Q&As): {NOTES.get(ins, '')}")
    lines.append("")
    lines.append("## Exclusions")
    lines.append("")
    lines.append(
        "- Health-fund booklets, policy wordings that are not PDS/SPDS, "
        "TMDs, PEDs, KFS, FSGs, forms and 'What's changed' summaries are "
        "out of scope, matching the PDS archive."
    )
    lines.append(
        "- White-label brand FAQs that duplicate an underlying insurer's "
        "content are not duplicated."
    )
    lines.append(
        "- Careers, community, sponsorship and generic news articles are "
        "excluded unless they contain product or claims Q&As."
    )
    lines.append("")
    lines.append("## Files")
    lines.append("")
    for d in all_data:
        lines.append(
            f"- [{d['insurer']} FAQ.md](<{d['insurer']} FAQ.md>) — " f"{len(d['rows']):,} Q&As"
        )
    lines.append("")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return path, total


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    all_data = []
    for ins in INSURERS:
        d = load_insurer(ins)
        if d is None:
            d = {
                "insurer": ins,
                "rows": [],
                "categories": OrderedDict(),
                "primary": "",
                "pages": [],
            }
        all_data.append(d)
        path, n = write_markdown(d)
        print(f"{ins:34} {n:5}  {path}")
    rpath, total = write_readme(all_data)
    print(f"README: {total} Q&As -> {rpath}")


if __name__ == "__main__":
    main()
