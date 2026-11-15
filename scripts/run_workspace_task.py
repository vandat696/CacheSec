"""Opt-in real provider run. Creates a tested revision, never approves or deploys it."""

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
PROMPT = """Thêm đúng một quy tắc expiration_review trong quotation_validation.py.
Giữ nguyên interface/dataclass và chỉ sửa file này.
reference_date là datetime.date do backend truyền, không dùng ngày hệ thống hay hardcode mốc.
Nếu thiếu reference_date thì báo lỗi rõ.
Ngày hợp lệ là chuỗi ASCII YYYY-MM-DD đúng độ dài, ngày có thật và >= reference_date.
Không trim, không ép kiểu, không nhận timestamp. Thiếu key, null, chuỗi rỗng, sai định dạng,
ngày không tồn tại, ngày quá hạn, số/boolean/array/object đều thêm QuotationFlag với code
expiration_review và field expires_on để con người xem xét.
Ngày bằng hoặc sau mốc không thêm cờ này.
Kết quả evaluated_rules gồm expiration_review, reference_date giữ mốc được truyền vào,
validation_config_ref có version phù hợp, active_artifact vẫn None. Không thêm rule khác,
không sửa test/policy/control, không tự duyệt hoặc triển khai. Harness kỹ thuật truyền R=2026-11-07.
Tạo bản sửa và chạy test qua workflow hiện có; đây là kiểm chứng kỹ thuật.
Không tuyên bố acceptance nghiên cứu.
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--send-to-provider", action="store_true", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    destination = args.output.resolve()
    if not destination.is_relative_to(ROOT / "backend/.local") or destination.exists():
        raise ValueError("Use a new private output file under backend/.local")
    token = dotenv_values(ROOT / "backend/.local/control-access.env")[
        "CONTROL_REPOSITORY_READ_TOKEN"
    ]
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(path, body=None, method=None):
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/v1/" + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json",
                "Idempotency-Key": str(uuid4()),
            },
            method=method,
        )
        with opener.open(req, timeout=15) as response:
            return json.load(response)["data"]

    snapshot = request("repository/snapshots", method="POST")
    run = request(
        "agent/runs",
        {"snapshot_id": snapshot["snapshot_id"], "prompt": PROMPT, "provider_consent": True},
    )
    destination.write_text(
        json.dumps({"run_id": run["run_id"], "status": run["status"]}), encoding="utf-8"
    )
    previous = None
    while run["status"] in {"queued", "generating", "saving", "testing"}:
        state = (run["status"], run["turn"])
        if state != previous:
            print(
                json.dumps({"run_id": run["run_id"], "status": state[0], "turn": state[1]}),
                flush=True,
            )
            previous = state
        time.sleep(1)
        run = request("agent/runs/" + run["run_id"])
    report = {
        k: run[k]
        for k in (
            "run_id",
            "status",
            "model",
            "turn",
            "proposal_id",
            "revision",
            "artifact_digest",
            "test_job_id",
            "test_status",
            "error_code",
        )
    }
    report["usage"] = [e["usage"] for e in run["events"] if e.get("usage") is not None]
    if run["test_job_id"]:
        job = request("changes/tests/" + run["test_job_id"])
        report["checks"] = job["result"]["checks"] if job["result"] else None
    destination.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))
    if run["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        print("Control API HTTP " + str(error.code), flush=True)
        raise SystemExit(1) from None
