import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { editorShortcut } from "./editor-browser-actions.mjs";

// Review an existing real revision. --save-source explicitly persists it and runs new tests.
// Neither mode sends source to a provider or grants deployment approval.
export async function checkProposalReview({ cdp, navigate, evaluate, waitFor, click, screenshot }) {
  const proposalId = process.env.CACHESEC_REVIEW_PROPOSAL_ID;
  const artifact = process.env.CACHESEC_REVIEW_ARTIFACT;
  const saveSource = process.argv.includes("--save-source");
  assert.match(proposalId ?? "", /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  assert.match(artifact ?? "", /^sha256:[a-f0-9]{64}$/);
  const root = new URL("../../", import.meta.url);
  const local = fileURLToPath(new URL("backend/.local", root));
  const source = new URL("backend/app/quotation_demo/business/quotation_validation.py", root);
  const readOnly = ["quotation_models.py", "quotation_service.py"].map(name =>
    new URL("backend/app/quotation_demo/business/" + name, root));
  const originals = await Promise.all(readOnly.map(path => readFile(path)));
  const sourceBefore = await readFile(source);
  const store = new LocalSessionStore(local);
  const { token } = await store.credential();
  async function get(path) {
    const response = await fetch("http://127.0.0.1:8000/api/v1/" + path, {
      headers: { Authorization: "Bearer " + token }, redirect: "error", signal: AbortSignal.timeout(5000),
    });
    assert.ok(response.ok, "Cannot read review state: " + response.status);
    return (await response.json()).data;
  }
  const revision = await get("changes/proposals/" + proposalId);
  assert.equal(revision.artifact_digest, artifact);
  const targetBefore = await get("changes/workspace/config");
  const observer = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: String.raw`(() => {
    const original = window.fetch.bind(window);
    window.__reviewForbidden = 0;
    window.fetch = (url, init) => {
      if (init?.method === 'POST' && /\/api\/v1\/(?:agent\/(?:messages|runs)|changes\/workspace\/(?:approvals|activations))/.test(String(url))) {
        window.__reviewForbidden++;
        throw new Error('Review check cannot generate, approve or activate');
      }
      return original(url, init);
    };
  })()` });
  try {
    await navigate("/workspace?proposal=" + proposalId + "#local-launch=" + await store.issueLaunch());
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await waitFor(`document.querySelector('.change-reference')?.textContent.includes(${JSON.stringify(artifact)})`);
    assert.equal(await evaluate("document.querySelector('.change-diff pre').textContent"), revision.diff);
    if (saveSource) {
      await waitFor("document.querySelector('#change-save') && !document.querySelector('#change-save').disabled");
      await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').focus()");
      await editorShortcut(cdp, "s");
      await waitFor("document.querySelector('.repository-save-status')?.textContent === 'Đã lưu vào project'", "Persist reviewed source", 600);
      assert.equal((await readFile(source)).toString("utf8"), revision.content);
      await click("#change-test");
      await waitFor(`document.querySelector('.change-test-run > summary')?.textContent.includes('Bản ${revision.revision}')`);
      await waitFor("['passed','failed','error','blocked','unknown'].includes(document.querySelector('.change-test-run')?.dataset.status)", "Docker evidence for saved source", 1200);
    } else {
      assert.ok((await readFile(source)).equals(sourceBefore), "Read-only review changed source");
    }
    const current = await get("changes/proposals/" + proposalId);
    assert.equal(current.artifact_digest, artifact);
    const job = current.tests.find(value => value.revision === current.revision && value.artifact_digest === artifact);
    assert.ok(job && job.status === "passed" && job.evidence_digest, "Current revision needs real passed evidence");
    assert.equal(job.profile_digest, current.profile_digest);
    assert.equal(job.result.checks.length, 21);
    assert.ok(job.result.checks.every(value => value.passed));
    await waitFor("!document.querySelector('#workspace-run')?.disabled", "Review available for human");
    await click('[data-console-tab="tests"]');
    assert.equal(await evaluate("document.querySelector('.change-test-run').dataset.status"), "passed");
    await screenshot("proposal-review-tests.png");
    await click("#workspace-run");
    await waitFor("document.querySelector('.workspace-review-dialog')?.open");
    assert.equal(await evaluate("document.querySelector('.workspace-review-dialog pre').textContent"), revision.diff);
    assert.equal(await evaluate("document.querySelector('.workspace-review-dialog details code').textContent"), artifact);
    await screenshot("proposal-review-human-gate.png");
    await click('.workspace-review-dialog button:not(#workspace-approve-run)');
    await waitFor("!document.querySelector('.workspace-review-dialog').open");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    await screenshot("proposal-review-mobile.png");
    assert.equal(await evaluate("window.__reviewForbidden"), 0);
    const targetAfter = await get("changes/workspace/config");
    for (const key of ["target_version", "active_artifact", "pending_id"]) assert.equal(targetAfter[key], targetBefore[key]);
    for (let i = 0; i < readOnly.length; i++) assert.ok((await readFile(readOnly[i])).equals(originals[i]));
    const report = { proposal_id: proposalId, revision: current.revision, artifact_digest: artifact,
      source_saved: saveSource, source_matches_candidate: (await readFile(source)).toString("utf8") === current.content,
      job, target: targetAfter, model_calls: 0, approvals: 0, activations: 0 };
    await writeFile(new URL("test-results/browser/proposal-review.json", new URL("../", import.meta.url)), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observer.identifier });
  }
}
