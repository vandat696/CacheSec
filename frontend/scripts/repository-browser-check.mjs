import assert from "node:assert/strict";
import { visibleEditorText } from "./editor-browser-actions.mjs";

// Real control HTTP/PostgreSQL; only delayed/failed UI responses below are fault injection.
export async function checkRepository({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const token = process.env.CACHESEC_BROWSER_CONTROL_TOKEN;
  assert.ok(token?.startsWith("test-only-"), "Start repository_browser_server.py with a test-only token.");
  const connected = "document.querySelector('.repository-panel')?.dataset.connected === 'true'";
  async function connect(value = token) {
    await waitFor("!document.querySelector('#repository-token').disabled");
    if (!await evaluate("document.querySelector('.repository-manual-connection').open")) await click(".repository-manual-connection > summary");
    await fill("#repository-token", value);
    await click('.repository-connection button[type="submit"]');
  }
  const injection = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      if (${JSON.stringify(process.env.CACHESEC_BROWSER_CONTROL_URL ?? "")} && String(url).includes('/api/v1/repository')) {
        const target = new URL(String(url));
        url = ${JSON.stringify(process.env.CACHESEC_BROWSER_CONTROL_URL ?? "")} + target.pathname + target.search;
      }
      if (String(url).includes('/files/')) {
        if (window.repositoryDenyFiles) return new Response('{}', { status: 403 });
        if (window.repositoryDelayFiles) {
          const response = await original(url, { ...init, signal: undefined });
          return new Promise(resolve => {
            window.releaseRepositoryResponse = () => resolve(response);
          });
        }
      }
      return original(url, init);
    };
  })()` });
  await navigate("/workspace");
  await waitFor("!!document.querySelector('#repository-token')");
  assert.equal(await evaluate("document.querySelector('#preview-open-tests').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#preview-open-approval').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#developer-prompt').disabled"), true);
  await connect("invalid-test-token");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('Phiên không hợp lệ')");
  await connect(token + "-denied");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('không có quyền')");
  await connect(); await waitFor(connected);
  await click(".repository-open summary");
  await click("#repository-capture");
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");
  await click(".repository-explorer button[data-path=\"quotation_validation.py\"]");
  await waitFor("[...document.querySelectorAll('.source-editor:not([hidden]) .cm-line')].some(line => line.textContent.includes('validate_quotation'))");
  assert.equal(await evaluate(`(${visibleEditorText}).includes('expiration_review')`), false);
  await click(".repository-reference summary");
  const savedId = await evaluate("document.querySelector('.repository-reference dd').textContent");
  assert.match(savedId, /^[a-f0-9-]{36}$/);
  await click(".repository-reference summary");
  assert.equal(await evaluate("document.documentElement.outerHTML.includes('test-only-repository-browser')"), false);
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  await screenshot("repository-source-desktop.png");
  await click(".repository-explorer button[data-path=\"binary.bin\"]");
  await waitFor("document.querySelector('.repository-file')?.textContent.includes('Tệp nhị phân')");
  assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
  await click(".repository-open summary");
  await fill("#repository-snapshot-id", savedId);
  await click('.repository-open button[type="submit"]');
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");

  // Preserve a real response but deliver it after disconnect; ignore the request's abort.
  await evaluate("window.repositoryDelayFiles = true");
  await click(".repository-explorer button[data-path=\"quotation_validation.py\"]");
  await waitFor("typeof window.releaseRepositoryResponse === 'function'");
  await click("#repository-disconnect");
  await evaluate("window.releaseRepositoryResponse(); window.repositoryDelayFiles = false");
  await waitFor("!!document.querySelector('#repository-token')");
  assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
  await connect(); await waitFor(connected);
  await click(".repository-open summary");
  await fill("#repository-snapshot-id", savedId);
  await click('.repository-open button[type="submit"]');
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");
  await click(".repository-explorer button[data-path=\"quotation_validation.py\"]");
  await waitFor("!!document.querySelector('.cm-content')");

  // A denial must clear the already displayed source too.
  await evaluate("window.repositoryDenyFiles = true");
  await click(".repository-explorer button[data-path=\"quotation_models.py\"]");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('không có quyền')");
  assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
  await evaluate("window.repositoryDenyFiles = false");

  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/workspace");
    await waitFor("!!document.querySelector('#repository-token')");
    await connect(); await waitFor(connected);
    await click(".repository-open summary");
    await fill("#repository-snapshot-id", savedId);
    await click('.repository-open button[type="submit"]');
    await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");
    await click(".repository-explorer button[data-path=\"quotation_validation.py\"]");
    await waitFor("!!document.querySelector('.cm-content')");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`repository-source-${width}.png`);
    await click("#workspace-preview");
    await click('.dev-source-mode button:first-child');
    await waitFor("!!document.querySelector('#repository-token')");
    assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
}
