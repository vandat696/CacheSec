"""Portable full-source context cache contract; similarity never grants authority."""

import json
import math
from dataclasses import dataclass, field
from typing import Protocol

from app.artifacts.blob_models import content_digest

POLICY = {
    "version": "full-source-context-v1",
    "embedding": "gemini-embedding-001",
    "dimensions": 768,
    "task_type": "SEMANTIC_SIMILARITY",
    "normalization": "l2",
    "metric": "cosine",
    "threshold": 0.85,
    "top_k": 3,
    "ttl_seconds": 1800,
    "capacity": 100,
    "eviction": "lru",
}


class ContextError(Exception):
    def __init__(self, code, status=409):
        super().__init__(code)
        self.code, self.status = code, status


def canonical(value):
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def fingerprint(value):
    return content_digest(canonical(value))


def normalize_vector(value):
    if (
        type(value) is not list
        or len(value) != POLICY["dimensions"]
        or any(type(n) not in (float, int) or not math.isfinite(n) for n in value)
    ):
        raise ContextError("EMBEDDING_INVALID_RESPONSE", 502)
    norm = math.hypot(*value)
    if not math.isfinite(norm) or norm == 0:
        raise ContextError("EMBEDDING_INVALID_RESPONSE", 502)
    return [float(n) / norm for n in value]


class QueryEmbedding(Protocol):
    def embed(self, prompt: str) -> list[float]: ...


@dataclass(frozen=True)
class ResolvedContext:
    request_id: str
    files: tuple[tuple[str, str], ...] = field(repr=False)
    outcome: str
    decisions: tuple[dict, ...]
    admission: dict | None = field(repr=False)


def candidate_score(candidate, entry, request):
    if entry is None or entry["namespace"] != request["namespace"]:
        return None
    if candidate["kind"] == "exact":
        return 1.0 if entry["query_fingerprint"] == request["query_fingerprint"] else None
    if not entry.get("vector") or not request.get("vector"):
        return None
    return max(
        -1.0, min(1.0, sum(a * b for a, b in zip(entry["vector"], request["vector"], strict=True)))
    )


def verify_candidate(candidate, entry, request, snapshot, now):
    """Validate untrusted browser payload against trusted registry and source metadata.

    Caller must authenticate the current owner and validate current source/authority
    before calling. Registry corruption is an error, not an authorized Miss.
    """
    if entry is None:
        return "ENTRY_UNKNOWN"
    if any(entry[k] != request[k] for k in ("namespace", "purpose", "intent")):
        return "SCOPE_OR_CONFIG_MISMATCH"
    if entry["expires_at"] <= now:
        return "EXPIRED"
    if entry["manifest_digest"] != snapshot.manifest_blob.digest:
        return "STALE_SOURCE"
    payload = candidate["payload"]
    try:
        if fingerprint(payload) != entry["payload_digest"]:
            return "INTEGRITY_MISMATCH"
        files = payload["files"]
        if payload["kind"] != "full-source-context-v1" or len(files) != len(snapshot.files):
            return "DEPENDENCY_MISMATCH"
        for file, reference in zip(files, snapshot.files, strict=True):
            if set(file) != {"path", "content"} or file["path"] != reference.path:
                return "DEPENDENCY_MISMATCH"
            raw = file["content"].encode("utf-8")
            if len(raw) != reference.blob.byte_size or content_digest(raw) != reference.blob.digest:
                return "INTEGRITY_MISMATCH"
    except (KeyError, ValueError, TypeError, UnicodeError, AttributeError):
        return "INTEGRITY_MISMATCH"
    if candidate["kind"] == "exact":
        if entry["query_fingerprint"] != request["query_fingerprint"]:
            return "QUERY_MISMATCH"
    elif candidate["kind"] == "semantic":
        # Browser score/vector is never trusted; compare backend-issued vectors.
        if not entry.get("vector") or not request.get("vector"):
            return "VECTOR_MISMATCH"
        score = candidate_score(candidate, entry, request)
        if score < POLICY["threshold"]:
            return "BELOW_THRESHOLD"
    else:
        return "CANDIDATE_KIND_INVALID"
    return None
