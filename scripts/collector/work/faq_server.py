#!/usr/bin/env python3
"""Tiny local server that accepts FAQ JSON from the browser."""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
OUT = JSONDIR
os.makedirs(OUT, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n).decode("utf-8", "replace")
            data = json.loads(raw)
            name = data.get("insurer", "unknown").replace(" ", "_").replace("/", "_")
            path = os.path.join(OUT, f"{name}.json")
            existing = {"insurer": data.get("insurer"), "pages": [], "pairs": []}
            if os.path.exists(path):
                try:
                    existing = json.load(open(path, encoding="utf-8"))
                except Exception:
                    pass
            existing.setdefault("pages", []).append(
                {
                    "url": data.get("url", ""),
                    "final": data.get("url", ""),
                    "status": "200",
                    "pairs": data.get("pairs", []),
                }
            )
            merged = {}
            for p in existing.get("pairs", []) + data.get("pairs", []):
                q = p.get("question", "")
                k = "".join(ch for ch in q.lower() if ch.isalnum())[:140]
                if not k:
                    continue
                if k not in merged or len(p.get("answer", "")) > len(merged[k].get("answer", "")):
                    merged[k] = p
            existing["pairs"] = list(merged.values())
            existing["source"] = data.get("url", "")
            json.dump(existing, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
            body = json.dumps(
                {"ok": True, "file": path, "pairs": len(data.get("pairs", []))}
            ).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            body = json.dumps({"ok": False, "error": str(e)}).encode()
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("FAQ server on http://127.0.0.1:8766")
    ThreadingHTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
