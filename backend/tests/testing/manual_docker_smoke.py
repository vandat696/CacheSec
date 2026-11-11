"""Explicit Docker checks, separate from pytest and the research experiment.

python tests/testing/manual_docker_smoke.py PROFILE_JSON PRIVATE_WORKSPACE_ROOT [case]
Uses the three original repository files; never edits the original validation module.
"""

import json
import sys
from base64 import b64encode
from pathlib import Path
from uuid import uuid4

from app.artifacts.blob_models import BlobReference, content_digest
from app.artifacts.metadata_encoding import encode_metadata
from app.change_workflow.test_profiles import OVERLAY_PATHS, load_test_profile
from app.identity.control_authority import RepositoryScope
from app.repositories.snapshot_models import SnapshotFile, snapshot_manifest
from app.repositories.source_profiles import SourceProfile
from app.testing.docker_test_executor import DockerTestExecutor

CASES = {
    "pass": ("\n# Technical transport smoke only.\n", "passed"),
    "fail": (
        "\ndef validate_quotation(quotation):\n    raise RuntimeError('technical check')\n",
        "failed",
    ),
    "timeout": (
        "\ndef validate_quotation(quotation):\n    while True:\n        pass\n",
        "timed_out",
    ),
    "output": (
        "\ndef validate_quotation(quotation):\n    while True:\n"
        "        print('x' * 8192, flush=True)\n",
        "error",
    ),
    "isolation": (
        """
_original_validate = validate_quotation
def validate_quotation(quotation):
    import os, pathlib, socket, psycopg
    assert not any(k.startswith('CONTROL_') for k in os.environ)
    assert 'DATABASE_URL' not in os.environ
    assert not pathlib.Path('/var/run/docker.sock').exists()
    assert not pathlib.Path('/control-store').exists()
    assert not pathlib.Path('/opt/control').exists()
    targets = [('1.1.1.1', 443), ('host.docker.internal', 8000),
               ('host.docker.internal', 5432)]
    for host, port in targets:
        try:
            c = socket.create_connection((host, port), timeout=.5)
        except OSError:
            continue
        c.close()
        raise RuntimeError('Sandbox network isolation failed')
    dsn = os.environ['QUOTATION_DATABASE_URL']
    with psycopg.connect(dsn, connect_timeout=2) as c:
        try:
            c.execute('CREATE SCHEMA forbidden_probe')
        except psycopg.errors.InsufficientPrivilege:
            c.rollback()
        else:
            raise RuntimeError('Test role has DDL privileges')
    try:
        psycopg.connect(dsn.rsplit('/', 1)[0] + '/postgres', connect_timeout=2).close()
    except psycopg.OperationalError:
        pass
    else:
        raise RuntimeError('Test role can connect to an unrelated database')
    return _original_validate(quotation)
""",
        "passed",
    ),
}


def main():
    profile = load_test_profile(Path(sys.argv[1]).resolve(strict=True))
    root = Path(sys.argv[2]).resolve()
    source_root = Path(__file__).resolve().parents[3]
    selected = sys.argv[3:] or list(CASES)
    traces = []

    def trace(frame, event, arg):
        if event == "exception" and "/app/" in frame.f_code.co_filename.replace("\\", "/"):
            traces.append((Path(frame.f_code.co_filename).name, frame.f_lineno, arg[0].__name__))
        return trace

    for name in selected:
        suffix, expected = CASES[name]
        scope = RepositoryScope(uuid4(), uuid4())
        source = SourceProfile(scope, "manual-isolated-technical-check", OVERLAY_PATHS)
        refs, files = [], []
        for path in OVERLAY_PATHS:
            raw = (source_root / path).read_bytes()
            if path == OVERLAY_PATHS[-1]:
                raw += suffix.encode("utf-8")
            ref = SnapshotFile(uuid4(), path, BlobReference(content_digest(raw), len(raw)))
            refs.append(ref)
            files.append(
                dict(
                    file_id=str(ref.file_id),
                    path=path,
                    digest=ref.blob.digest,
                    byte_size=len(raw),
                    content=b64encode(raw).decode(),
                )
            )
        manifest = encode_metadata(
            snapshot_manifest(scope, source.repository_identity, source.digest, tuple(refs))
        )
        source_raw = encode_metadata(source.metadata())
        bundle = dict(
            tenant_id=str(scope.tenant_id),
            repo_id=str(scope.repo_id),
            snapshot_id=str(uuid4()),
            repository_identity=source.repository_identity,
            created_by=str(uuid4()),
            authority_epoch=1,
            profile_content=b64encode(source_raw).decode(),
            profile_digest=source.digest,
            profile_size=len(source_raw),
            manifest_digest=content_digest(manifest),
            manifest_size=len(manifest),
            files=files,
        )
        job = dict(
            job_id=str(uuid4()),
            ticket=str(uuid4()),
            profile=profile.metadata(),
            profile_digest=profile.digest,
            artifact_digest=content_digest(b"manual-probe"),
        )

        class ProbeControl:
            def post(self, path, **kwargs):
                return (
                    bundle
                    if path.endswith("/bundle")
                    else {
                        "artifact_digest": job["artifact_digest"],
                        "profile_digest": profile.digest,
                    }
                )

        sys.settrace(trace)
        verdict = DockerTestExecutor(root, uuid4()).execute(ProbeControl(), job)
        sys.settrace(None)
        print(json.dumps({"case": name, **verdict}), flush=True)
        if verdict["outcome"] != expected:
            print("Exception locations (no payload):", traces[-15:])
            raise AssertionError("Unexpected Docker technical check result")
        traces.clear()


if __name__ == "__main__":
    main()
