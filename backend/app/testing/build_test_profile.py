"""Resolve local images once and write a recipe for explicit backend registration."""

import argparse
import json
from pathlib import Path

from app.change_workflow.test_profiles import OVERLAY_PATHS, TechnicalTestProfile
from app.testing.docker_commands import docker
from app.testing.image_inventory import image_inventory, verify_images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("runtime", "harness", "database", "output"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    images = [
        json.loads(docker(["image", "inspect", tag]))[0]["Id"]
        for tag in (args.runtime, args.harness, args.database)
    ]
    runtime, inventory = image_inventory(images[0])
    _, suite = image_inventory(images[1])
    profile = TechnicalTestProfile(
        *images,
        runtime["files"]["requirements-dev.lock.txt"],
        suite,
        inventory,
        tuple((p, runtime["files"][p.removeprefix("backend/")]) for p in OVERLAY_PATHS[:2]),
    )
    verify_images(profile)
    output = Path(args.output)
    if not output.is_absolute():
        raise ValueError("An absolute output path is required")
    with output.open("x", encoding="ascii") as stream:
        json.dump(profile.metadata(), stream, indent=2)
    print("Technical profile written: " + profile.digest)


if __name__ == "__main__":
    main()
