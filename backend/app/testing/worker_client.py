"""Private control channel. No human credential is given to the test worker."""

import json
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64decode
from uuid import UUID

from app.artifacts.blob_models import BlobReference
from app.identity.control_authority import RepositoryScope
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import CapturedSourceFile, RepositorySnapshot, SnapshotFile


class WorkerApiError(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__(f"Worker control HTTP {status}")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class WorkerClient:
    def __init__(self, api_url: str, credential: str, worker_id: UUID):
        url = urllib.parse.urlsplit(api_url)
        if (
            url.scheme != "http"
            or url.hostname not in ("localhost", "127.0.0.1")
            or url.username
            or url.password
            or url.path not in ("", "/")
            or url.query
            or url.fragment
        ):
            raise ValueError("Worker requires a trusted loopback control URL.")
        self.url, self._credential, self.worker_id = api_url.rstrip("/"), credential, worker_id
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def post(self, path, *, ticket=None, result=None):
        body = {"worker_id": str(self.worker_id)}
        if ticket:
            body["ticket"] = str(ticket)
        if result is not None:
            body["result"] = result
        request = urllib.request.Request(
            self.url + "/_internal/test-worker/" + path,
            data=json.dumps(body).encode(),
            method="POST",
            headers={"Content-Type": "application/json", "X-Control-Worker-Key": self._credential},
        )
        try:
            with self.opener.open(request, timeout=15) as response:
                raw = response.read(1048577)
                if len(raw) > 1048576:
                    raise ValueError("Control response too large")
                data = json.loads(raw)
                if data["meta"]["contract_version"] != "v0.2":
                    raise ValueError("Control contract mismatch")
                return data["data"]
        except urllib.error.HTTPError as error:
            raise WorkerApiError(error.code) from None


def decode_bundle(data: dict) -> SnapshotBundle:
    refs = tuple(
        SnapshotFile(UUID(f["file_id"]), f["path"], BlobReference(f["digest"], f["byte_size"]))
        for f in data["files"]
    )
    snapshot = RepositorySnapshot(
        RepositoryScope(UUID(data["tenant_id"]), UUID(data["repo_id"])),
        UUID(data["snapshot_id"]),
        data["repository_identity"],
        UUID(data["created_by"]),
        data["authority_epoch"],
        BlobReference(data["profile_digest"], data["profile_size"]),
        BlobReference(data["manifest_digest"], data["manifest_size"]),
        refs,
    )
    return SnapshotBundle(
        snapshot,
        b64decode(data["profile_content"], validate=True),
        tuple(
            CapturedSourceFile(f["path"], b64decode(f["content"], validate=True))
            for f in data["files"]
        ),
    )
