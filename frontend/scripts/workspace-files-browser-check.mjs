import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { replaceEditor, editorShortcut } from "./editor-browser-actions.mjs";

export async function checkWorkspaceFiles({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const local = fileURLToPath(new URL("../../backend/.local", import.meta.url));
  const source = fileURLToPath(new URL("../../backend/app/quotation_demo/business/quotation_validation.py", import.meta.url));
  const store = new LocalSessionStore(local);
  const original = await readFile(source);
  const text = original.toString("utf8");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const candidate = text + newline + "# Real Workspace save/undo check." + newline;
  const testedCandidate = candidate + "# Save current source before testing." + newline;
  const sameFile = async () => (await readFile(source)).equals(original);
  try {
    await navigate("/workspace#local-launch=" + await store.issueLaunch());
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await waitFor("document.querySelector('#change-save')?.textContent.trim().startsWith('Lưu ') && !document.querySelector('#change-save').textContent.includes('revision')");
    const { token: configToken } = await store.credential();
    const configResponse = await fetch('http://127.0.0.1:8000/api/v1/agent/config', {
      headers: { Authorization: 'Bearer ' + configToken }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    const canDraftAgent = configResponse.ok && (await configResponse.json()).data.configured;
    if (canDraftAgent) await waitFor("!document.querySelector('#agent-prompt').disabled", 'Agent config ready without a model call');
    if (canDraftAgent) await fill('#agent-prompt', 'Draft retained while saving source; do not send.');
    await replaceEditor({ cdp, evaluate }, candidate);
    await editorShortcut(cdp, "s");
    await waitFor("document.querySelector('.repository-save-status')?.textContent === 'Đã lưu vào project'", "Real source write");
    assert.equal((await readFile(source)).toString("utf8"), candidate);
    if (canDraftAgent) assert.equal(await evaluate("document.querySelector('#agent-prompt').value"), 'Draft retained while saving source; do not send.');
    assert.equal(await evaluate("!!document.querySelector('#workspace-run')"), true);
    assert.equal(await evaluate("document.querySelector('#workspace-run').disabled"), true, "No test evidence: cannot activate");
    await screenshot("workspace-real-source-save.png");
    await replaceEditor({ cdp, evaluate }, testedCandidate);
    await click('#change-test');
    await waitFor("['passed','failed'].includes(document.querySelector('.change-test-run')?.dataset.status)", "Docker test of the next saved edit", 700);
    assert.equal((await readFile(source)).toString('utf8'), testedCandidate, 'Test must save the current edit, not dispatch a stale source');
    assert.equal(await evaluate("document.querySelector('.change-test-run').querySelectorAll('ul > li').length"), 21);
    assert.equal(await evaluate("[...document.querySelector('.change-test-run').querySelectorAll('ul > li')].slice(0,5).every(item => item.textContent.trim().startsWith('✓'))"), true);
    await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').focus()");
    await editorShortcut(cdp, "z");
    await waitFor("!document.querySelector('#change-save').disabled");
    await editorShortcut(cdp, "s");
    await waitFor("document.querySelector('.repository-save-status')?.textContent === 'Đã lưu vào project'", "Undo saved to project");
    if (!await sameFile()) {
      assert.equal((await readFile(source)).toString('utf8'), candidate);
      await editorShortcut(cdp, 'z');
      await waitFor("!document.querySelector('#change-save').disabled");
      await editorShortcut(cdp, 's');
      await waitFor("document.querySelector('.repository-save-status')?.textContent === 'Đã lưu vào project'", "Restore original source");
    }
    assert.ok(await sameFile(), "Undo + Ctrl+S must restore exact original bytes");
    await cdp("Page.reload");
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await waitFor("!!document.querySelector('.cm-content')");
    assert.ok(await sameFile());
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await screenshot("workspace-real-source-mobile.png");
    assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth + 1"), false);
  } finally {
    if (!await sameFile()) {
      const current = await readFile(source);
      assert.ok([candidate, testedCandidate].includes(current.toString("utf8")), "External edits detected; they have been preserved");
      const { token } = await store.credential();
      async function post(path, body) {
        const response = await fetch("http://127.0.0.1:8000/api/v1/" + path, {
          method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        assert.ok(response.ok, "Could not restore source through backend");
        return (await response.json()).data;
      }
      const snapshot = await post("repository/snapshots");
      const revision = await post("changes/proposals", { base_snapshot_id: snapshot.snapshot_id, content: text });
      const operation = await post("changes/workspace/source", { proposal_id: revision.proposal_id, revision: revision.revision,
        artifact_digest: revision.artifact_digest, expected_snapshot_id: snapshot.snapshot_id });
      for (let i = 0; i < 120 && !await sameFile(); i++) await new Promise(resolve => setTimeout(resolve, 250));
      assert.ok(await sameFile(), "Backend source restoration incomplete: " + operation.id);
    }
  }
}
