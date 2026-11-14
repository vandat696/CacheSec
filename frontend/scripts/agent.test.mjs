import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentHttpClient, AgentApiError } from "../src/features/agent/agentApi.ts";
import { editablePath } from "../src/features/code-changes/changeWorkflowApi.ts";
import { isAgentRun } from "../src/features/agent/agentRunModel.ts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const meta = { request_id: id, identity_mode: "fixture", contract_version: "v0.2" };
const signal = () => new AbortController().signal;
const reply = { snapshot_id: id, manifest_digest: "sha256:" + "a".repeat(64), repository_identity: "test",
  editable_path: editablePath, answer: "test-only generation", content: "# test-only source\n", model: "gemini-3.5-flash-lite", usage: null };

test("Agent uses scoped snapshot and user conversation without provider URLs, credentials or roles in body", async () => {
  let seen;
  const api = new AgentHttpClient("/api/local-control", null, async (url, init) => {
    seen = { url, init }; return Response.json({ data: reply, meta });
  });
  assert.deepEqual(await api.ask(id, "test", [], signal()), reply);
  assert.equal(seen.url, "/api/local-control/api/v1/agent/messages");
  assert.deepEqual(JSON.parse(seen.init.body), { snapshot_id: id, prompt: "test", history: [] });
  assert.equal(seen.init.credentials, "same-origin");
  assert.equal(seen.init.headers.Authorization, undefined);
  assert.equal(seen.init.cache, "no-store");
  assert.equal(seen.init.redirect, "error");
});

test("Agent rejects another snapshot/path/model, oversized content and invented usage", async () => {
  for (const change of [{ snapshot_id: "other" }, { editable_path: "../.env" }, { model: "gpt-6-astra" },
    { model: "gpt-6.1-solar" }, { model: "gemini-3.5-flash-lite-lite" }, { content: "x".repeat(65537) }, { usage: { input_tokens: -1 } }, { manifest_digest: "unknown" }]) {
    const api = new AgentHttpClient("http://local.test", "test-only-token", async () => Response.json({ data: { ...reply, ...change }, meta }));
    await assert.rejects(api.ask(id, "test", [], signal()), AgentApiError);
  }
});

test("missing key is a configuration state; provider errors never echo raw messages or pretend success", async () => {
  const api = new AgentHttpClient("http://local.test", "test-only-token", async () => Response.json({
    data: { model: "gpt-6.1-sol", configured: false, mode: "assisted" }, meta,
  }));
  assert.equal((await api.config(signal())).configured, false);
  for (const code of ["MODEL_NOT_CONFIGURED", "MODEL_KEY_REJECTED", "MODEL_RATE_LIMIT", "MODEL_INVALID_RESPONSE"]) {
    const failed = new AgentHttpClient("http://local.test", "test", async () => Response.json({ error: { code, message: "secret-must-not-echo" }, meta }, { status: 503 }));
    await assert.rejects(failed.ask(id, "test", [], signal()), error => error instanceof AgentApiError
      && error.status === 503 && !error.message.includes("secret-must-not-echo"));
  }
});

for (const model of ["gemini-3.5-flash-lite", "gpt-6.1-sol"]) {
  test(`Agent accepts configured ${model} and its bound replies`, async () => {
    const api = new AgentHttpClient("/api/local-control", null, async url => Response.json({
      data: String(url).endsWith("/config") ? { model, configured: true, mode: "assisted" } : { ...reply, model }, meta,
    }));
    assert.equal((await api.config(signal())).model, model);
    assert.equal((await api.ask(id, "test", [], signal())).model, model);
  });
}
test("Agent rejects unknown config models and malformed configuration", async () => {
  for (const model of ["gemini-3.5-flash-lite-lite", "unknown", "toString"]) {
    const api = new AgentHttpClient("/api/local-control", null, async () => Response.json({
      data: { model, configured: true, mode: "assisted" }, meta,
    }));
    await assert.rejects(api.config(signal()), AgentApiError);
  }
});

const run = { run_id: id, snapshot_id: id, tenant_id: id, repo_id: id, status: "queued", turn: 0,
  max_turns: 3, deadline_seconds: 600, model: "gemini-3.5-flash-lite", created_at: "test-only timestamp",
  answer: "", error_code: null, proposal_id: null, revision: null, artifact_digest: null,
  test_job_id: null, test_status: null, test_may_continue: false, events: [] };
test("Agent run requests explicitly consent, bind the snapshot, use idempotency and keep tools server-owned", async () => {
  const seen = [];
  const api = new AgentHttpClient("/api/local-control", null, async (url, init) => {
    seen.push({ url, init }); return Response.json({ data: run, meta });
  });
  await api.startRun(id, "test-only task", "run-key", signal());
  assert.deepEqual(JSON.parse(seen[0].init.body), { snapshot_id: id, prompt: "test-only task", provider_consent: true });
  assert.equal(seen[0].init.headers["Idempotency-Key"], "run-key");
  assert.equal(seen[0].init.headers.Authorization, undefined);
  await api.getRun(id, signal());
  assert.equal(seen[1].init.method, "GET");
  await api.cancelRun(id, signal());
  assert.equal(seen[2].url, "/api/local-control/api/v1/agent/runs/" + id + "/cancel");
  assert.equal(seen[2].init.body, "null");
});
test("Agent run decoder rejects unsupported budgets, missing evidence and fabricated usage", () => {
  assert.equal(isAgentRun(run), true);
  for (const change of [{ max_turns: 100 }, { turn: 4 }, { status: "deployed" }, { status: "passed" },
    { test_status: "passed" }, { events: [{ sequence: 1, at: "test", turn: 1, tool: "generate", state: "completed", usage: { input_tokens: -1 } }] }])
    assert.equal(isAgentRun({ ...run, ...change }), false);
});
test("Agent run clients reject replies for another run or initial snapshot", async () => {
  const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const api = new AgentHttpClient("/api/local-control", null, async () => Response.json({ data: { ...run, run_id: other, snapshot_id: other }, meta }));
  await assert.rejects(api.startRun(id, "test", "key", signal()), AgentApiError);
  await assert.rejects(api.getRun(id, signal()), AgentApiError);
  await assert.rejects(api.cancelRun(id, signal()), AgentApiError);
});
