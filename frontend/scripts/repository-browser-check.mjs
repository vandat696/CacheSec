import assert from "node:assert/strict";

// Real control HTTP/PostgreSQL; only delayed/failed UI responses below are fault injection.
export async function checkRepository({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const token = process.env.CACHESEC_BROWSER_CONTROL_TOKEN;
  assert.ok(token?.startsWith("test-only-"), "Start repository_browser_server.py with a test-only token.");
  const connected = "document.querySelector('.repository-panel')?.dataset.connected === 'true'";
  async function connect(value = token) {
    await fill("#repository-token", value);
    await click('.repository-connection button[type="submit"]');
  }
  const injection = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (url, init) => {
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
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('Token không hợp lệ')");
  await connect(token + "-denied");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('không có quyền')");
  await connect(); await waitFor(connected);
  await click("#repository-capture");
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");
  await click(".repository-source nav button:nth-child(4)");
  await waitFor("document.querySelector('.repository-file pre')?.textContent.includes('validate_quotation')");
  assert.equal(await evaluate("document.querySelector('.repository-file pre').textContent.includes('expiration_review')"), false);
  await click(".repository-reference summary");
  const savedId = await evaluate("document.querySelector('.repository-reference dd').textContent");
  assert.match(savedId, /^[a-f0-9-]{36}$/);
  assert.equal(await evaluate("document.documentElement.outerHTML.includes('test-only-repository-browser')"), false);
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  await screenshot("repository-source-desktop.png");
  await click(".repository-source nav button:first-child");
  await waitFor("document.querySelector('.repository-file')?.textContent.includes('Tệp nhị phân')");
  assert.equal(await evaluate("!!document.querySelector('.repository-file pre')"), false);
  await click(".repository-open summary");
  await fill("#repository-snapshot-id", savedId);
  await click('.repository-open button[type="submit"]');
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");

  // Preserve a real response but deliver it after disconnect; ignore the request's abort.
  await evaluate("window.repositoryDelayFiles = true");
  await click(".repository-source nav button:nth-child(4)");
  await waitFor("typeof window.releaseRepositoryResponse === 'function'");
  await click(".repository-actions button:last-child");
  await evaluate("window.releaseRepositoryResponse(); window.repositoryDelayFiles = false");
  await waitFor("!!document.querySelector('#repository-token')");
  assert.equal(await evaluate("!!document.querySelector('.repository-file pre')"), false);
  await connect(); await waitFor(connected);
  await click(".repository-open summary");
  await fill("#repository-snapshot-id", savedId);
  await click('.repository-open button[type="submit"]');
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 4");
  await click(".repository-source nav button:nth-child(4)");
  await waitFor("!!document.querySelector('.repository-file pre')");

  // A denial must clear the already displayed source too.
  await evaluate("window.repositoryDenyFiles = true");
  await click(".repository-source nav button:nth-child(2)");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('không có quyền')");
  assert.equal(await evaluate("!!document.querySelector('.repository-file pre')"), false);
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
    await click(".repository-source nav button:nth-child(4)");
    await waitFor("!!document.querySelector('.repository-file pre')");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`repository-source-${width}.png`);
    await click("#workspace-preview");
    await click('.dev-source-mode button:first-child');
    await waitFor("!!document.querySelector('#repository-token')");
    assert.equal(await evaluate("!!document.querySelector('.repository-file pre')"), false);
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
}
