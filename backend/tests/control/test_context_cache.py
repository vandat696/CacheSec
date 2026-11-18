"""Deterministic cache checks with labeled in-memory authority/source/provider doubles."""

from contextlib import contextmanager
from copy import deepcopy
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.context_cache.context_contract import POLICY, ContextError, fingerprint, normalize_vector
from app.context_cache.context_service import ContextService
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlAuthorityUnavailable,
    ControlPrincipal,
    ControlResourceUnavailable,
    RegisteredRepository,
    RepositoryScope,
    control_token_digest,
)
from app.identity.control_authority import (
    ControlCapability as Cap,
)
from tests.control.test_repository_context import bundle_for

TOKEN = "context-test-only-" + "a" * 40


@pytest.fixture
def cache_env():
    scope = RepositoryScope(uuid4(), uuid4())
    actor = ControlPrincipal(scope, uuid4(), 1, control_token_digest(TOKEN))
    bundle = bundle_for(scope, (("a.py", b"source\r\n"), ("b.py", b"\xef\xbb\xbfsource\n")))
    env = SimpleNamespace(
        actor=actor,
        epoch=1,
        now=1000.0,
        grants=frozenset({Cap.REPOSITORY_READ, Cap.WORKFLOW_READ}),
        unavailable=False,
        fresh=True,
        requests={},
        entries={},
        reads=0,
        embeddings=[],
        commit_failure=False,
        bundle=bundle,
        after_embed=lambda: None,
    )

    class Authority:
        def find_credential(self, digest):
            if env.unavailable:
                raise ControlAuthorityUnavailable()
            return env.actor if env.actor.token_digest == digest else None

        def lock_scope(self, requested):
            return (
                RegisteredRepository(requested, bundle.snapshot.repository_identity, env.epoch)
                if requested == env.actor.scope
                else None
            )

        def get_principal(self, requested, principal_id):
            return (
                env.actor
                if requested == env.actor.scope and principal_id == env.actor.principal_id
                else None
            )

        def capabilities(self, requested, principal_id):
            return env.grants

    class Records:
        def add_request(self, scope, owner, record):
            env.requests[(scope, owner, record["request_id"])] = {
                **deepcopy(record),
                "resolution": None,
            }

        def request(self, scope, owner, request_id):
            return deepcopy(env.requests.get((scope, owner, str(request_id))))

        def bind(self, scope, owner, request_id, resolution):
            env.requests[(scope, owner, str(request_id))]["resolution"] = deepcopy(resolution)

        def add_entry(self, scope, owner, record):
            env.entries[(scope, owner, record["entry_id"])] = deepcopy(record)

        def entry(self, scope, owner, entry_id):
            return deepcopy(env.entries.get((scope, owner, str(entry_id))))

    class Transactions:
        @contextmanager
        def open(self):
            before = deepcopy((env.requests, env.entries))
            try:
                yield SimpleNamespace(authority=Authority(), snapshot=None, records=Records())
                if env.commit_failure:
                    raise ContextError("CONTEXT_STORAGE_UNAVAILABLE", 503)
            except BaseException:
                env.requests, env.entries = before
                raise

    class Snapshots:
        def describe_in_transaction(self, session, requested, snapshot_id, identity):
            if requested != bundle.snapshot.scope or snapshot_id != bundle.snapshot.snapshot_id:
                raise ControlResourceUnavailable()
            return bundle.snapshot

        def matches_current_files(self, snapshot):
            return env.fresh

        def read_in_transaction(self, session, requested, snapshot_id, identity):
            env.reads += 1
            return bundle

    class Embedding:
        def embed(self, prompt):
            env.embeddings.append(prompt)
            env.after_embed()
            return [1.0] + [0.0] * 767

    env.service = ContextService(
        Transactions(), Snapshots(), Embedding(), "test-only-model", lambda: env.now
    )
    env.prepare = lambda mode="local", prompt="explain", purpose="inspect": env.service.prepare(
        TOKEN, bundle.snapshot.snapshot_id, prompt, mode, purpose
    )
    env.resolve = lambda request, report: env.service.resolve(TOKEN, request["request_id"], report)
    return env


def admit(env):
    request = env.prepare()
    _, resolved, _ = env.resolve(request, {"kind": "no_candidate"})
    assert resolved.outcome == "miss" and resolved.admission is not None
    return resolved.admission


def candidate(entry, kind="exact"):
    return {"entry_id": entry["entry_id"], "kind": kind, "payload": deepcopy(entry["payload"])}


def test_cold_admission_verified_hit_avoids_payload_retrieval_and_never_caches_server_payload(
    cache_env,
):
    env = cache_env
    entry = admit(env)
    assert env.reads == 1
    assert all("payload" not in record for record in env.entries.values())
    request = env.prepare()
    _, resolved, _ = env.resolve(request, {"kind": "candidate", "candidates": [candidate(entry)]})
    assert resolved.outcome == "hit" and resolved.admission is None and env.reads == 1
    assert resolved.files == (("a.py", "source\r\n"), ("b.py", "source\n"))


def test_none_skips_embedding_lookup_and_admission(cache_env):
    env = cache_env
    request = env.prepare("none")
    _, resolved, _ = env.resolve(request, {"kind": "not_applicable"})
    assert resolved.outcome == "not_applicable" and resolved.admission is None
    assert env.embeddings == [] and env.entries == {} and env.reads == 1


