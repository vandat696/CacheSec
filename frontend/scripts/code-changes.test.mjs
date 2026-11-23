import assert from "node:assert/strict";
import test from "node:test";
import { ChangeWorkflowClient, editorContent, editablePath } from "../src/features/code-changes/changeWorkflowApi.ts";
import { submitCodeChange } from "../src/features/code-changes/changeSubmission.ts";
import { waitForOperation } from "../src/features/code-changes/workspaceOperations.ts";
import { deploymentRevisionKey, passedDeploymentTest } from "../src/features/code-changes/deploymentSelection.ts";

const proposal = "10000000-0000-4000-8000-000000000001";
const snapshot = "10000000-0000-4000-8000-000000000002";
const jobId = "10000000-0000-4000-8000-000000000003";
const hash = "sha256:" + "a".repeat(64);
const revision = { proposal_id: proposal, revision: 1, base_snapshot_id: snapshot,
  candidate_snapshot_id: snapshot, artifact_digest: hash, patch_digest: hash, profile_digest: hash,
  created_at: "2026-11-11T00:00:00Z", path: editablePath, base_text: "base\r\n",
  content: "candidate\r\n", diff: "-base\r\n+candidate\r\n", tests: [] };
const queued = { job_id: jobId, proposal_id: proposal, revision: 1, artifact_digest: hash,
  profile_digest: hash, status: "queued", evidence_digest: null, result: null };
const signal = () => new AbortController().signal;

test("deployment selection never borrows another branch's test or approval binding", () => {
  const passed = { ...queued, status: "passed", evidence_digest: hash };
  assert.equal(passedDeploymentTest(revision, [passed]), passed);
  for (const changes of [
    { proposal_id: snapshot }, { revision: 2 }, { artifact_digest: "sha256:" + "b".repeat(64) },
    { profile_digest: "sha256:" + "b".repeat(64) }, { evidence_digest: null }, { status: "failed" },
  ]) assert.equal(passedDeploymentTest(revision, [{ ...passed, ...changes }]), undefined);
  assert.notEqual(deploymentRevisionKey(revision), deploymentRevisionKey({ ...revision, proposal_id: snapshot }));
  assert.notEqual(deploymentRevisionKey(revision), deploymentRevisionKey({ ...revision, revision: 2 }));
});
const envelope = data => ({ data, meta: { contract_version: "v0.2", identity_mode: "fixture", request_id: proposal } });
const sourceOperation = { id: jobId, kind: "write", status: "queued", proposal_id: proposal, revision: 1,
  artifact_digest: hash, profile_digest: hash, job_id: null, evidence_digest: null, created_at: 1,
  source_digest: hash, reason: null, container_name: null, target_version: null, approval_id: null };

test("real source save binds a revision and expected source snapshot, never a path or shell command", async () => {
  let body;
  const api = new ChangeWorkflowClient("http://local", "token", async (_url, init) => {
    body = JSON.parse(init.body); return Response.json(envelope(sourceOperation));
  });
  await api.source(revision, snapshot, "source-key", signal());
  assert.deepEqual(body, { proposal_id: proposal, revision: 1, artifact_digest: hash, expected_snapshot_id: snapshot });
  for (const changes of [{ revision: 2 }, { proposal_id: snapshot }, { source_digest: null }, { kind: "approval" }]) {
    const bad = new ChangeWorkflowClient("http://local", "token", async () => Response.json(envelope({ ...sourceOperation, ...changes })));
    await assert.rejects(bad.source(revision, snapshot, "key", signal()), e => e.status === 502);
  }
});

test("source save is successful only after the worker confirms it; unknown never becomes saved", async () => {
  let polls = 0;
  const api = { async operation() { polls++; return { ...sourceOperation, status: "succeeded" }; } };
  assert.equal((await waitForOperation(api, sourceOperation, signal())).status, "succeeded");
  assert.equal(polls, 1);
  await assert.rejects(waitForOperation(api, { ...sourceOperation, status: "unknown" }, signal()), e => e.code === "OPERATION_UNKNOWN");
  await assert.rejects(waitForOperation(api, { ...sourceOperation, status: "failed", reason: "SOURCE_CONFLICT" }, signal()), e => e.code === "SOURCE_CONFLICT");
});

test("approval refuses missing evidence before HTTP and rejects a response for another artifact", async () => {
  let calls = 0;
  const api = new ChangeWorkflowClient("http://local", "token", async () => { calls++; return Response.json(envelope(sourceOperation)); });
  await assert.rejects(api.approve(revision, queued, "key", signal()), e => e.code === "PASSED_EVIDENCE_REQUIRED");
  assert.equal(calls, 0);
});

test("operation polling cannot substitute a different artifact or operation", async () => {
  for (const changes of [{ artifact_digest: "sha256:" + "b".repeat(64) }, { id: snapshot }, { revision: 2 }]) {
    const api = new ChangeWorkflowClient("http://local", "token", async () => Response.json(envelope({ ...sourceOperation, ...changes })));
    await assert.rejects(api.operation(sourceOperation, signal()), e => e.status === 502);
  }
});

