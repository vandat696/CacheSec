import assert from "node:assert/strict";
import { test } from "node:test";
import { readRuntimeSettings } from "../src/features/runtime-settings/runtimeSettingsClient.ts";
import { editablePath } from "../src/features/code-changes/changeWorkflowApi.ts";

const id = "10000000-0000-4000-8000-000000000001";
const digest = "sha256:" + "a".repeat(64);
const responses = {
  "/api/v1/repository": { tenant_id: id, repo_id: id, repository_identity: "fixture-repo", authority_epoch: 1 },
  "/api/v1/agent/config": { model: "gemini-3.5-flash-lite", configured: false, mode: "assisted" },
  "/api/v1/changes/config": { editable_path: editablePath, profile_digest: digest, purpose: "technical-smoke", repository_identity: "fixture-repo", can_propose: true, can_test: false },
  "/api/v1/changes/workspace/config": { can_write: true, can_review: false, can_activate: false, can_read: true, configured: true, target_version: 0, active_artifact: null, pending_id: null },
};
test("settings read four existing contracts through the local session without mutations or browser authority", async () => {
  const original = global.fetch;
  const seen = [];
  try {
    global.fetch = async (url, init) => {
      assert.equal(init.method, "GET"); assert.equal(init.credentials, "same-origin");
      assert.equal(init.headers.Authorization, undefined); assert.equal(init.body, undefined);
      const path = String(url).replace("/api/local-control", ""); seen.push(path);
      return Response.json({ data: responses[path], meta: { contract_version: "v0.2", identity_mode: "fixture", request_id: id } });
    };
    const result = await readRuntimeSettings(new AbortController().signal);
    assert.deepEqual(seen.sort(), Object.keys(responses).sort());
    assert.equal(result.agent.configured, false); assert.equal(result.workflow.can_test, false);
    assert.equal(result.target.active_artifact, null);
  } finally { global.fetch = original; }
});
test("settings reject a denied API and mismatched repository instead of presenting partial configuration", async () => {
  const original = global.fetch;
  try {
    for (const deny of [true, false]) {
      global.fetch = async url => {
        const path = String(url).replace("/api/local-control", "");
        if (deny && path.endsWith("workspace/config")) return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
        const data = path.endsWith("changes/config") ? { ...responses[path], repository_identity: "other-repo" } : responses[path];
        return Response.json({ data, meta: { contract_version: "v0.2", identity_mode: "fixture", request_id: id } });
      };
      await assert.rejects(readRuntimeSettings(new AbortController().signal));
    }
  } finally { global.fetch = original; }
});
