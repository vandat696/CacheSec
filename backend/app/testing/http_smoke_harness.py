"""Run outside the candidate. This is a transport smoke test, not a research oracle."""

import json
import os
import socket
import time
import urllib.error
import urllib.request
from uuid import UUID, uuid4

NAMES = (
    "identity_required",
    "record_round_trip",
    "reader_write_denied",
    "idempotent_retry",
    "validation_contract",
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def run():
    start = time.monotonic()
    checks = []
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    operator, reader = os.environ["TEST_OPERATOR_TOKEN"], os.environ["TEST_READER_TOKEN"]

    def request(method, path, token=None, body=None, key=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        if key:
            headers["Idempotency-Key"] = key
        req = urllib.request.Request(
            "http://candidate:8001/api/v1/quotations" + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
            method=method,
        )
        try:
            response = opener.open(req, timeout=4)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(65537)
            if len(raw) > 65536:
                raise ValueError("Oversized HTTP response")
            return response.code, json.loads(raw)

    def check(name, success):
        checks.append({"name": name, "passed": bool(success)})
        if not success:
            raise ValueError("Technical check failed")

    outcome, reason = "passed", "COMPLETED"
    try:
        for attempt in range(50):
            try:
                status, _ = request("GET", "")
                break
            except urllib.error.URLError:
                if attempt == 49:
                    raise TimeoutError()
                time.sleep(0.2)
        check(NAMES[0], status == 401)
        body = {
            "supplier_name": "Synthetic supplier",
            "description": "Technical smoke",
            "total_amount": "123.4500",
            "currency": "VND",
            "expires_on": None,
        }
        key = str(uuid4())
        status, created = request("POST", "", operator, body, key)
        record = created.get("data", {})
        identifier = str(UUID(record["id"]))
        read_status, read = request("GET", "/" + identifier, reader)
        missing_body = {k: v for k, v in body.items() if k != "expires_on"}
        missing_status, missing = request("POST", "", operator, missing_body, str(uuid4()))
        missing_record = missing.get("data", {})
        missing_id = str(UUID(missing_record["id"]))
        missing_read_status, missing_read = request("GET", "/" + missing_id, reader)
        check(
            NAMES[1],
            status == 201
            and read_status == 200
            and read.get("data") == record
            and {k: record.get(k) for k in body} == body
            and missing_status == 201
            and missing_read_status == 200
            and missing_read.get("data") == missing_record
            and "expires_on" not in missing_record,
        )
        status, _ = request("POST", "", reader, body, str(uuid4()))
        check(NAMES[2], status == 403)
        status, retried = request("POST", "", operator, body, key)
        check(NAMES[3], status == 201 and retried.get("data") == record)
        status, validated = request("POST", "/" + identifier + "/validate", operator)
        result = validated.get("data", {})
        check(
            NAMES[4],
            status == 200
            and result.get("quotation_id") == identifier
            and isinstance(result.get("flags"), list)
            and isinstance(result.get("evaluated_rules"), list),
        )
    except (TimeoutError, socket.timeout):
        outcome, reason = "timed_out", "HTTP_TIMEOUT"
    except urllib.error.URLError as error:
        outcome = (
            "timed_out" if isinstance(error.reason, (TimeoutError, socket.timeout)) else "failed"
        )
        reason = "HTTP_TIMEOUT" if outcome == "timed_out" else "APP_START_FAILED"
    except (ValueError, KeyError, TypeError):
        outcome, reason = "failed", "CHECK_FAILED"
    return {
        "outcome": outcome,
        "reason": reason,
        "checks": checks,
        "elapsed_ms": int((time.monotonic() - start) * 1000),
    }


if __name__ == "__main__":
    print(json.dumps(run(), separators=(",", ":")))