@pytest.mark.parametrize(
    "mutation,reason",
    [
        ("tamper", "INTEGRITY_MISMATCH"),
        ("expired", "EXPIRED"),
        ("unknown", "ENTRY_UNKNOWN"),
        ("purpose", "SCOPE_OR_CONFIG_MISMATCH"),
        ("query", "QUERY_MISMATCH"),
        ("threshold", "BELOW_THRESHOLD"),
    ],
)
def test_candidate_rejected_then_authorized_retrieval(cache_env, mutation, reason):
    env = cache_env
    entry = admit(env)
    report_candidate = candidate(entry, "semantic" if mutation == "threshold" else "exact")
    if mutation == "tamper":
        report_candidate["payload"]["files"][0]["content"] = "hostile content"
    elif mutation == "expired":
        env.now += POLICY["ttl_seconds"]
    elif mutation == "unknown":
        report_candidate["entry_id"] = str(uuid4())
    request = env.prepare(
        prompt="different" if mutation == "query" else "explain",
        purpose="change" if mutation == "purpose" else "inspect",
    )
    if mutation == "threshold":
        stored = env.requests[(env.actor.scope, env.actor.principal_id, request["request_id"])]
        stored["vector"] = [0.0, 1.0] + [0.0] * 766
    _, resolved, _ = env.resolve(request, {"kind": "candidate", "candidates": [report_candidate]})
    assert resolved.outcome == "rejected" and resolved.decisions[0]["reason"] == reason
    assert env.reads == 2 and resolved.files[0][1] == "source\r\n"


def test_semantic_uses_backend_vectors_and_retains_prior_rejection(cache_env):
    env = cache_env
    entry = admit(env)
    request = env.prepare(prompt="paraphrase")
    unknown = candidate({**entry, "entry_id": str(uuid4())})
    _, resolved, _ = env.resolve(
        request, {"kind": "candidate", "candidates": [unknown, candidate(entry, "semantic")]}
    )
    assert resolved.outcome == "hit" and len(resolved.decisions) == 2
    assert resolved.decisions[-1]["score"] == 1.0
    assert env.reads == 1


@pytest.mark.parametrize("mode", ["none", "local"])
@pytest.mark.parametrize(
    "failure,error",
    [
        ("grants", ControlAccessDenied),
        ("unavailable", ControlAuthorityUnavailable),
        ("fresh", ContextError),
    ],
)
def test_revoke_outage_and_source_change_fail_closed(cache_env, mode, failure, error):
    env = cache_env
    entry = admit(env)
    request = env.prepare(mode)
    setattr(env, failure, frozenset() if failure == "grants" else failure == "unavailable")
    with pytest.raises(error):
        env.resolve(
            request,
            {"kind": "not_applicable"}
            if mode == "none"
            else {"kind": "candidate", "candidates": [candidate(entry)]},
        )
    assert env.reads == 1


def test_embedding_source_race_and_authority_epoch_change_do_not_publish_request(cache_env):
    env = cache_env
    env.after_embed = lambda: setattr(env, "epoch", 2)
    with pytest.raises(ContextError, match="CONTEXT_REQUEST_MISMATCH"):
        env.prepare()
    assert not env.requests


def test_request_is_one_use_and_expired_request_cannot_generate(cache_env):
    env = cache_env
    request = env.prepare("none")
    env.resolve(request, {"kind": "not_applicable"})
    with pytest.raises(ContextError, match="CONTEXT_REQUEST_ALREADY_BOUND"):
        env.resolve(request, {"kind": "not_applicable"})
    request = env.prepare()
    env.now += 300
    with pytest.raises(ContextError, match="CONTEXT_REQUEST_EXPIRED"):
        env.resolve(request, {"kind": "no_candidate"})


def test_cross_owner_and_tenant_ids_are_not_readable(cache_env):
    env = cache_env
    request = env.prepare()
    for actor in (
        replace(env.actor, principal_id=uuid4()),
        replace(env.actor, scope=RepositoryScope(uuid4(), uuid4())),
    ):
        env.actor = actor
        with pytest.raises(ContextError, match="CONTEXT_REQUEST_UNAVAILABLE"):
            env.resolve(request, {"kind": "no_candidate"})
    assert env.reads == 0


def test_commit_failure_does_not_publish_admission_or_resolution(cache_env):
    env = cache_env
    request = env.prepare()
    env.commit_failure = True
    with pytest.raises(ContextError, match="CONTEXT_STORAGE_UNAVAILABLE"):
        env.resolve(request, {"kind": "no_candidate"})
    assert (
        not env.entries
        and env.requests[(env.actor.scope, env.actor.principal_id, request["request_id"])][
            "resolution"
        ]
        is None
    )


@pytest.mark.parametrize(
    "vector",
    [None, [0.0] * 768, [float("nan")] * 768, [float("inf")] * 768, [True] * 768, [1.0] * 767],
    ids=["missing", "zero", "nan", "infinite", "boolean", "dimension"],
)
def test_embedding_invalid_vectors_fail_closed(vector):
    with pytest.raises(ContextError, match="EMBEDDING_INVALID_RESPONSE"):
        normalize_vector(vector)


def test_embedding_normalization_is_finite():
    assert normalize_vector([3.0, 4.0] + [0.0] * 766)[:2] == [0.6, 0.8]
    assert fingerprint({"a": 1, "b": 2}) == fingerprint({"b": 2, "a": 1})
