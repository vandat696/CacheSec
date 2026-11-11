import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Explicit dev smoke: creates one snapshot, never provisions/revokes grants or changes source.
export async function checkRepositoryDev({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const token = process.env.CONTROL_REPOSITORY_READ_TOKEN;
  assert.ok(token, "Load the private control-access.env before running the dev smoke.");
  const expectedPaths = ["quotation_models.py", "quotation_service.py", "quotation_validation.py"]
    .map((name) => `backend/app/quotation_demo/business/${name}`);
  const validation = (await readFile(new URL("../../backend/app/quotation_demo/business/quotation_validation.py", import.meta.url), "utf8"))
    .replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const connected = "document.querySelector('.repository-panel')?.dataset.connected === 'true'";
  const filesReady = "document.querySelectorAll('.repository-source nav button').length === 3";
  async function connect(value = token) {
    await fill("#repository-token", value);
    await click('.repository-connection button[type="submit"]');
  }
  await navigate("/workspace");
  await waitFor("!!document.querySelector('#repository-token')");
  await connect("invalid-dev-smoke-token");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('Token không hợp lệ')");
  await connect(); await waitFor(connected);
  await click("#repository-capture"); await waitFor(filesReady);
  const paths = await evaluate("[...document.querySelectorAll('.repository-source nav button')].map(button => button.firstChild.textContent)");
  assert.deepEqual(paths, expectedPaths);
  await click(".repository-source nav button:last-child");
  await waitFor("!!document.querySelector('.repository-file pre')");
  assert.ok(await evaluate("document.querySelector('.repository-file pre').textContent") === validation,
    "Snapshot text differs from the current host file.");
  await click(".repository-reference summary");
  const snapshotId = await evaluate("document.querySelector('.repository-reference dd').textContent");
  assert.match(snapshotId, /^[0-9a-f-]{36}$/);
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  assert.equal(await evaluate("document.querySelector('#preview-open-approval').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#preview-open-tests').disabled"), true);

  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/workspace");
    await waitFor("!!document.querySelector('#repository-token')");
    await connect(); await waitFor(connected);
    await click(".repository-open summary");
    await fill("#repository-snapshot-id", snapshotId);
    await click('.repository-open button[type="submit"]'); await waitFor(filesReady);
    await click(".repository-source nav button:last-child");
    await waitFor("!!document.querySelector('.repository-file pre')");
    assert.ok(await evaluate("document.querySelector('.repository-file pre').textContent") === validation,
      "Saved snapshot differs after reconnect.");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`repository-dev-${width}.png`);
    await click(".repository-actions button:last-child");
    await waitFor("!!document.querySelector('#repository-token')");
    assert.equal(await evaluate("!!document.querySelector('.repository-file pre')"), false);
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}
