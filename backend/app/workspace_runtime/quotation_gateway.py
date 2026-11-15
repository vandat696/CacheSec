"""Fixed HTTP ingress to one isolated quotation container; no arbitrary proxy destinations."""

import http.client
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

TARGET = os.environ["QUOTATION_GATEWAY_TARGET"]
if not re.fullmatch(r"cachesec-local-[0-9a-f]{32}", TARGET):
    raise ValueError("Fixed candidate target required")
PATH = re.compile(
    r"/api/v1/quotations(?:/[0-9a-fA-F-]{36}(?:/validate)?)?(?:\?cursor=[0-9a-fA-F-]{36})?\Z"
)


class QuotationIngress(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.relay()

    def do_POST(self):
        self.relay()

    def do_OPTIONS(self):
        self.relay()

    def relay(self):
        self.connection.settimeout(5)
        if not PATH.fullmatch(self.path) or self.headers.get("Transfer-Encoding"):
            self.send_error(400)
            return
        try:
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) > 1:
                raise ValueError()
            size = int(lengths[0]) if lengths else 0
            if not 0 <= size <= 65536:
                self.send_error(413)
                return
            body = self.rfile.read(size) if size else None
            if body is not None and len(body) != size:
                raise ValueError()
            headers = {
                k: self.headers[k]
                for k in (
                    "Authorization",
                    "Content-Type",
                    "Idempotency-Key",
                    "Origin",
                    "Access-Control-Request-Method",
                    "Access-Control-Request-Headers",
                )
                if k in self.headers
            }
            connection = http.client.HTTPConnection(TARGET, 8001, timeout=5)
            try:
                connection.request(self.command, self.path, body=body, headers=headers)
                response = connection.getresponse()
                raw = response.read(1048577)
                if len(raw) > 1048576:
                    raise ValueError()
                self.send_response(response.status)
                for name in (
                    "Content-Type",
                    "X-Request-ID",
                    "WWW-Authenticate",
                    "Vary",
                    "Access-Control-Allow-Origin",
                    "Access-Control-Allow-Methods",
                    "Access-Control-Allow-Headers",
                    "Access-Control-Expose-Headers",
                    "Access-Control-Max-Age",
                ):
                    value = response.getheader(name)
                    if value is not None:
                        self.send_header(name, value)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(raw)
            finally:
                connection.close()
        except (OSError, ValueError, http.client.HTTPException):
            self.send_error(502)


class BoundedIngress(HTTPServer):
    request_queue_size = 16

    def verify_request(self, request, address):
        request.settimeout(5)
        return True


if __name__ == "__main__":
    BoundedIngress(("0.0.0.0", 8001), QuotationIngress).serve_forever()
