import assert from "node:assert/strict";
import { test } from "node:test";
import { workspaceMetricValues } from "../src/features/metrics/workspaceMetricsModel.ts";

test("Workspace metrics preserve missing usage and do not infer savings from Hit", () => {
  const missing = { mode: "local", status: "incomplete", run: null };
  assert.deepEqual(workspaceMetricValues(missing).slice(3), Array(9).fill("—"));
  const branch = { ...missing, status: "error", error_code: "MODEL_UNAVAILABLE", server_workflow_ms: 0,
    context: { outcome: "hit", resolution_ms: 100, embedding_ms: 200, embedding_calls: 1 },
    run: { events: [
      { tool: "generate", state: "started" },
      { tool: "generate", state: "completed", generation_ms: 300, usage: null },
    ] } };
  const values = workspaceMetricValues(branch);
  assert.equal(values[1], "MODEL_UNAVAILABLE");
  assert.equal(values[2], "Verified Hit");
  assert.equal(values[3], "0.00 s");
  assert.equal(values[8], "1");
  assert.deepEqual(values.slice(10), ["—", "—"]);
  branch.run.events[1].usage = { input_tokens: 123, output_tokens: 7, total_tokens: 130 };
  assert.deepEqual(workspaceMetricValues(branch).slice(10), ["123", "7"]);
});
