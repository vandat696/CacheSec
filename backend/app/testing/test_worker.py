"""Run explicitly on the trusted host: python -m app.testing.test_worker CONFIG."""

import json
import os
import sys
import time
from pathlib import Path
from uuid import UUID

from app.testing.docker_test_executor import DockerTestExecutor, result
from app.testing.worker_client import WorkerApiError, WorkerClient


def recover_owned(client, executor):
    for job in client.post("owned")["items"]:
        executor.cleanup(job["job_id"])
        client.post(
            job["job_id"] + "/result",
            ticket=job["ticket"],
            result=result("unknown", "WORKER_INTERRUPTED"),
        )


class WorkerLock:
    def __init__(self, root):
        root.mkdir(parents=True, exist_ok=True)
        self.stream = (root / "worker.lock").open("a+b")
        self.stream.seek(0)
        if os.name == "nt":
            import msvcrt

            if self.stream.read(1) == b"":
                self.stream.write(b"0")
                self.stream.flush()
            self.stream.seek(0)
            msvcrt.locking(self.stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(self.stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


def main():
    config_path = Path(sys.argv[1]).resolve(strict=True)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    root = Path(config["workspace_root"])
    if not root.is_absolute():
        raise ValueError("Absolute worker root required")
    lock = WorkerLock(root)
    credential = Path(config["credential_file"]).read_text(encoding="ascii").strip()
    worker_id = UUID(config["worker_id"])
    client = WorkerClient(config["api_url"], credential, worker_id)
    executor = DockerTestExecutor(root, worker_id)
    recover_owned(client, executor)
    print("Technical test worker ready", flush=True)
    while not lock.stream.closed:
        try:
            # Also reconcile a claim whose HTTP response was lost after backend commit.
            recover_owned(client, executor)
            job = client.post("claim")
        except (WorkerApiError, OSError):
            time.sleep(2)
            continue
        if job is None:
            time.sleep(1)
            continue
        verdict = executor.execute(client, job)
        # Retain the exact report until acknowledged; never rerun after a lost acknowledgement.
        while True:
            try:
                client.post(job["job_id"] + "/result", ticket=job["ticket"], result=verdict)
                break
            except WorkerApiError as error:
                if error.status in {400, 401, 403, 409}:
                    raise
                time.sleep(2)
            except Exception:
                time.sleep(2)
        print(
            f"Technical test {job['job_id']}: {verdict['outcome']} ({verdict['reason']})",
            flush=True,
        )
        if verdict["reason"] == "CLEANUP_UNCERTAIN":
            raise RuntimeError("Sandbox cleanup needs trusted operator intervention")


if __name__ == "__main__":
    main()
