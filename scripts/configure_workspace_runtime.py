"""Explicit owner action to enable real project writes and human-reviewed local runs."""

import argparse
import hashlib
import json
import secrets
import subprocess
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    from app.artifacts.metadata_encoding import metadata_digest
    from app.change_workflow.test_profiles import load_test_profile
    from app.workspace_runtime.docker_runtime import runtime_configuration

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    args = parser.parse_args()
    profile = load_test_profile(args.profile.resolve(strict=True))
    local = ROOT / "backend/.local"
    bootstrap_image = local / "bootstrap-runtime-image.txt"
    previous_profile = load_test_profile(local / "test-profile.json")
    token = dotenv_values(local / "control-access.env")["CONTROL_REPOSITORY_READ_TOKEN"]
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    request = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/repository", headers={"Authorization": "Bearer " + token}
    )
    with opener.open(request, timeout=5) as response:
        repository = json.load(response)["data"]
    # App credentials stay the existing quotation fixture credentials; no control token enters it.
    existing = dotenv_values(local / "quotation-runtime.env")
    runtime_password = secrets.token_hex(32)
    url = urlsplit(existing["QUOTATION_DATABASE_URL"])
    safe_url = urlunsplit(
        url._replace(netloc="cachesec_workspace_app:" + runtime_password + "@db:5432")
    )
    environment = local / "quotation-workspace.env"
    # Write the selected file only after all source/profile validation above has passed.
    values = {
        "QUOTATION_DATABASE_URL": safe_url,
        "QUOTATION_FIXTURE_OPERATOR_TOKEN": existing["QUOTATION_FIXTURE_OPERATOR_TOKEN"],
        "QUOTATION_FIXTURE_READER_TOKEN": existing["QUOTATION_FIXTURE_READER_TOKEN"],
        "QUOTATION_REFERENCE_DATE": "2026-11-07",
    }
    if any(any(c in v for c in "\r\n\x00") for v in values.values()):
        raise ValueError("Invalid private environment")
    pending_environment = local / "quotation-workspace.pending.env"
    pending_environment.write_text(
        "".join(f"{k}={v}\n" for k, v in values.items()), encoding="utf-8"
    )
    runtime = {
        "network": "cachesec_quotation_runtime",
        "port": 8001,
        "environment_file": str(pending_environment),
    }
    config_digest = metadata_digest(runtime_configuration(runtime, profile))
    payload = {
        "expected_epoch": repository["authority_epoch"],
        "credential_digest": hashlib.sha256(token.encode("ascii")).hexdigest(),
        "profile": profile.metadata(),
        "config_digest": config_digest,
        "runtime_password": runtime_password,
    }
    # Secrets travel through stdin, never argv or stdout. The command creates no approval.
    process = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "cachesec-control-dev-control-1",
            "python",
            "-m",
            "app.workspace_runtime.provision_local",
        ],
        input=json.dumps(payload).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if process.returncode:
        try:
            diagnostic = json.loads(process.stderr)
            if set(diagnostic) == {"error_type", "locations"}:
                print(json.dumps(diagnostic), file=sys.stderr)
        except (ValueError, TypeError):
            pass
        raise RuntimeError(
            "Workspace provisioning failed; check authority/profile. No activation requested."
        )
    pending_environment.replace(environment)
    if not bootstrap_image.exists():
        bootstrap_image.write_text(previous_profile.runtime_image + "\n", encoding="ascii")
    runtime["environment_file"] = str(environment)
    worker_file = local / "test-worker.json"
    worker = json.loads(worker_file.read_text(encoding="utf-8"))
    worker.update(source_root=str(ROOT), runtime=runtime)
    worker_file.write_text(json.dumps(worker, indent=2) + "\n", encoding="utf-8")
    (local / "test-profile.json").write_text(
        json.dumps(profile.metadata(), indent=2) + "\n", encoding="ascii"
    )
    print(process.stdout.decode("ascii").strip())
    print("Configured project writes and human approval/run. Restart control and worker.")
    print("No candidate activated.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not expose DSNs, credentials, or subprocess/provider diagnostics.
        print("Workspace configuration failed: " + type(error).__name__, file=sys.stderr)
        raise SystemExit(1) from None
