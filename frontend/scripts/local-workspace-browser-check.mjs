import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { replaceEditor, editorShortcut, visibleEditorText } from "./editor-browser-actions.mjs";

export async function checkLocalWorkspace({ cdp, navigate, evaluate, waitFor, click, screenshot }) {
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local", import.meta.url)));
  const connected = "document.querySelector('.repository-panel')?.dataset.connected === 'true'";
  const requests = [];
  // Record only path/header presence, never launch capabilities, cookies or credentials.
  await cdp("Network.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original = window.fetch.bind(window);
    window.__workspaceRequests = [];
    window.fetch = (url, init) => {
      window.__workspaceRequests.push({path:String(url).split('#')[0], bearer:!!init?.headers?.Authorization});
      return original(url, init);
    };
  })()` });
  async function openLaunch(launch) {
    // Model the new browser tab opened by the OS launcher, not a hash-only same-document jump.
    await cdp("Page.navigate", { url: "about:blank" });
    await navigate("/workspace#local-launch=" + launch);
  }
  const launch = await store.issueLaunch();
  await openLaunch(launch);
  await waitFor(connected);
  await waitFor("!document.querySelector('#change-test').disabled");
  assert.equal(await evaluate("location.hash"), "");
  assert.equal(await evaluate("!!document.querySelector('#repository-token')"), false);
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  assert.equal(await evaluate("document.cookie.includes('cachesec_workspace')"), false);
  const cookies = (await cdp("Network.getCookies", { urls: ["http://127.0.0.1:3000/api/local-control/session"] })).cookies;
  const cookie = cookies.find(c => c.name === "cachesec_workspace");
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie.sameSite, "Strict");
  assert.ok(cookie.expires * 1000 <= Date.now() + 8 * 60 * 60 * 1000);
  const original = await evaluate(visibleEditorText);
  await replaceEditor({ cdp, evaluate }, original + "\n# Local session browser check.\n");
  await editorShortcut(cdp, "s");
  await waitFor("document.querySelector('.repository-save-status')?.textContent === 'Đã lưu'");
  await click("#change-test");
  await waitFor("document.querySelector('.change-test-run')?.dataset.status === 'passed'", "Local session Docker test");
  requests.push(...await evaluate("window.__workspaceRequests"));
  await screenshot("workspace-local-session.png");

  // Reload and ordinary navigation reuse the cookie; opening a project still checks the backend.
  await navigate("/workspace"); await waitFor(connected);
  await waitFor("!!document.querySelector('.cm-content')");
  assert.equal(await evaluate(visibleEditorText), original);
  requests.push(...await evaluate("window.__workspaceRequests"));
  assert.ok(requests.some(r => r.path.includes("/api/v1/changes/proposals")));
  assert.ok(requests.every(r => !r.bearer));
  assert.ok(requests.filter(r => r.path.includes("/api/")).every(r => r.path.startsWith("/api/local-control/")));
  const protections = await fetch("http://127.0.0.1:3000/workspace");
  assert.equal(protections.headers.get("content-security-policy"), "frame-ancestors 'none'");
  await click("#repository-disconnect");
  await waitFor("!!document.querySelector('.repository-connection')");
  await waitFor("!document.querySelector('.cm-content')");
  await navigate("/workspace");
  await waitFor("!document.querySelector('#repository-token').disabled");
  assert.equal(await evaluate(connected), false);
  assert.equal(await evaluate("document.querySelector('.repository-manual-connection').open"), false);
  await openLaunch(launch);
  await waitFor("!!document.querySelector('.repository-error')");
  assert.equal(await evaluate(connected), false);
  assert.equal(await evaluate("location.hash"), "");
  // A fresh owner-issued link opens the same project again without typing anything.
  await openLaunch(await store.issueLaunch());
  await waitFor(connected);
  await click("#repository-disconnect");
}
