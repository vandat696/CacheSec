"""Bounded coding loop over scoped generation, immutable revisions and trusted test jobs."""

import hashlib
import json
import time
from concurrent.futures import Executor

from app.agent_assistance.generation import AgentError
from app.agent_assistance.run_models import (
    DEADLINE_SECONDS,
    MAX_TURNS,
    TERMINAL_RUNS,
    RunAccess,
    RunGeneration,
    RunTools,
)
from app.agent_assistance.run_store import LocalAgentRunStore
from app.change_workflow.workflow_models import TERMINAL_STATUSES
from app.change_workflow.workflow_repository import WorkflowError, WorkflowStorageUnavailable
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlAuthorityUnavailable,
    ControlIdentityRequired,
    ControlResourceUnavailable,
)


class RunStopped(Exception):
    def __init__(self, status):
        self.status = status


class AgentRunService:
    def __init__(
        self,
        access: RunAccess,
        generation: RunGeneration,
        tools: RunTools,
        store: LocalAgentRunStore,
        executor: Executor,
        clock=time.monotonic,
    ):
        self.access, self.generation, self.tools = access, generation, tools
        self.store, self.executor, self.clock = store, executor, clock

    def config(self, token):
        try:
            self.access.current(token, execute=True)
            allowed = True
        except ControlAccessDenied:
            allowed = False
        active = None
        try:
            actor = self.access.current(token, execute=False)
            active = self.store.active_for(actor)
        except ControlAccessDenied:
            pass
        return {
            "can_start": allowed,
            "max_turns": MAX_TURNS,
            "deadline_seconds": DEADLINE_SECONDS,
            "persistence": "process",
            "active_run_id": active,
        }

    def start(self, token, snapshot_id, prompt, key):
        actor = self.access.current(token, execute=True)
        if (
            not key
            or len(key) > 128
            or not key.isascii()
            or any(not 33 <= ord(c) <= 126 for c in key)
        ):
            raise AgentError("INVALID_IDEMPOTENCY_KEY", 400)
        if not prompt.strip() or len(prompt) > 4000:
            raise AgentError("INVALID_REQUEST", 400)
        config = self.generation.config(token)
        if not config["configured"]:
            raise AgentError("MODEL_NOT_CONFIGURED")
        digest = hashlib.sha256(
            json.dumps({"snapshot_id": str(snapshot_id), "prompt": prompt}, sort_keys=True).encode()
        ).hexdigest()
        key_digest = hashlib.sha256(key.encode()).hexdigest()
        run, created = self.store.reserve(
            actor, token, snapshot_id, prompt, key_digest, digest, config["model"], self.clock
        )
        if created:
            try:
                self.executor.submit(self._execute, run)
            except Exception:
                self.store.finish(run, "error", "AGENT_EXECUTOR_UNAVAILABLE")
        return self.store.view(run)

    def get(self, token, run_id):
        actor = self.access.current(token, execute=False)
        return self.store.view(self.store.owned(run_id, actor))

    def cancel(self, token, run_id):
        actor = self.access.current(token, execute=False)
        run = self.store.owned(run_id, actor)
        self.store.cancel(run)
        return self.store.view(run)

    def shutdown(self):
        self.store.cancel_all()

    def _guard(self, run, token):
        if run.cancelled.is_set():
            raise RunStopped("cancelled")
        if self.clock() - run.started >= DEADLINE_SECONDS:
            raise RunStopped("timed_out")
        if self.access.current(token, execute=True) != run.actor:
            raise AgentError("AGENT_REQUESTER_CHANGED", 403)

    def _bound_job(self, job, revision, expected_id=None):
        if expected_id is not None and job["job_id"] != expected_id:
            raise AgentError("AGENT_BINDING_MISMATCH", 409)
        if any(
            job[key] != revision[key]
            for key in ("proposal_id", "revision", "artifact_digest", "profile_digest")
        ):
            raise AgentError("AGENT_BINDING_MISMATCH", 409)
        if job["status"] == "passed" and (
            not job.get("evidence_digest")
            or not job.get("result")
            or job["result"].get("outcome") != "passed"
        ):
            raise AgentError("AGENT_BINDING_MISMATCH", 409)

    def _execute(self, run):
        token = run.token
        try:
            self._guard(run, token)
            self.tools.check_source(token, run.snapshot_id)
            self.store.event(run, "read_source", "completed")
            candidate, feedback = None, None
            for turn in range(1, MAX_TURNS + 1):
                self._guard(run, token)
                self.store.update(run, status="generating", turn=turn)
                history = (
                    []
                    if feedback is None
                    else [
                        {
                            "role": "user",
                            "content": json.dumps(
                                {
                                    "kind": "trusted_technical_test_feedback",
                                    "result": feedback,
                                    "instruction": (
                                        "Repair the current candidate from reported test failures. "
                                        "Keep interfaces, tests and policy. "
                                        "Do not claim acceptance."
                                    ),
                                }
                            ),
                        }
                    ]
                )
                self.store.event(run, "generate", "started")
                reply = self.generation.ask(token, run.snapshot_id, run.prompt, history, candidate)
                self._guard(run, token)
                if reply["snapshot_id"] != str(run.snapshot_id) or not (
                    reply["model"] == run.model or reply["model"].startswith(run.model + "-")
                ):
                    raise AgentError("AGENT_BINDING_MISMATCH", 409)
                self.store.event(
                    run, "generate", "completed", model=reply["model"], usage=reply["usage"]
                )
                self.store.update(run, answer=reply["answer"])
                if reply["content"] is None:
                    self.store.finish(run, "needs_input")
                    return
                self.store.update(run, status="saving")
                self._guard(run, token)
                self.store.event(run, "save_revision", "started")
                revision = self.tools.save(
                    token,
                    run.snapshot_id,
                    reply["content"],
                    f"agent-{run.run_id}-{turn}-save",
                    run.revision,
                )
                self.store.update(run, revision=revision, job=None)
                self.store.event(
                    run,
                    "save_revision",
                    "completed",
                    proposal_id=str(revision["proposal_id"]),
                    revision=revision["revision"],
                    artifact_digest=revision["artifact_digest"],
                )
                self._guard(run, token)
                self.store.update(run, status="testing")
                self.store.event(run, "test", "started", revision=revision["revision"])
                job = self.tools.request_test(token, revision, f"agent-{run.run_id}-{turn}-test")
                self._bound_job(job, revision)
                self.store.update(run, job=job)
                self.store.event(
                    run,
                    "test",
                    "accepted",
                    job_id=str(job["job_id"]),
                    revision=revision["revision"],
                )
                job_id = job["job_id"]
                while job["status"] not in TERMINAL_STATUSES:
                    self._guard(run, token)
                    run.cancelled.wait(0.5)
                    self._guard(run, token)
                    job = self.tools.job(token, job_id)
                    self._bound_job(job, revision, job_id)
                    self.store.update(run, job=job)
                self._guard(run, token)
                self.store.event(
                    run,
                    "test",
                    job["status"],
                    job_id=str(job_id),
                    evidence_digest=job.get("evidence_digest"),
                )
                if job["status"] == "passed":
                    self.store.finish(run, "passed")
                    return
                if job["status"] != "failed":
                    self.store.finish(run, "error", "AGENT_TEST_" + job["status"].upper())
                    return
                feedback = job["result"]
                current = self.tools.revision(token, revision["proposal_id"])
                if any(
                    current[k] != revision[k]
                    for k in ("revision", "artifact_digest", "profile_digest")
                ):
                    raise AgentError("AGENT_BINDING_MISMATCH", 409)
                candidate = current["content"]
            self.store.finish(run, "exhausted")
        except RunStopped as error:
            self.store.finish(run, error.status)
        except (ControlAccessDenied, ControlIdentityRequired, ControlResourceUnavailable):
            self.store.finish(run, "error", "AGENT_ACCESS_REVOKED")
        except (ControlAuthorityUnavailable, WorkflowStorageUnavailable):
            self.store.event(run, "storage", "effect_unknown")
            self.store.finish(run, "error", "STORAGE_UNAVAILABLE")
        except (AgentError, WorkflowError) as error:
            self.store.finish(
                run, "needs_input" if error.code == "NO_CHANGE" else "error", error.code
            )
        except Exception:
            # Preserve resource references, discard credentials and never expose raw exceptions.
            self.store.finish(run, "error", "AGENT_INTERNAL_ERROR")
        finally:
            if run.status not in TERMINAL_RUNS:
                self.store.finish(run, "error", "AGENT_INTERRUPTED")
