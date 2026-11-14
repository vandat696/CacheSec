"""Single-process local run registry with bounded retention and one active run."""

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from app.agent_assistance.generation import AgentError
from app.agent_assistance.run_models import DEADLINE_SECONDS, MAX_TURNS, TERMINAL_RUNS, AgentRun
from app.identity.control_authority import ControlResourceUnavailable


def timestamp():
    return datetime.now(timezone.utc).isoformat()


class LocalAgentRunStore:
    def __init__(self):
        self.lock = RLock()
        self.records = {}
        self.requests = {}
        self.active = None

    def reserve(self, actor, token, snapshot_id, prompt, key, fingerprint, model, clock):
        with self.lock:
            identity = (actor.scope, actor.principal_id, actor.credential_version, key)
            if identity in self.requests:
                run = self.records[self.requests[identity]]
                if run.fingerprint != fingerprint:
                    raise AgentError("IDEMPOTENCY_CONFLICT", 409)
                if run.actor != actor:
                    raise ControlResourceUnavailable()
                return run, False
            if self.active is not None:
                raise AgentError("AGENT_BUSY", 409)
            if len(self.records) >= 100:
                raise AgentError("AGENT_RUN_LIMIT", 503)
            run = AgentRun(
                uuid4(), actor, token, fingerprint, snapshot_id, prompt, clock(), timestamp(), model
            )
            self.records[run.run_id] = run
            self.requests[identity] = run.run_id
            self.active = run.run_id
            return run, True

    def owned(self, run_id, actor):
        with self.lock:
            run = self.records.get(run_id)
            if run is None or run.actor != actor:
                raise ControlResourceUnavailable()
            return run

    def active_for(self, actor):
        with self.lock:
            run = self.records.get(self.active)
            return str(run.run_id) if run is not None and run.actor == actor else None

    def update(self, run, **changes):
        with self.lock:
            if run.status in TERMINAL_RUNS:
                return
            for key, value in changes.items():
                setattr(run, key, value)

    def event(self, run, tool, state, **details):
        with self.lock:
            if run.status not in TERMINAL_RUNS:
                run.events.append(
                    {
                        "sequence": len(run.events) + 1,
                        "at": timestamp(),
                        "turn": run.turn,
                        "tool": tool,
                        "state": state,
                        **details,
                    }
                )

    def finish(self, run, status, error_code=None):
        with self.lock:
            if run.status in TERMINAL_RUNS:
                return
            self.event(run, "run", status)
            run.status, run.error_code, run.token = status, error_code, None
            if self.active == run.run_id:
                self.active = None

    def view(self, run):
        with self.lock:
            revision = run.revision
            return deepcopy(
                {
                    "run_id": str(run.run_id),
                    "tenant_id": str(run.actor.scope.tenant_id),
                    "repo_id": str(run.actor.scope.repo_id),
                    "snapshot_id": str(run.snapshot_id),
                    "status": run.status,
                    "turn": run.turn,
                    "max_turns": MAX_TURNS,
                    "deadline_seconds": DEADLINE_SECONDS,
                    "model": run.model,
                    "created_at": run.created_at,
                    "answer": run.answer,
                    "error_code": run.error_code,
                    "proposal_id": str(revision["proposal_id"]) if revision else None,
                    "revision": revision["revision"] if revision else None,
                    "artifact_digest": revision["artifact_digest"] if revision else None,
                    "test_job_id": str(run.job["job_id"]) if run.job else None,
                    "test_status": run.job["status"] if run.job else None,
                    "test_may_continue": bool(
                        run.job and run.job["status"] in {"queued", "preparing", "running"}
                    ),
                    "events": run.events,
                }
            )

    def cancel(self, run):
        with self.lock:
            if run.status not in TERMINAL_RUNS and not run.cancelled.is_set():
                run.cancelled.set()
                self.event(run, "run", "cancel_requested")

    def cancel_all(self):
        with self.lock:
            for run in self.records.values():
                if run.status not in TERMINAL_RUNS:
                    run.cancelled.set()
