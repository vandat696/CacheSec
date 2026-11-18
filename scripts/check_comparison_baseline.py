"""Check the frozen comparison baseline using one disposable container."""

# ruff: noqa: E402

import argparse
import json
import re
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.change_workflow.test_profiles import OVERLAY_PATHS, load_test_profile
from app.testing.docker_commands import docker

BASELINE_PROBE = """
import json
import os
import sys
from fastapi.testclient import TestClient
from app.quotation_demo.quotation_api import create_app

headers = {"Authorization": "Bearer " + os.environ["QUOTATION_FIXTURE_OPERATOR_TOKEN"]}
with TestClient(create_app()) as client:
    path = "/api/v1/quotations"
    if len(sys.argv) == 1:
        client.get(path, headers=headers).raise_for_status()
        print(json.dumps({"ready": True}))
    else:
        quotation_id = sys.argv[1]
        path += "/" + quotation_id
        record = client.get(path, headers=headers).raise_for_status().json()["data"]
        result = client.post(path + "/validate", headers=headers).raise_for_status().json()["data"]
        if record["id"] != quotation_id or result["quotation_id"] != quotation_id:
            raise ValueError("Unexpected quotation")
        print(json.dumps({
            "quotation_id": quotation_id,
            "expires_on": record.get("expires_on"),
            "flags": result["flags"],
        }))
"""


def check_baseline(root: Path, quotation_id: UUID | None = None) -> dict:
    root = root.resolve()
    local = (ROOT / "backend/.local").resolve()
    if not root.is_relative_to(local) or root == local:
        raise ValueError("Demo root must be under backend/.local")
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    network_name = manifest["network"]
    match = re.fullmatch(r"cachesec-comparison-([0-9a-f]{12})", network_name)
    if not match or Path(manifest["root"]).resolve() != root:
        raise ValueError("Invalid comparison demo manifest")
    network = json.loads(docker(["network", "inspect", network_name]))[0]
    if not network["Internal"] or network["Labels"].get("cachesec.demo") != match[1]:
        raise ValueError("Expected the isolated comparison network")

    profile = load_test_profile(root / "profile.json")
    baseline = root / "baseline"
    mounts = []
    for path in OVERLAY_PATHS:
        source = baseline / path
        if source.resolve() != source or not source.is_file():
            raise ValueError("Frozen source is missing or redirected")
        target = "/opt/quotation/" + path.removeprefix("backend/")
        mounts.extend(
            ["--mount", f"type=bind,source={source},target={target},readonly"]
        )

    output = docker(
        [
            "run",
            "--rm",
            "--pull",
            "never",
            "--network",
            network_name,
            "--label",
            "cachesec.demo=" + match[1],
            "--env-file",
            str(root / "app.env"),
            "--env",
            "PGOPTIONS=-c default_transaction_read_only=on",
            "--read-only",
            "--user",
            "10001:10001",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges:true",
            "--cpus",
            "1",
            "--memory",
            "512m",
            "--pids-limit",
            "128",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            *mounts,
            "--entrypoint",
            "python",
            profile.runtime_image,
            "-c",
            BASELINE_PROBE,
            *([str(quotation_id)] if quotation_id else []),
        ]
    )
    return json.loads(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("quotation_id", type=UUID)
    args = parser.parse_args()
    try:
        print(json.dumps(check_baseline(args.root, args.quotation_id)))
    except Exception as error:  # noqa: BLE001 — private config may appear in underlying errors.
        print(f"Baseline check failed ({type(error).__name__}).", file=sys.stderr)
        raise SystemExit(1) from None
