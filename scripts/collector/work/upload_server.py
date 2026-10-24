#!/usr/bin/env python3
"""Tiny local upload server for PDFs fetched by the desktop browser."""

import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/raw"))
JSONDIR = os.path.join(ROOT, "faq_json")
OUT = os.path.join(JSONDIR, "browser_downloads")


class PdfUploadRequestHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        name = re.sub(r"[^A-Za-z0-9._ -]", "_", q.get("name", ["upload.pdf"])[0])
        insurer = re.sub(r"[^A-Za-z0-9._ -]", "_", q.get("insurer", ["Unknown"])[0])
        product = re.sub(r"[^A-Za-z0-9._ -]", "_", q.get("product", ["Other"])[0])
        n = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(n)
        if not data.startswith(b"%PDF"):
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(b"not a pdf")
            return
        folder = os.path.join(OUT, insurer, product)
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, name)
        with open(path, "wb") as fh:
            fh.write(data)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(path.encode())
        print("saved", path, len(data), flush=True)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), PdfUploadRequestHandler).serve_forever()
