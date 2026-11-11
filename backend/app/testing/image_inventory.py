"""Read trusted immutable images before any candidate mount is present."""

import json
from base64 import b64decode

from app.artifacts.blob_models import content_digest
from app.artifacts.metadata_encoding import metadata_digest
from app.testing.docker_commands import DockerFailure, docker

INVENTORY_SCRIPT = """
import base64,hashlib,json,pathlib
root=pathlib.Path.cwd()
files={}
sql={}
for p in sorted(root.rglob('*')):
 if p.is_file() and '__pycache__' not in p.parts:
  raw=p.read_bytes(); name=p.relative_to(root).as_posix()
  files[name]='sha256:'+hashlib.sha256(raw).hexdigest()
  if name.startswith('migrations/') and name.endswith('.sql'):
   sql[name]=base64.b64encode(raw).decode('ascii')
print(json.dumps({'files':files,'sql':sql},sort_keys=True))
"""


def image_inventory(image: str, platform="linux/amd64"):
    info = json.loads(docker(["image", "inspect", image]))[0]
    if info["Id"] != image or info["Os"] + "/" + info["Architecture"] != platform:
        raise DockerFailure("PROFILE_MISMATCH")
    raw = docker(
        [
            "run",
            "--rm",
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--entrypoint",
            "python",
            image,
            "-c",
            INVENTORY_SCRIPT,
        ]
    )
    inventory = json.loads(raw)
    return inventory, metadata_digest(
        {"kind": "image-file-inventory", "schema_version": 1, "files": inventory["files"]}
    )


def verify_images(profile):
    runtime, digest = image_inventory(profile.runtime_image, profile.platform)
    harness, suite = image_inventory(profile.harness_image, profile.platform)
    info = json.loads(docker(["image", "inspect", profile.database_image]))[0]
    if (
        digest != profile.inventory_digest
        or suite != profile.suite_digest
        or info["Id"] != profile.database_image
        or info["Os"] + "/" + info["Architecture"] != profile.platform
        or runtime["files"].get("requirements-dev.lock.txt") != profile.lockfile_digest
    ):
        raise DockerFailure("PROFILE_MISMATCH")
    for path, expected in profile.protected_files:
        if runtime["files"].get(path.removeprefix("backend/")) != expected:
            raise DockerFailure("PROFILE_MISMATCH")
    sql = []
    for name, encoded in sorted(harness["sql"].items()):
        raw = b64decode(encoded, validate=True)
        if content_digest(raw) != harness["files"].get(name):
            raise DockerFailure("PROFILE_MISMATCH")
        sql.append(raw)
    if len(sql) != 2:
        raise DockerFailure("PROFILE_MISMATCH")
    return tuple(sql)
