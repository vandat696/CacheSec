import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { editableSource, editorShortcut, replaceEditor } from "./editor-browser-actions.mjs";

// Actual IDE interactions and technical Docker checks. Never edits the host source.
export async function checkCodeChanges({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const token = process.env.CONTROL_REPOSITORY_READ_TOKEN;
  assert.ok(token, "Load the private dev credential before this technical smoke.");
  const paths = ["quotation_models.py", "quotation_service.py", "quotation_validation.py"]
    .map(name => `backend/app/quotation_demo/business/${name}`);
  const original = (await readFile(new URL("../../backend/app/quotation_demo/business/quotation_validation.py", import.meta.url), "utf8"))
    .replace(/\r\n?/g, "\n");
  await navigate("/workspace");
  await waitFor("!document.querySelector('#repository-token').disabled");
  await click(".repository-manual-connection > summary");
  await fill("#repository-token", token);
  await click('.repository-connection button[type="submit"]');
  await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
  await waitFor(`!!document.querySelector(${JSON.stringify(editableSource + '[contenteditable="true"]')})`);
  assert.equal(await evaluate("document.querySelector('#change-save').disabled"), true);
  await waitFor("!document.querySelector('#change-test').disabled");
  assert.ok(await evaluate("document.querySelectorAll('.cm-lineNumbers .cm-gutterElement').length > 1"));
  await screenshot("workspace-ide-ready.png");

  const comment = original + "\n# Browser IDE technical check.\n";
  await replaceEditor({ cdp, evaluate }, comment);
  await waitFor("!document.querySelector('#change-save').disabled");
  const cursor = await evaluate("document.querySelector('.source-editor:not([hidden]) .source-editor-status').textContent");
  await click(`.repository-explorer button[data-path="${paths[0]}"]`);
  await waitFor("!!document.querySelector('.source-editor:not([hidden]) .cm-content[contenteditable=\"false\"]')");
  assert.equal(await evaluate("document.querySelector('#change-save').disabled"), true);
  assert.ok(await evaluate("!!document.querySelector('.repository-tab .editor-dirty')"));
  await click(`[role="tab"][data-path="${paths[2]}"]`);
  await waitFor(`!!document.querySelector(${JSON.stringify(editableSource + '[contenteditable="true"]')})`);
  assert.equal(await evaluate("document.querySelector('.source-editor:not([hidden]) .source-editor-status').textContent"), cursor);
  assert.equal(await evaluate("document.querySelectorAll('.repository-tab').length"), 2);

  await editorShortcut(cdp, "z");
  await waitFor("document.querySelector('#change-save').disabled");
  await editorShortcut(cdp, "y");
  await waitFor("!document.querySelector('#change-save').disabled");
  await editorShortcut(cdp, "s");
  await waitFor("document.querySelector('#change-save').disabled && document.querySelector('.repository-save-status').textContent === 'Đã lưu'");
  assert.equal(await evaluate("document.querySelectorAll('.change-test-run').length"), 0, "Ctrl+S must not run tests");
  await click('[data-console-tab="details"]');
  const proposalId = await evaluate("document.querySelector('.change-reference dd').textContent");
  assert.match(proposalId, /^[0-9a-f-]{36}$/);
  const load = async () => {
    const response = await fetch(`http://127.0.0.1:8000/api/v1/changes/proposals/${proposalId}`, {
      headers: { Authorization: `Bearer ${token}` }, redirect: "error" });
    assert.equal(response.status, 200); return (await response.json()).data;
  };
  assert.equal((await load()).content.replace(/\r\n?/g, "\n"), comment);
  await evaluate(`document.querySelector(${JSON.stringify(editableSource)}).focus()`);
  await editorShortcut(cdp, "s");
  assert.equal((await load()).revision, 1, "Saving an unchanged file must not create another revision");

  await replaceEditor({ cdp, evaluate }, comment + "# Unsaved edit.\n");
  await waitFor("!document.querySelector('#change-save').disabled");
  await click('[aria-label="Đóng quotation_validation.py"]');
  await waitFor("!!document.querySelector('dialog[open] #unsaved-title')");
  await click('dialog[open] button:first-child');
  assert.ok(await evaluate("!!document.querySelector('[role=\"tab\"][data-path$=\"quotation_validation.py\"]')"));
  await click('[aria-label="Đóng quotation_validation.py"]');
  await click('dialog[open] button:nth-child(2)');
  await waitFor("!document.querySelector('[role=\"tab\"][data-path$=\"quotation_validation.py\"]')");
  await click(`.repository-explorer button[data-path="${paths[2]}"]`);
  await waitFor(`!!document.querySelector(${JSON.stringify(editableSource + '[contenteditable="true"]')})`);
  assert.equal(await evaluate("document.querySelector('#change-save').disabled"), true);
  assert.equal((await load()).revision, 1, "Discarding an unsaved edit must not write a revision");

  const statuses = [];
  for (const [source, expected] of [
    [comment, "passed"],
    [original + "\ndef validate_quotation(quotation):\n    raise RuntimeError('technical check')\n", "failed"],
    [original + "\ndef validate_quotation(quotation):\n    while True:\n        pass\n", "timed_out"],
  ]) {
    if (statuses.length) await replaceEditor({ cdp, evaluate }, source);
    await waitFor("!document.querySelector('#change-test').disabled");
    await click("#change-test");
    await waitFor(`document.querySelector('.change-test-run')?.dataset.status === ${JSON.stringify(expected)}`,
      `Real worker result: ${expected}`);
    statuses.push(expected);
    assert.equal((await load()).content.replace(/\r\n?/g, "\n"), source);
    if (statuses.length > 1) assert.equal(await evaluate("[...document.querySelectorAll('.change-test-run > summary')].slice(1).every(s => s.textContent.includes('Bản cũ'))"), true);
    await screenshot(`workspace-ide-${expected}.png`);
  }
  assert.deepEqual(statuses, ["passed", "failed", "timed_out"]);
  await click('[data-console-tab="diff"]');
  assert.ok(await evaluate("document.querySelector('.change-diff pre').textContent.includes('+')"));
  await click('[data-console-tab="tests"]');
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  assert.equal(await evaluate("document.querySelector('#preview-open-approval')"), null);
  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`workspace-ide-${width}.png`);
  }
  await click("#repository-disconnect");
  await waitFor("!!document.querySelector('#repository-token')");
  assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);

  // A normal IDE can run the current source before any edit, then save a real undo.
  await click(".repository-manual-connection > summary");
  await fill("#repository-token", token);
  await click('.repository-connection button[type="submit"]');
  await waitFor(`!!document.querySelector(${JSON.stringify(editableSource + '[contenteditable="true"]')})`);
  await waitFor("!document.querySelector('#change-test').disabled");
  await click("#change-test");
  await waitFor("document.querySelector('.change-test-run')?.dataset.status === 'passed'");
  await click('[data-console-tab="diff"]');
  assert.ok(await evaluate("document.querySelector('.change-diff').textContent.includes('Không có thay đổi')"));
  await replaceEditor({ cdp, evaluate }, comment);
  await waitFor("!document.querySelector('#change-save').disabled");
  await editorShortcut(cdp, "s");
  await waitFor("document.querySelector('#change-save').disabled");
  await editorShortcut(cdp, "z");
  await waitFor("!document.querySelector('#change-save').disabled");
  await editorShortcut(cdp, "s");
  await waitFor("document.querySelector('#change-save').disabled");
  await click('[data-console-tab="details"]');
  const restoredId = await evaluate("document.querySelector('.change-reference dd').textContent");
  const restored = await fetch(`http://127.0.0.1:8000/api/v1/changes/proposals/${restoredId}`,
    { headers: { Authorization: `Bearer ${token}` }, redirect: "error" }).then(response => response.json());
  assert.equal(restored.data.revision, 3);
  assert.equal(restored.data.content.replace(/\r\n?/g, "\n"), original);

  await replaceEditor({ cdp, evaluate }, comment);
  await waitFor("!document.querySelector('#change-save').disabled");
  await click('[aria-label="Đóng quotation_validation.py"]');
  await click('dialog[open] button:last-child');
  await waitFor("!document.querySelector('dialog[open]') && !document.querySelector('.repository-tab')");
  await click(`.repository-explorer button[data-path="${paths[2]}"]`);
  await waitFor(`!!document.querySelector(${JSON.stringify(editableSource + '[contenteditable="true"]')})`);
  assert.equal(await evaluate("document.querySelector('#change-save').disabled"), true);

  await replaceEditor({ cdp, evaluate }, comment + "# Keep unsaved work.\n");
  await waitFor("!document.querySelector('#change-save').disabled");
  await click('.sidebar a[href="/quotations"]');
  await waitFor("!!document.querySelector('dialog[open] #unsaved-title')");
  await click('dialog[open] button:first-child');
  assert.equal(await evaluate("location.pathname"), "/workspace");
  await click("#repository-disconnect");
  await click('dialog[open] button:nth-child(2)');
  await waitFor("!!document.querySelector('#repository-token')");
  assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
}
