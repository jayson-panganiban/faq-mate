#!/usr/bin/env python3
"""Probe candidate guide URLs and report status, title and body length."""

import concurrent.futures as cf
import json
import re
import sys

import requests
from bs4 import BeautifulSoup

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 FAQMateCorpus/1.0"
    )
}


def probe(url):
    try:
        resp = requests.get(url, headers=UA, timeout=25, allow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.decompose()
        title = soup.title.get_text(" ", strip=True) if soup.title else ""
        main = soup.find("main") or soup.body or soup
        text = re.sub(r"\s+", " ", main.get_text(" ", strip=True))
        return {
            "url": url,
            "status": resp.status_code,
            "final": resp.url,
            "title": title[:110],
            "length": len(text),
        }
    except Exception as exc:  # noqa: BLE001 - probe script
        return {"url": url, "status": "ERR", "final": "", "title": str(exc)[:80], "length": 0}


def main():
    payload = json.load(sys.stdin)
    with cf.ThreadPoolExecutor(8) as pool:
        for row in pool.map(probe, payload):
            print(f"{str(row['status']):<4} {row['length']:>6} | {row['title']:<70} | {row['url']}")
            if row["final"] and row["final"].rstrip("/") != row["url"].rstrip("/"):
                print(f"     -> {row['final']}")


if __name__ == "__main__":
    main()
