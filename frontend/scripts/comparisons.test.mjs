import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentHttpClient, AgentApiError } from "../src/features/agent/agentApi.ts";
import { isComparisonPair, branchMetrics } from "../src/features/comparisons/comparisonModel.ts";
import { comparisonDiff, completeComparisonDiff } from "../src/features/comparisons/comparisonDiff.ts";

test("code review preserves signs inside code and numbers before/after across hunks", () => {
  const patch = [
    "--- base/validation.py", "+++ candidate/validation.py", "@@ -3,2 +3,3 @@",
    " context", "--- code", "+++ code", "+", "@@ -12,0 +14 @@", "+tail", "",
  ].join("\r\n");
  assert.deepEqual(comparisonDiff(patch), [
    [
      { kind: "context", before: 3, after: 3, text: "context" },
      { kind: "removed", before: 4, after: null, text: "-- code" },
      { kind: "added", before: null, after: 4, text: "++ code" },
      { kind: "added", before: null, after: 5, text: "" },
    ],
    [{ kind: "added", before: null, after: 14, text: "tail" }],
  ]);
  assert.equal(comparisonDiff(patch.replace("+tail", "old+tail")), null);
});

test("whole-file review fills omitted context and keeps both line numbers after insertions", () => {
  const old = "head\r\nold\r\nlast\r\n";
  const next = "head\nnew\nextra\nlast\n";
  const changes = comparisonDiff("--- base/a.py\n+++ candidate/a.py\n@@ -2 +2,2 @@\n-old\n+new\n+extra\n");
  assert.deepEqual(completeComparisonDiff(changes, old, next), [
    { kind: "context", before: 1, after: 1, text: "head" },
    { kind: "removed", before: 2, after: null, text: "old" },
    { kind: "added", before: null, after: 2, text: "new" },
    { kind: "added", before: null, after: 3, text: "extra" },
    { kind: "context", before: 3, after: 4, text: "last" },
  ]);
  assert.equal(completeComparisonDiff(changes, old, next.replace("last", "unreported")), null);
});

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const meta = { request_id: id, identity_mode: "fixture", contract_version: "v0.2" };
const run = { run_id: id, snapshot_id: id, tenant_id: id, repo_id: id, status: "needs_input", turn: 1, max_turns: 3,
  deadline_seconds: 600, model: "gemini-3.5-flash-lite", created_at: "2026-11-18T00:00:00+00:00", answer: "test-only",
  error_code: null, proposal_id: null, revision: null, artifact_digest: null, test_job_id: null, test_status: null,
  test_may_continue: false, events: [{ sequence: 1, at: "2026-11-18T00:00:02+00:00", turn: 1, tool: "generate", state: "completed", usage: null, generation_ms: 100 }] };
const pair = () => ({ pair_id: id, snapshot_id: id, prompt: "test-only", created_at: "2026-11-18T00:00:00+00:00",
  cache_state: "warm", status: "ready", model: run.model, branches: {
    none: { mode: "none", status: "needs_input", run: structuredClone(run), revisions: [] },
    local: { mode: "local", status: "needs_input", run: structuredClone(run), revisions: [] },
  } });
const signal = () => new AbortController().signal;

test("comparison client creates one scoped prompt with idempotency and explicit provider consent", async () => {
  let seen;
  const api = new AgentHttpClient("/api/local-control", null, async (url, init) => {
    seen = { url, init }; return Response.json({ data: pair(), meta });
  });
  assert.ok(await api.createComparison(id, "test-only", "warm", "test-key", signal()));
  assert.equal(seen.url, "/api/local-control/api/v1/agent/comparisons");
  assert.equal(seen.init.headers["Idempotency-Key"], "test-key");
  assert.deepEqual(JSON.parse(seen.init.body), { snapshot_id: id, prompt: "test-only", cache_state: "warm", provider_consent: true });
  assert.equal(seen.init.credentials, "same-origin"); assert.equal(seen.init.headers.Authorization, undefined);
});

test("history reads only GET and rejects another pair/snapshot before presenting source", async () => {
  let calls = 0;
  const api = new AgentHttpClient("/api/local-control", null, async (url, init) => {
    calls++; assert.equal(init.method, "GET"); assert.equal(init.body, undefined);
    return Response.json({ data: pair(), meta });
  });
  assert.ok(await api.comparison(id, signal())); assert.equal(calls, 1);
  await assert.rejects(api.comparison(other, signal()), AgentApiError);
  const value = pair(); value.branches.none.run.snapshot_id = other;
  assert.equal(isComparisonPair(value), false);
});

test("comparison sends one model ID and rejects a response with a different branch model", async () => {
  const model = "gemini-3.8-flash";
  const value = pair();
  value.model = value.branches.local.run.model = value.branches.none.run.model = model;
  const api = new AgentHttpClient("/api/local-control", null, async (_url, init) => {
    assert.equal(JSON.parse(init.body).model, model);
    return Response.json({ data: value, meta });
  });
  assert.equal((await api.createComparison(id, "test-only", "warm", "test-key", signal(), model)).model, model);
  value.branches.none.run.model = run.model;
  await assert.rejects(api.createComparison(id, "test-only", "warm", "test-key", signal(), model), AgentApiError);
});

test("missing usage remains unknown; totals use real per-turn counts without inferring savings from Hit", () => {
  const branch = pair().branches.local;
  assert.equal(branchMetrics(branch).usage, null);
  branch.run.events[0].usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };
  branch.run.events.push({ sequence: 2, at: "2026-11-18T00:00:03+00:00", turn: 2, tool: "generate", state: "completed", generation_ms: 200,
    usage: { input_tokens: 20, output_tokens: 7, total_tokens: 27 } });
  assert.deepEqual(branchMetrics(branch).usage, { input_tokens: 30, output_tokens: 12, total_tokens: 42 });
  assert.equal(branchMetrics(branch).generationMs, 300);
  branch.run.events[1].usage = null; assert.equal(branchMetrics(branch).usage, null);
});

test("comparison branch start sends candidates only and checks returned scope and admission", async () => {
  let body;
  const api = new AgentHttpClient("/api/local-control", null, async (_url, init) => {
    body = JSON.parse(init.body); return Response.json({ data: { pair_id: id, mode: "none", status: "queued", admission: null }, meta });
  });
  assert.equal((await api.startComparison(id, "none", { kind: "not_applicable" }, signal())).admission, null);
  assert.deepEqual(body, { lookup_report: { kind: "not_applicable" } });
  await assert.rejects(api.startComparison(id, "local", { kind: "no_candidate" }, signal()), AgentApiError);
});
