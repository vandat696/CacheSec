"""Owned None/Local pairs reuse the bounded Agent loop with separate revision streams."""

import hashlib
from threading import RLock
from uuid import UUID, uuid4

from app.agent_assistance.generation import AgentError
from app.agent_assistance.run_models import TERMINAL_RUNS
from app.agent_assistance.run_service import AgentRunService
from app.agent_assistance.run_store import LocalAgentRunStore, timestamp
from app.agent_assistance.workflow_run_tools import WorkflowRunAccess, WorkflowRunTools
from app.context_cache.context_contract import POLICY, ContextError, fingerprint
from app.identity.control_authority import ControlAuthorizer
from app.identity.control_authority import ControlCapability as Cap


class BoundContextGeneration:
    """Internal adapter: a branch cannot change the prompt/snapshot of its context request."""

    def __init__(self, assistance, cached, request, resolved):
        self.assistance, self.cached, self.request, self.resolved = (
            assistance,
            cached,
            request,
            resolved,
        )

    def config(self, token, model_id=None):
        return self.assistance.config(token, model_id)

    def ask(self, token, snapshot_id, prompt, history, candidate=None, *, model_id):
        if (
            str(snapshot_id) != self.request["snapshot_id"]
            or prompt != self.request["prompt"]
            or model_id != self.request.get("model", self.assistance.models.default.model_id)
        ):
            raise AgentError("AGENT_BINDING_MISMATCH", 409)
        try:
            return self.cached.generate(token, self.request, self.resolved, history, candidate)
        except ContextError as error:
            raise AgentError(error.code, error.status) from None


