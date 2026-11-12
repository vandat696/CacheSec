import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentHttpClient, AgentApiError } from "../src/features/agent/agentApi.ts";
import { editablePath } from "../src/features/code-changes/changeWorkflowApi.ts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const meta = { request_id: id, identity_mode: "fixture", contract_version: "v0.2" };
const signal = () => new AbortController().signal;
const reply = { snapshot_id: id, manifest_digest: "sha256:" + "a".repeat(64), repository_identity: "test",
  editable_path: editablePath, answer: "test-only generation", content: "# test-only source\n", model: "gpt-6.1-sol", usage: null };

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
    { model: "gpt-6.1-solar" }, { content: "x".repeat(65537) }, { usage: { input_tokens: -1 } }, { manifest_digest: "unknown" }]) {
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
