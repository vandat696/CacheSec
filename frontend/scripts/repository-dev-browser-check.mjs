import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { visibleEditorText } from "./editor-browser-actions.mjs";

export async function checkRepositoryDev({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const token = process.env.CONTROL_REPOSITORY_READ_TOKEN;
  assert.ok(token, "Load the private control-access.env before running the dev smoke.");
  const expectedPaths = ["quotation_models.py", "quotation_service.py", "quotation_validation.py"]
    .map(name => `backend/app/quotation_demo/business/${name}`);
  const validation = (await readFile(new URL("../../backend/app/quotation_demo/business/quotation_validation.py", import.meta.url), "utf8"))
    .replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const connected = "document.querySelector('.repository-panel')?.dataset.connected === 'true'";
  async function connect(value = token) {
    await waitFor("!document.querySelector('#repository-token').disabled");
    if (!await evaluate("document.querySelector('.repository-manual-connection').open")) await click(".repository-manual-connection > summary");
    await fill("#repository-token", value);
    await click('.repository-connection button[type="submit"]');
  }
  await navigate("/workspace");
  await connect("invalid-dev-smoke-token");
  await waitFor("document.querySelector('.repository-error')?.textContent.includes('Phiên không hợp lệ')");
  await connect(); await waitFor(connected);
  await waitFor("!!document.querySelector('.cm-content')");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.repository-explorer button')].map(button => button.dataset.path)"), expectedPaths);
  assert.equal((await evaluate(visibleEditorText)).replace(/^\uFEFF/, ""), validation);
  await click(".repository-reference summary");
  const snapshotId = await evaluate("document.querySelector('.repository-reference dd').textContent");
  assert.match(snapshotId, /^[0-9a-f-]{36}$/);
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  assert.equal(await evaluate("document.querySelector('#preview-open-approval').disabled"), true);
  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/workspace");
    await connect(); await waitFor(connected);
    await click(".repository-open summary");
    await fill("#repository-snapshot-id", snapshotId);
    await click('.repository-open button[type="submit"]');
    await waitFor("!!document.querySelector('.cm-content')");
    assert.ok((await evaluate(visibleEditorText)).includes("validate_quotation"));
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`repository-ide-${width}.png`);
    await click("#repository-disconnect");
    await waitFor("!!document.querySelector('#repository-token')");
    assert.equal(await evaluate("!!document.querySelector('.cm-content')"), false);
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}