test("change requests carry only fixed source content and revision, with explicit idempotency", async () => {
  const calls = [];
  const client = new ChangeWorkflowClient("http://127.0.0.1:8000", "private-token", async (url, init) => {
    calls.push({ url, ...init }); return Response.json(envelope(revision));
  });
  await client.save(snapshot, "candidate\r\n", null, "retry-key", signal());
  await client.save(snapshot, "candidate\r\n", revision, "second-key", signal());
  assert.deepEqual(JSON.parse(calls[0].body), { base_snapshot_id: snapshot, content: "candidate\r\n" });
  assert.deepEqual(JSON.parse(calls[1].body), { expected_revision: 1, content: "candidate\r\n" });
  for (const call of calls) {
    assert.equal(call.cache, "no-store"); assert.equal(call.credentials, "omit");
    assert.equal(call.redirect, "error"); assert.equal(call.headers.Authorization, "Bearer private-token");
  }
  assert.equal(calls[0].headers["Idempotency-Key"], "retry-key");
});

test("test response must bind the requested revision, artifact and profile", async () => {
  for (const change of [{ revision: 2 }, { artifact_digest: "sha256:" + "b".repeat(64) },
    { profile_digest: "sha256:" + "c".repeat(64) }, { proposal_id: snapshot }]) {
    const client = new ChangeWorkflowClient("http://local", "token", async () => Response.json(envelope({ ...queued, ...change })));
    await assert.rejects(client.test(revision, "key", signal()), e => e.status === 502);
  }
});

test("polling rejects another job or a fabricated status/result pair", async () => {
  for (const change of [{ job_id: snapshot }, { status: "passed", result: null },
    { status: "passed", evidence_digest: hash, result: { outcome: "passed", reason: "COMPLETED", elapsed_ms: 1, checks: [] } },
    { status: "running", result: { outcome: "passed", reason: "COMPLETED", elapsed_ms: 1, checks: [] } }]) {
    const client = new ChangeWorkflowClient("http://local", "token", async () => Response.json(envelope({ ...queued, ...change })));
    await assert.rejects(client.job(queued, signal()), e => e.status === 502);
  }
});

test("error display does not echo server messages or source; retry conflict is explicit", async () => {
  const client = new ChangeWorkflowClient("http://local", "token", async () => Response.json({
    error: { code: "IDEMPOTENCY_CONFLICT", message: "sensitive-source-and-token" }, meta: envelope(null).meta,
  }, { status: 409 }));
  await assert.rejects(client.save(snapshot, "new", null, "key", signal()), error =>
    error.status === 409 && error.code === "IDEMPOTENCY_CONFLICT" && !error.message.includes("sensitive"));
});

test("editor retains uniform original CRLF and BOM while keeping LF sources as LF", () => {
  assert.equal(editorContent("a\nb\n", "a\r\nb\r\n"), "a\r\nb\r\n");
  assert.equal(editorContent("a\r\nb\r\n", "a\nb\n"), "a\nb\n");
  assert.equal(editorContent("\uFEFFa\nb", "\uFEFFa\r\nb"), "\uFEFFa\r\nb");
});

test("save-and-test retains the committed revision and test retry key after a lost test acknowledgement", async () => {
  const attempts = { save: null, test: null }, keys = [];
  let saved = null, saves = 0, tests = 0;
  const api = {
    async save() { saves++; return revision; },
    async test(value, key) { keys.push(key); tests++; assert.equal(value, revision);
      if (tests === 1) throw new Error("lost acknowledgement"); return queued; },
  };
  await assert.rejects(submitCodeChange(api, snapshot, revision.content, null, attempts, signal(),
    value => { saved = value; }), /lost acknowledgement/);
  assert.equal(saved, revision);
  const job = await submitCodeChange(api, snapshot, revision.content, saved, attempts, signal(),
    () => assert.fail("must not save a second revision"));
  assert.equal(job, queued); assert.equal(saves, 1); assert.equal(keys[0], keys[1]);
});

test("save-and-test retries the exact save key and does not queue before a save acknowledgement", async () => {
  const attempts = { save: null, test: null }, keys = [];
  let saves = 0, tests = 0;
  const api = {
    async save(_snapshot, _content, _previous, key) { keys.push(key); saves++;
      if (saves === 1) throw new Error("lost save acknowledgement"); return revision; },
    async test() { tests++; return queued; },
  };
  await assert.rejects(submitCodeChange(api, snapshot, revision.content, null, attempts, signal(), () => {}));
  assert.equal(tests, 0);
  await submitCodeChange(api, snapshot, revision.content, null, attempts, signal(), () => {});
  assert.equal(keys[0], keys[1]); assert.equal(tests, 1);
});

test("cancelled save-and-test never publishes the saved revision into a disconnected view", async () => {
  const controller = new AbortController();
  const api = { async save() { controller.abort(); return revision; },
    async test() { assert.fail("cannot queue after cancellation"); } };
  const result = await submitCodeChange(api, snapshot, revision.content, null,
    { save: null, test: null }, controller.signal, () => assert.fail("cannot restore disconnected source"));
  assert.equal(result, null);
});
