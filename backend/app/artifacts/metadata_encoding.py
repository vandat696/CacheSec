"""Deterministic metadata bytes; callers still own each manifest's schema/array ordering."""

import json
from typing import Any

from app.artifacts.blob_models import content_digest

MAX_METADATA_BYTES = 65536


class InvalidControlMetadata(ValueError):
    pass


def _validate(value: Any, depth: int, budget: list[int]) -> None:
    if depth > 32:
        raise InvalidControlMetadata("Metadata nesting exceeds the encoding limit.")
    budget[0] += len(value) if type(value) is str else 1
    if budget[0] > MAX_METADATA_BYTES:
        raise InvalidControlMetadata("Metadata exceeds the encoding limit.")
    if value is None or type(value) is bool:
        return
    if type(value) is str:
        if not value.isascii():
            raise InvalidControlMetadata("Metadata strings must be ASCII in encoding v1.")
        return
    if type(value) is int and 0 <= value <= 2**53 - 1:
        return
    if type(value) is list:
        for item in value:
            _validate(item, depth + 1, budget)
        return
    if type(value) is dict:
        for key, item in value.items():
            if type(key) is not str or not key.isascii():
                raise InvalidControlMetadata("Metadata object keys must be ASCII strings.")
            budget[0] += len(key)
            _validate(item, depth + 1, budget)
        return
    raise InvalidControlMetadata("Metadata contains an unsupported value.")


def encode_metadata(value: dict[str, Any]) -> bytes:
    """Encode cachesec-json-v1, not RFC 8785 or an artifact attestation."""
    _validate(value, 0, [0])
    if (
        type(value) is not dict
        or type(value.get("kind")) is not str
        or not value["kind"]
        or type(value.get("schema_version")) is not int
        or value["schema_version"] != 1
    ):
        raise InvalidControlMetadata("Metadata requires a kind and schema_version = 1.")
    content = json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("utf-8")
    if len(content) > MAX_METADATA_BYTES:
        raise InvalidControlMetadata("Encoded metadata exceeds 64 KiB.")
    return content


def metadata_digest(value: dict[str, Any]) -> str:
    return content_digest(encode_metadata(value))
