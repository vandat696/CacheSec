import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { editorShortcut, replaceEditor, visibleEditorText } from "./editor-browser-actions.mjs";

export async function checkWorkbench({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local", import.meta.url)));
  const workspaceConnected = "document.querySelector('.repository-panel')?.dataset.connected === 'true'";
  const quotationConnected = "document.querySelector('.quotation-workspace')?.dataset.connected === 'true'";
  await navigate("/workspace#local-launch=" + await store.issueLaunch());
  await waitFor(workspaceConnected); await waitFor(quotationConnected);
  await waitFor("!document.querySelector('#change-test').disabled");
  assert.equal(await evaluate("[...document.querySelectorAll('input[type=password]')].some(input => input.getClientRects().length)"), false);
  const original = await evaluate(visibleEditorText);
  const saved = original + "\n# Shared workbench navigation check.\n";
  await replaceEditor({ cdp, evaluate }, saved); await editorShortcut(cdp, "s");
  await waitFor("new URL(location.href).searchParams.has('proposal')");
  const proposalId = await evaluate("new URL(location.href).searchParams.get('proposal')");
  const draft = saved + "# Unsaved navigation draft.\n";
  await replaceEditor({ cdp, evaluate }, draft);
  await click('.dev-quotation-link');
  await waitFor("location.pathname === '/quotations' && !document.querySelector('[data-workbench-view=quotations]').hidden");
  assert.equal(await evaluate("!!document.querySelector('dialog[open]')"), false);
  await waitFor(quotationConnected);
  await waitFor("!document.querySelector('#quotation-save').disabled");
  if (!await evaluate("!!document.querySelector('.quotation-row')")) {
    // Only if the development dataset is empty, add one labelled synthetic record via the real UI.
    await fill("#quotation-supplier", "Local session navigation check");
    await fill("#quotation-description", "Dữ liệu giả kiểm tra giữ phiên local");
    await fill("#quotation-amount", "100.00");
    await click("#quotation-save");
    await waitFor("!!document.querySelector('.quotation-details')");
  } else {
    await click(".quotation-row"); await waitFor("!!document.querySelector('.quotation-details')");
  }
  const quotationId = await evaluate("document.querySelector('.quotation-details').dataset.quotationId");
  await fill("#quotation-supplier", "Draft retained across views");
  await click('.sidebar a[href="/workspace"]');
  await waitFor("location.pathname === '/workspace' && !document.querySelector('[data-workbench-view=workspace]').hidden");
  assert.equal(await evaluate("new URL(location.href).searchParams.get('proposal')"), proposalId);
  assert.ok((await evaluate(visibleEditorText)).includes("Unsaved navigation draft"));
  await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').focus()");
  await editorShortcut(cdp, "s");
  await waitFor("document.querySelector('.repository-save-status').textContent === 'Đã lưu'");
  await click('.dev-quotation-link'); await waitFor("location.pathname === '/quotations'");
  assert.equal(await evaluate("document.querySelector('#quotation-supplier').value"), "Draft retained across views");
  assert.equal(await evaluate("document.querySelector('.quotation-details').dataset.quotationId"), quotationId);
  await waitFor("new URL(location.href).searchParams.get('proposal') === " + JSON.stringify(proposalId));
  await waitFor("new URL(location.href).searchParams.get('quotation') === " + JSON.stringify(quotationId));
  await cdp("Page.reload");
  await waitFor(workspaceConnected); await waitFor(quotationConnected);
  await waitFor("document.querySelector('.quotation-details')?.dataset.quotationId === " + JSON.stringify(quotationId));
  await click('.sidebar a[href="/workspace"]'); await waitFor("location.pathname === '/workspace'");
  await waitFor("document.querySelector('.repository-save-status')?.textContent === 'Đã lưu'");
  assert.equal(await evaluate("new URL(location.href).searchParams.get('proposal')"), proposalId);
  await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').focus()");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "End", code: "End", windowsVirtualKeyCode: 35, modifiers: 2 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "End", code: "End", windowsVirtualKeyCode: 35, modifiers: 0 });
  await waitFor(visibleEditorText + ".includes('Unsaved navigation draft')");
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  await screenshot("workbench-session-workspace.png");
  await click('.dev-quotation-link'); await waitFor("location.pathname === '/quotations'");
  await screenshot("workbench-session-quotations.png");
  await click("#quotation-disconnect");
  await waitFor("document.querySelector('.quotation-workspace')?.dataset.connected === 'false'");
  await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'false'");
  assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
  assert.equal(await evaluate("!!document.querySelector('.quotation-details')"), false);
  await cdp("Page.reload");
  await waitFor("!!document.querySelector('#quotation-token') && !document.querySelector('#quotation-token').disabled");
  assert.equal(await evaluate(quotationConnected), false);
  assert.equal(await evaluate(workspaceConnected), false);
}
