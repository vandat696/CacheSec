import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";

// Explicit opt-in: one real Agent run sends the registered source/candidates/feedback to Gemini.
// Requires the owner's source-sharing approval and existing workflow.run/read grants.
export async function checkAgentRunLive({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const root = new URL("../../", import.meta.url);
  const sourceRoot = new URL("backend/app/quotation_demo/business/", root);
  const names = ["quotation_models.py", "quotation_service.py", "quotation_validation.py"];
  const before = await Promise.all(names.map(name => readFile(new URL(name, sourceRoot))));
  const hashes = before.map(value => createHash("sha256").update(value).digest("hex"));
  const comment = "# CacheSec Agent live smoke: behavior unchanged.";
  const marker = comment.replace(/\.$/, "");
  const resumeId = process.env.CACHESEC_AGENT_RUN_ID;
  if (resumeId) assert.match(resumeId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  const store = new LocalSessionStore(fileURLToPath(new URL("backend/.local", root)));
  const observer = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: String.raw`(() => {
    const original=window.fetch.bind(window);
    window.__liveAgentStarts=0;
    window.fetch=async (url,init) => {
      const response=await original(url,init);
      if(/\/api\/v1\/agent\/runs(?:\/[a-f0-9-]{36})?$/.test(String(url)) && response.ok) {
        if(init?.method==='POST') window.__liveAgentStarts++;
        window.__liveAgentRun=(await response.clone().json()).data;
      }
      return response;
    };
  })()` });
  try {
    await navigate("/workspace#local-launch=" + await store.issueLaunch());
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await waitFor("document.querySelector('.dev-assistant')?.dataset.agentReady === 'true'");
    await waitFor("!document.querySelector('.agent-run-option input')?.disabled");
    if (resumeId) {
      await evaluate(`fetch('/api/local-control/api/v1/agent/runs/'+${JSON.stringify(resumeId)},
        {headers:{'X-CacheSec-Workspace':'1'},credentials:'same-origin',cache:'no-store'}).then(response => {
          if(!response.ok) throw new Error('Cannot read the approved Agent run');
          return response.json();
        })`);
    } else {
      await click(".agent-run-option input");
      await fill("#agent-prompt", "Technical smoke only: add exactly this standalone comment after the imports in quotation_validation.py: "
        + comment + " Keep every existing import, class, function, docstring, interface and baseline behavior unchanged. "
        + "Return the full file. Do not add an expiration-date rule or modify other files, tests, control or policy. "
        + "The controller will save and run the technical Docker tests. Do not claim tests ran in your model answer.");
      await click('.dev-composer button[type="submit"]');
    }
    await waitFor("!!window.__liveAgentRun?.run_id", "real Agent run accepted", 300);
    const runId = await evaluate("window.__liveAgentRun.run_id");
    console.log((resumeId ? "Verifying existing Agent run: " : "Real Agent run accepted: ") + runId);
    await waitFor("['passed','needs_input','exhausted','cancelled','timed_out','error'].includes(window.__liveAgentRun?.status)",
      "real Gemini and Docker run terminal", 6600);
    const run = await evaluate("window.__liveAgentRun");
    console.log(JSON.stringify({ run_id: run.run_id, status: run.status, turn: run.turn,
      proposal_id: run.proposal_id, revision: run.revision, test_job_id: run.test_job_id,
      test_status: run.test_status, error_code: run.error_code }));
    assert.equal(run.status, "passed", "Live Agent outcome: " + run.status + "/" + run.error_code);
    assert.equal(await evaluate("window.__liveAgentStarts"), resumeId ? 0 : 1);
    assert.ok(run.turn >= 1 && run.turn <= 3);
    const revision = await evaluate(`(async () => {
      const response=await fetch('/api/local-control/api/v1/changes/proposals/'+${JSON.stringify(run.proposal_id)},
        {headers:{'X-CacheSec-Workspace':'1'},credentials:'same-origin',cache:'no-store'});
      if(!response.ok) throw new Error('Cannot verify live revision');
      return (await response.json()).data;
    })()`);
    assert.equal(revision.revision, run.revision);
    assert.equal(revision.base_snapshot_id, run.snapshot_id);
    assert.equal(revision.artifact_digest, run.artifact_digest);
    const job = revision.tests.find(value => value.job_id === run.test_job_id);
    assert.ok(job && job.status === "passed" && job.evidence_digest);
    assert.equal(job.revision, revision.revision);
    assert.equal(job.artifact_digest, revision.artifact_digest);
    assert.equal(job.profile_digest, revision.profile_digest);
    assert.ok(job.result.checks.length > 0 && job.result.checks.every(check => check.passed));
    const candidateLines = revision.content.replace(/^\uFEFF/, "").split(/\r?\n/);
    const commentLines = candidateLines.filter(line => line.trim().replace(/\.$/, "") === marker);
    assert.equal(commentLines.length, 1, "Exactly one smoke comment must be added");
    const unchangedLines = candidateLines.filter(line => line.trim() && line.trim().replace(/\.$/, "") !== marker);
    assert.deepEqual(unchangedLines, before[2].toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim()),
      "Every existing nonblank line must remain unchanged");
    const parsed = spawnSync(fileURLToPath(new URL("backend/.venv/Scripts/python.exe", root)), ["-X", "utf8", "-c",
      "import ast,json,sys; d=json.load(sys.stdin); print(json.dumps({'same_ast':ast.dump(ast.parse(d['base']),include_attributes=False)==ast.dump(ast.parse(d['candidate']),include_attributes=False)}))"], {
      input: JSON.stringify({ base: before[2].toString("utf8").replace(/^\uFEFF/, ""), candidate: revision.content }),
      encoding: "utf8", windowsHide: true,
    });
    assert.equal(parsed.status, 0, "Candidate must parse without executing source");
    assert.equal(JSON.parse(parsed.stdout).same_ast, true, "Only a comment may change baseline source");
    const after = await Promise.all(names.map(name => readFile(new URL(name, sourceRoot))));
    assert.deepEqual(after.map(value => createHash("sha256").update(value).digest("hex")), hashes);
    console.log(JSON.stringify({ artifact_digest: run.artifact_digest, evidence_digest: job.evidence_digest,
      checks: job.result.checks.map(check => check.name), model_calls: run.events.filter(event => event.tool === "generate" && event.state === "completed").map(event => ({ model: event.model, usage: event.usage })),
      baseline_ast_unchanged: true, working_tree_unchanged: true }));
    if (resumeId) await navigate("/workspace?proposal=" + encodeURIComponent(run.proposal_id));
    else await click(".agent-run > button");
    await waitFor(`document.querySelector('.change-diff pre')?.textContent.includes(${JSON.stringify(marker)})`, "live candidate diff");
    await waitFor("document.querySelector('.change-test-run')?.dataset.status === 'passed'", "live evidence in editor");
    for (const [width,height] of [[1440,900],[390,844]]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await screenshot('agent-run-live-'+width+'.png');
    }
  } finally {
    await cdp("Page.removeScriptToEvaluateOnNewDocument", {identifier:observer.identifier});
  }
}
