"""Private local-launch configuration; never prints credentials or imports a DB driver."""

import argparse
import errno
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def quotation_environment(app: dict, database: dict) -> dict[str, str]:
    """Keep app credentials; translate only the verified local Compose host/port."""
    try:
        url = urlsplit(app["QUOTATION_DATABASE_URL"])
        if (
            url.scheme not in ("postgres", "postgresql")
            or url.hostname not in ("localhost", "127.0.0.1")
            or (url.port or 5432) != int(database.get("POSTGRES_PORT", "5432"))
            or unquote(url.username or "") != database.get("POSTGRES_USER", "cachesec")
            or unquote(url.password or "") != database["POSTGRES_PASSWORD"]
            or unquote(url.path.removeprefix("/")) != database.get("POSTGRES_DB", "cachesec")
            or url.fragment
        ):
            raise ValueError()
        values = {
            name: app[name]
            for name in ("QUOTATION_FIXTURE_READER_TOKEN", "QUOTATION_FIXTURE_OPERATOR_TOKEN")
        }
        if (
            any(type(v) is not str or len(v) < 32 for v in values.values())
            or len(set(values.values())) != 2
        ):
            raise ValueError()
        auth = url.netloc.rsplit("@", 1)[0]
        values["QUOTATION_DATABASE_URL"] = urlunsplit(url._replace(netloc=auth + "@db:5432"))
        if any(not v or any(c in v for c in "\r\n\x00") for v in values.values()):
            raise ValueError()
        return values
    except (KeyError, TypeError, ValueError):
        raise ValueError(
            "Configure the local quotation DSN and distinct fixture tokens in backend/.env."
        ) from None


def prepare():
    from app.change_workflow.test_profiles import load_test_profile

    local = ROOT / "backend/.local"
    load_test_profile(local / "test-profile.json")
    values = quotation_environment(
        dotenv_values(ROOT / "backend/.env"), dotenv_values(ROOT / "infra/.env")
    )
    # Docker Compose format:raw preserves $, # and quotes; no human/control credential is copied.
    target = local / "quotation-runtime.env"
    target.write_text(
        "".join(f"{name}={value}\n" for name, value in values.items()), encoding="utf-8"
    )


def worker_state():
    from app.testing.test_worker import WorkerLock

    config = json.loads((ROOT / "backend/.local/test-worker.json").read_text(encoding="utf-8"))
    root = Path(config["workspace_root"])
    if not root.is_absolute():
        raise ValueError("Worker root must be absolute.")
    root.mkdir(parents=True, exist_ok=True)
    # Check file access outside the contention handler; permission failures are not a live worker.
    with (root / "worker.lock").open("a+b"):
        pass
    try:
        lock = WorkerLock(root)
    except OSError as error:
        if error.errno not in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
            raise
        print("locked")
    else:
        lock.stream.close()
        print("free")


def probe_control():
    from app.change_workflow.test_profiles import load_test_profile

    control = dotenv_values(ROOT / "backend/.local/control-access.env")
    token = control["CONTROL_REPOSITORY_READ_TOKEN"]
    request = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/changes/config", headers={"Authorization": "Bearer " + token}
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=5) as response:
        data = json.load(response)
    profile = load_test_profile(ROOT / "backend/.local/test-profile.json")
    if (
        data["meta"]["contract_version"] != "v0.2"
        or data["data"]["profile_digest"] != profile.digest
    ):
        raise ValueError("Control workflow profile mismatch.")


def probe():
    probe_control()
    app = dotenv_values(ROOT / "backend/.env")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for url, token in (
        ("http://127.0.0.1:8001/api/v1/quotations", app["QUOTATION_FIXTURE_READER_TOKEN"]),
    ):
        request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
        with opener.open(request, timeout=5) as response:
            data = json.load(response)
            if data["meta"]["contract_version"] != "v0.2":
                raise ValueError("Unexpected local API contract.")
    print("Control workflow and quotation database: OK")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "worker-state", "probe-control", "probe"))
    args = parser.parse_args()
    try:
        {
            "prepare": prepare,
            "worker-state": worker_state,
            "probe-control": probe_control,
            "probe": probe,
        }[args.action]()
    except Exception:
        print(
            "Local configuration check failed. "
            "Check docs/general/setup.md and existing private configuration.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