class ComparisonService:
    def __init__(self, transactions, contexts, assistance, cached, proposals, executor):
        self.transactions, self.contexts, self.assistance = transactions, contexts, assistance
        self.cached, self.proposals, self.executor = cached, proposals, executor
        self.instance = str(uuid4())
        self.authorizer, self.lock, self.active = ControlAuthorizer(), RLock(), {}

    def _authorized(self, session, token):
        actor = self.authorizer.authenticate(session.authority, token)
        self.authorizer.require(
            session.authority,
            actor,
            actor.scope,
            frozenset({Cap.REPOSITORY_READ, Cap.WORKFLOW_READ}),
        )
        return actor

    def _owned(self, session, token, pair_id):
        actor = self._authorized(session, token)
        pair = session.records.get(actor.scope, actor.principal_id, pair_id)
        if pair is None:
            raise ContextError("COMPARISON_UNAVAILABLE", 404)
        return actor, pair

    def create(self, token, snapshot_id, prompt, key, cache_state, model_id=None, session_id=None):
        if (
            not key
            or not key.isascii()
            or not 1 <= len(key) <= 128
            or any(not 33 <= ord(c) <= 126 for c in key)
        ):
            raise ContextError("INVALID_IDEMPOTENCY_KEY", 400)
        if (
            not prompt.strip()
            or len(prompt) > 4000
            or cache_state not in ("cold", "warm", "preload")
        ):
            raise ContextError("INVALID_REQUEST", 400)
        config = self.assistance.config(token, model_id)
        if not config["configured"]:
            raise AgentError("MODEL_NOT_CONFIGURED")
        WorkflowRunAccess(self.proposals).current(token, execute=True)
        key_digest = hashlib.sha256(key.encode()).hexdigest()
        binding = {
            "snapshot_id": str(snapshot_id),
            "prompt": prompt,
            "cache_state": cache_state,
            "model": config["model"],
            "policy": POLICY,
        }
        if session_id is not None:
            binding["session_id"] = str(session_id)
        binding = fingerprint(binding)
        with self.transactions.open() as session:
            actor = self._authorized(session, token)
            existing = session.records.by_key(actor.scope, actor.principal_id, key_digest)
            if existing:
                if existing["fingerprint"] != binding:
                    raise ContextError("IDEMPOTENCY_CONFLICT")
                return existing
            if session_id is not None:
                self._session_root(session, actor, session_id)
            pair_id = str(uuid4())
            pair = {
                "pair_id": pair_id,
                "session_id": str(session_id) if session_id is not None else pair_id,
                "snapshot_id": str(snapshot_id),
                "prompt": prompt,
                "model": config["model"],
                "fingerprint": binding,
                "cache_state": cache_state,
                "policy": POLICY,
                "created_at": timestamp(),
                "status": "preparing",
                "instance": self.instance,
                "branches": {
                    mode: {"mode": mode, "status": "preparing", "run": None}
                    for mode in ("none", "local")
                },
            }
            session.records.add(actor.scope, actor.principal_id, key_digest, pair)
        try:
            requests, preparation_errors = {}, {}
            for mode in ("none", "local"):
                try:
                    requests[mode] = self.contexts.prepare(
                        token, snapshot_id, prompt, mode, "change", model_id=pair["model"]
                    )
                except ContextError as error:
                    if mode != "local" or not error.code.startswith("EMBEDDING_"):
                        raise
                    preparation_errors[mode] = error.code
            with self.transactions.open() as session:
                actor, pair = self._owned(session, token, pair["pair_id"])
                pair["status"] = "ready"
                for mode, request in requests.items():
                    pair["branches"][mode].update(status="ready", context_request=request)
                for mode, code in preparation_errors.items():
                    pair["branches"][mode].update(status="error", error_code=code)
                session.records.update(actor.scope, actor.principal_id, pair)
        except Exception as error:
            # No token, exception text, model payload or source bytes enter this journal.
            with self.transactions.open() as session:
                stored = session.records.get(actor.scope, actor.principal_id, pair["pair_id"])
                stored.update(
                    status="error",
                    error_code=getattr(error, "code", "COMPARISON_PREPARATION_FAILED"),
                )
                for branch in stored["branches"].values():
                    branch.update(status="error", error_code=stored["error_code"])
                session.records.update(actor.scope, actor.principal_id, stored)
            raise
        return pair

    def start(self, token, pair_id, mode, report):
        if mode not in ("none", "local"):
            raise ContextError("INVALID_REQUEST", 400)
        WorkflowRunAccess(self.proposals).current(token, execute=True)
        with self.transactions.open() as session:
            actor, pair = self._owned(session, token, pair_id)
            branch = pair["branches"][mode]
            if branch["status"] != "ready":
                return {
                    "pair_id": str(pair_id),
                    "mode": mode,
                    "status": branch["status"],
                    "admission": None,
                }
            branch.update(status="starting", instance=self.instance, started_at=timestamp())
            session.records.update(actor.scope, actor.principal_id, pair)
        try:
            request, resolved, resolution = self.contexts.resolve(
                token, UUID(branch["context_request"]["request_id"]), report, model_id=pair["model"]
            )
            with self.transactions.open() as session:
                actor, current = self._owned(session, token, pair_id)
                current["branches"][mode].update(
                    context={
                        **resolution,
                        "embedding_calls": request["embedding_calls"],
                        "embedding_ms": request["embedding_ms"],
                    },
                    admission_entry_id=resolved.admission["entry_id"]
                    if resolved.admission
                    else None,
                )
                session.records.update(actor.scope, actor.principal_id, current)

            def checkpoint(run):
                # Worker journal write to its fixed pair/owner, never a client-selected resource.
                with self.transactions.open() as session:
                    session.authority.lock_scope(actor.scope)
                    session.records.checkpoint(
                        actor.scope, actor.principal_id, pair_id, mode, self.instance, run
                    )
                if run["status"] in TERMINAL_RUNS:
                    with self.lock:
                        self.active.pop((str(pair_id), mode), None)

            store = LocalAgentRunStore(checkpoint)
            run_service = AgentRunService(
                WorkflowRunAccess(self.proposals),
                BoundContextGeneration(self.assistance, self.cached, request, resolved),
                WorkflowRunTools(self.proposals),
                store,
                self.executor,
            )
            run = run_service.start(
                token,
                UUID(pair["snapshot_id"]),
                pair["prompt"],
                f"comparison-{pair_id}-{mode}",
                pair["model"],
            )
            with self.lock:
                if run["status"] not in TERMINAL_RUNS:
                    self.active[(str(pair_id), mode)] = (run_service, UUID(run["run_id"]))
            return {
                "pair_id": str(pair_id),
                "mode": mode,
                "status": run["status"],
                "admission": resolved.admission,
            }
        except Exception as error:
            with self.transactions.open() as session:
                stored = session.records.get(actor.scope, actor.principal_id, pair_id)
                stored["branches"][mode].update(
                    status="error", error_code=getattr(error, "code", "COMPARISON_START_FAILED")
                )
                session.records.update(actor.scope, actor.principal_id, stored)
            raise

    def get(self, token, pair_id):
        with self.lock:
            failed = {
                mode
                for (current_id, mode), (service, _) in self.active.items()
                if current_id == str(pair_id) and service.store.checkpoint_failed
            }
        with self.transactions.open() as session:
            actor, pair = self._owned(session, token, pair_id)
            changed = False
            if pair["status"] == "preparing" and pair["instance"] != self.instance:
                pair.update(status="incomplete", error_code="PROCESS_INTERRUPTED")
                for branch in pair["branches"].values():
                    branch.update(status="incomplete", error_code="PROCESS_INTERRUPTED")
                changed = True
            for branch in pair["branches"].values():
                branch["assessments"] = session.records.assessments(
                    actor.scope, actor.principal_id, pair_id, branch["mode"]
                )
                if branch["mode"] in failed:
                    branch.update(status="incomplete", error_code="CHECKPOINT_FAILED")
                    changed = True
                if (
                    branch["status"] not in {*TERMINAL_RUNS, "ready", "preparing", "incomplete"}
                    and branch.get("instance") != self.instance
                ):
                    branch.update(status="incomplete", error_code="PROCESS_INTERRUPTED")
                    changed = True
            if changed:
                session.records.update(actor.scope, actor.principal_id, pair)
        for branch in pair["branches"].values():
            run = branch.get("run")
            branch["revisions"] = []
            if run:
                for event in run["events"]:
                    if event["tool"] == "save_revision" and event["state"] == "completed":
                        revision = self.proposals.get(
                            token, UUID(event["proposal_id"]), event["revision"]
                        )
                        revision["tests"] = [
                            job
                            for job in revision["tests"]
                            if job["revision"] == revision["revision"]
                        ]
                        branch["revisions"].append(revision)
        return pair

    def list(self, token):
        with self.transactions.open() as session:
            actor = self._authorized(session, token)
            return session.records.list(actor.scope, actor.principal_id)

    def _session_root(self, session, actor, session_id):
        root = session.records.get(actor.scope, actor.principal_id, session_id)
        if root is None or root.get("session_id", root["pair_id"]) != str(session_id):
            raise ContextError("COMPARISON_UNAVAILABLE", 404)

    def turns(self, token, session_id):
        with self.transactions.open() as session:
            actor = self._authorized(session, token)
            self._session_root(session, actor, session_id)
            return {
                "session_id": str(session_id),
                "turns": session.records.turns(actor.scope, actor.principal_id, session_id),
            }

    def cancel(self, token, pair_id, mode):
        with self.transactions.open() as session:
            self._owned(session, token, pair_id)
        with self.lock:
            active = self.active.get((str(pair_id), mode))
        if active:
            service, run_id = active
            service.cancel(token, run_id)
        return self.get(token, pair_id)

    def record_cache_io(self, token, pair_id, report):
        """Store bounded client telemetry, never a trusted verification/admission decision."""
        with self.transactions.open() as session:
            actor, pair = self._owned(session, token, pair_id)
            branch = pair["branches"]["local"]
            if report["entry_id"] != branch.get("admission_entry_id"):
                raise ContextError("CACHE_IO_BINDING_MISMATCH")
            reports = branch.setdefault("client_cache_io", [])
            previous = next(
                (item for item in reports if item["report_id"] == report["report_id"]), None
            )
            if previous is not None:
                if previous != report:
                    raise ContextError("IDEMPOTENCY_CONFLICT")
            else:
                if len(reports) >= 10:
                    raise ContextError("CACHE_IO_REPORT_LIMIT")
                reports.append(report)
                session.records.update(actor.scope, actor.principal_id, pair)
        return {"recorded": True}

    def shutdown(self):
        with self.lock:
            active = list(self.active.values())
        for service, _ in active:
            service.shutdown()
