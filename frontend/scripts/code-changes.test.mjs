import assert from "node:assert/strict";
import test from "node:test";
import { ChangeWorkflowClient, editorContent, editablePath } from "../src/features/code-changes/changeWorkflowApi.ts";

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
const envelope = data => ({ data, meta: { contract_version: "v0.2", identity_mode: "fixture", request_id: proposal } });

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
