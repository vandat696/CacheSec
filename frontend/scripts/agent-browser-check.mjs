import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { editableSource, replaceEditor, visibleEditorText } from "./editor-browser-actions.mjs";

// Generation only is a marked transport double; repository/revisions/test run against real dev APIs.
export async function checkAgent({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local", import.meta.url)));
  const original = (await readFile(new URL("../../backend/app/quotation_demo/business/quotation_validation.py", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
  const content = original + "\n# Test-only Agent suggestion.\n";
  const injection = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original = window.fetch.bind(window);
    window.__agentMode = 'missing';
    window.fetch = async (url, init) => {
      if (String(url).endsWith('/api/v1/agent/config')) return Response.json({
        meta:{request_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',contract_version:'v0.2',identity_mode:'fixture'},
        data:{model:'gpt-6.1-sol',configured:window.__agentMode !== 'missing',mode:'assisted'} });
      if (String(url).endsWith('/api/v1/agent/messages')) {
        const request = JSON.parse(init.body);
        const response = await original('/api/local-control/api/v1/repository/snapshots/'+request.snapshot_id,
          {headers:{'X-CacheSec-Workspace':'1'},credentials:'same-origin'});
        const snapshot = (await response.json()).data;
        if (window.__agentMode === 'delay') await new Promise(resolve => setTimeout(resolve, 500));
        return Response.json({meta:{request_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',contract_version:'v0.2',identity_mode:'fixture'},
          data:{snapshot_id:request.snapshot_id,manifest_digest:snapshot.manifest_digest,repository_identity:snapshot.repository_identity,
            editable_path:'backend/app/quotation_demo/business/quotation_validation.py',
            answer:'Test-only model response: <img src=x onerror=alert(1)>',content:${JSON.stringify(content)},model:'gpt-6.1-sol',usage:null} });
      }
      return original(url, init);
    };
  })()` });
  await navigate("/workspace#local-launch=" + await store.issueLaunch());
  await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
  await waitFor("document.querySelector('.dev-assistant')?.textContent.includes('Chưa cấu hình API key')");
  assert.equal(await evaluate("!!document.querySelector('#workspace-preview, #preview-open-approval')"), false);
  assert.equal(await evaluate("document.querySelector('#agent-prompt').disabled"), true);
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 0);
  await evaluate("window.__agentMode='ready'");
  await click('button[aria-label="Tải lại cấu hình Agent"]');
  await waitFor("!document.querySelector('#agent-prompt').disabled");
  await fill("#agent-prompt", "test-only request");
  await click('.dev-composer button[type="submit"]');
  await waitFor("document.querySelectorAll('.dev-message').length === 2");
  assert.equal(await evaluate("document.querySelectorAll('.dev-message img').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('.agent-proposal').length"), 1);
  assert.equal(await evaluate("document.querySelector('#change-save').disabled"), true);
  await replaceEditor({ cdp, evaluate }, original + "\n# Unsaved human draft.\n");
  await click(".agent-proposal > button");
  await waitFor("document.querySelector('dialog[aria-labelledby=\"unsaved-title\"]')?.open");
  await click('dialog[aria-labelledby="unsaved-title"] .nui-row button:nth-child(1)');
  assert.ok((await evaluate(visibleEditorText)).includes("Unsaved human draft"));
  await click(".agent-proposal > button");
  await click('dialog[aria-labelledby="unsaved-title"] .nui-row button:nth-child(2)');
  await waitFor("document.querySelector('.agent-proposal > button').textContent.includes('Đã áp dụng')");
  await waitFor("document.querySelector('.change-diff pre')?.textContent.includes('Test-only Agent suggestion')");
  await waitFor(`!!document.querySelector(${JSON.stringify(editableSource + '[contenteditable="true"]')})`);
  await evaluate(`document.querySelector(${JSON.stringify(editableSource)}).focus()`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "End", code: "End", windowsVirtualKeyCode: 35, modifiers: 2 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "End", code: "End", windowsVirtualKeyCode: 35, modifiers: 0 });
  await waitFor(`document.querySelector(${JSON.stringify(editableSource)})?.textContent.includes('Test-only Agent suggestion')`);
  await click("#change-test");
  await waitFor("document.querySelector('.change-test-run')?.dataset.status === 'passed'");
  await screenshot("workspace-agent-1440.png");
  await click("#workspace-agent-toggle");
  assert.equal(await evaluate("document.querySelector('.dev-assistant').hidden"), true);
  assert.ok((await evaluate(visibleEditorText)).includes("Test-only Agent suggestion"));
  await click("#workspace-agent-toggle");
  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`workspace-agent-${width}.png`);
  }
  await click("#repository-disconnect");
  await waitFor("!document.querySelector('.cm-content')");
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 0);
  assert.equal(await evaluate("document.querySelector('#agent-prompt').disabled"), true);
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}
