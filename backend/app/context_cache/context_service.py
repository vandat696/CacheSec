"""Online trusted full-source context preparation, admission and cache verification."""

import time
from uuid import UUID, uuid4

from app.context_cache.context_contract import (
    POLICY,
    ContextError,
    QueryEmbedding,
    ResolvedContext,
    candidate_score,
    fingerprint,
    verify_candidate,
)
from app.context_cache.context_repository import ContextSource, ContextTransactions
from app.identity.control_authority import ControlAuthorizer
from app.identity.control_authority import ControlCapability as Cap


class ContextService:
    def __init__(
        self,
        transactions: ContextTransactions,
        snapshots: ContextSource,
        embedding: QueryEmbedding,
        model_id: str,
        clock=time.time,
        *,
        prompt_version: str,
    ):
        self.transactions, self.snapshots, self.embedding = transactions, snapshots, embedding
        self.default_model_id, self.clock = model_id, clock
        self.prompt_version = prompt_version
        self.authorizer = ControlAuthorizer()

    def _authorized(self, session, token):
        actor = self.authorizer.authenticate(session.authority, token)
        repo = self.authorizer.require(
            session.authority,
            actor,
            actor.scope,
            frozenset({Cap.REPOSITORY_READ, Cap.WORKFLOW_READ}),
        )
        return actor, repo

    def _source(self, session, actor, repo, snapshot_id):
        snapshot = self.snapshots.describe_in_transaction(
            session.snapshot, actor.scope, UUID(str(snapshot_id)), repo.identity
        )
        if sum(file.blob.byte_size for file in snapshot.files) > 131072:
            raise ContextError("CONTEXT_TOO_LARGE", 413)
        if not self.snapshots.matches_current_files(snapshot):
            raise ContextError("STALE_SNAPSHOT")
        return snapshot

    def _namespace(self, actor, repo, snapshot, purpose, model_id):
        return fingerprint(
            {
                "policy": POLICY,
                "owner": str(actor.principal_id),
                "credential_version": actor.credential_version,
                "tenant": str(actor.scope.tenant_id),
                "repo": str(actor.scope.repo_id),
                "identity": repo.identity,
                "epoch": repo.authority_epoch,
                "manifest": snapshot.manifest_blob.digest,
                "profile": snapshot.profile_blob.digest,
                "purpose": purpose,
                "intent": "full-authorized-source",
                "model": model_id,
                "prompt_version": self.prompt_version,
            }
        )

    def _validate_binding(self, actor, repo, snapshot, request, model_id):
        if (
            request.get("model", self.default_model_id) != model_id
            or self._namespace(actor, repo, snapshot, request["purpose"], model_id)
            != request["namespace"]
        ):
            raise ContextError("CONTEXT_REQUEST_MISMATCH")

    def validate_current(self, token, request, model_id):
        """Recheck trusted source/authority at generation boundaries, including repair turns."""
        with self.transactions.open() as session:
            actor, repo = self._authorized(session, token)
            stored = session.records.request(actor.scope, actor.principal_id, request["request_id"])
            if stored is None:
                raise ContextError("CONTEXT_REQUEST_UNAVAILABLE", 404)
            snapshot = self._source(session, actor, repo, stored["snapshot_id"])
            self._validate_binding(actor, repo, snapshot, stored, model_id)
        return repo, snapshot

    def prepare(self, token, snapshot_id, prompt, mode, purpose, *, model_id=None):
        model_id = self.default_model_id if model_id is None else model_id
        preparation_started = time.perf_counter()
        if (
            mode not in ("none", "local")
            or purpose not in ("inspect", "change")
            or type(prompt) is not str
            or not prompt.strip()
            or len(prompt) > 4000
        ):
            raise ContextError("INVALID_REQUEST", 400)
        with self.transactions.open() as session:
            actor, repo = self._authorized(session, token)
            snapshot = self._source(session, actor, repo, snapshot_id)
            namespace = self._namespace(actor, repo, snapshot, purpose, model_id)
        started = time.perf_counter()
        vector = self.embedding.embed(prompt) if mode == "local" else None
        embedding_ms = (time.perf_counter() - started) * 1000 if mode == "local" else 0.0
        with self.transactions.open() as session:
            current_actor, repo = self._authorized(session, token)
            snapshot = self._source(session, current_actor, repo, snapshot_id)
            if (
                current_actor != actor
                or self._namespace(actor, repo, snapshot, purpose, model_id) != namespace
            ):
                raise ContextError("CONTEXT_REQUEST_MISMATCH")
            now = self.clock()
            record = {
                "request_id": str(uuid4()),
                "snapshot_id": str(snapshot_id),
                "prompt": prompt,
                "mode": mode,
                "purpose": purpose,
                "model": model_id,
                "prompt_version": self.prompt_version,
                "intent": "full-authorized-source",
                "namespace": namespace,
                "partition": fingerprint(
                    {
                        "owner": str(actor.principal_id),
                        "scope": [str(actor.scope.tenant_id), str(actor.scope.repo_id)],
                    }
                ),
                "manifest_digest": snapshot.manifest_blob.digest,
                "query_fingerprint": fingerprint(prompt),
                "vector": vector,
                "created_at": now,
                "expires_at": now + 300,
                "embedding_calls": int(mode == "local"),
                "embedding_ms": embedding_ms,
                "preparation_ms": (time.perf_counter() - preparation_started) * 1000,
                "policy": POLICY,
            }
            session.records.add_request(actor.scope, actor.principal_id, record)
        return record

    def resolve(self, token, request_id, report, *, model_id=None):
        model_id = self.default_model_id if model_id is None else model_id
        started = time.perf_counter()
        with self.transactions.open() as session:
            actor, repo = self._authorized(session, token)
            request = session.records.request(actor.scope, actor.principal_id, request_id)
            if request is None:
                raise ContextError("CONTEXT_REQUEST_UNAVAILABLE", 404)
            if request["resolution"] is not None:
                raise ContextError("CONTEXT_REQUEST_ALREADY_BOUND")
            if request["expires_at"] <= self.clock():
                raise ContextError("CONTEXT_REQUEST_EXPIRED")
            snapshot = self._source(session, actor, repo, request["snapshot_id"])
            self._validate_binding(actor, repo, snapshot, request, model_id)
            decisions, payload, admission = [], None, None
            kind = report["kind"]
            if request["mode"] == "none":
                if kind != "not_applicable":
                    raise ContextError("LOOKUP_REPORT_MISMATCH", 400)
                outcome = "not_applicable"
            else:
                if kind not in ("candidate", "no_candidate", "client_storage_error"):
                    raise ContextError("LOOKUP_REPORT_MISMATCH", 400)
                if kind == "candidate":
                    for candidate in report["candidates"]:
                        entry = session.records.entry(
                            actor.scope, actor.principal_id, candidate["entry_id"]
                        )
                        reason = verify_candidate(candidate, entry, request, snapshot, self.clock())
                        decision = {
                            "entry_id": candidate["entry_id"],
                            "kind": candidate["kind"],
                            "reason": reason,
                            "score": candidate_score(candidate, entry, request),
                        }
                        decisions.append(decision)
                        if reason is None:
                            payload = candidate["payload"]
                            break
                    outcome = "hit" if payload else "rejected"
                else:
                    outcome = "miss" if kind == "no_candidate" else "client_storage_error"
            if payload is None:
                bundle = self.snapshots.read_in_transaction(
                    session.snapshot, actor.scope, snapshot.snapshot_id, repo.identity
                )
                try:
                    payload = {
                        "kind": "full-source-context-v1",
                        "files": [
                            {"path": file.path, "content": file.content.decode("utf-8")}
                            for file in bundle.files
                        ],
                    }
                except UnicodeError:
                    raise ContextError("CONTEXT_SOURCE_NOT_TEXT", 422) from None
                if request["mode"] == "local":
                    now = self.clock()
                    entry = {
                        k: request[k]
                        for k in (
                            "namespace",
                            "partition",
                            "purpose",
                            "intent",
                            "manifest_digest",
                            "query_fingerprint",
                            "vector",
                        )
                    }
                    entry.update(
                        entry_id=str(uuid4()),
                        payload_digest=fingerprint(payload),
                        created_at=now,
                        expires_at=now + POLICY["ttl_seconds"],
                    )
                    session.records.add_entry(actor.scope, actor.principal_id, entry)
                    admission = {**entry, "payload": payload}
            # Detect source changes during retrieval/verification, before releasing context.
            if not self.snapshots.matches_current_files(snapshot):
                raise ContextError("STALE_SNAPSHOT")
            resolution = {
                "outcome": outcome,
                "decisions": decisions,
                "resolution_ms": (time.perf_counter() - started) * 1000,
                "client_report": {
                    "state": report.get("client_state"),
                    "lookup_ms": report.get("lookup_ms"),
                },
            }
            session.records.bind(actor.scope, actor.principal_id, request_id, resolution)
            files = tuple(
                (file["path"], file["content"].removeprefix("\ufeff")) for file in payload["files"]
            )
        return (
            request,
            ResolvedContext(str(request_id), files, outcome, tuple(decisions), admission),
            resolution,
        )
