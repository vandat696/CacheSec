import assert from "node:assert/strict";

// Explicit technical smoke against the local control/worker. Never edits the working tree.
export async function checkCodeChanges({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const token = process.env.CONTROL_REPOSITORY_READ_TOKEN;
  assert.ok(token, "Load the private dev credential before this technical smoke.");
  await navigate("/workspace");
  await fill("#repository-token", token);
  await click('.repository-connection button[type="submit"]');
  await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
  await click("#repository-capture");
  await waitFor("document.querySelectorAll('.repository-source nav button').length === 3");
  await click(".repository-source nav button:last-child");
  await waitFor("!!document.querySelector('.code-changes pre')");
  const original = await evaluate("document.querySelector('.code-changes pre').textContent");
  await click(".change-actions button");
  await waitFor("!!document.querySelector('.code-changes textarea:not(:disabled)')");
  const editor = '.code-changes textarea';
  const statuses = [];
  for (const [suffix, expected] of [
    ["\n# Browser technical smoke.\n", "passed"],
    ["\ndef validate_quotation(quotation):\n    raise RuntimeError('technical smoke')\n", "failed"],
    ["\ndef validate_quotation(quotation):\n    while True:\n        pass\n", "timed_out"],
  ]) {
    await fill(editor, original + suffix);
    await waitFor("!document.querySelector('#change-save').disabled");
    await click("#change-save");
    await waitFor("!document.querySelector('#change-test').disabled");
    assert.ok(await evaluate("document.querySelector('.change-diff pre').textContent.includes('+' )"));
    // A newly saved revision cannot inherit the preceding test's result.
    if (statuses.length) assert.equal(await evaluate("[...document.querySelectorAll('.change-test-run summary')].every(s => s.textContent.includes('Bản cũ'))"), true);
    await click("#change-test");
    await waitFor(`document.querySelector('.change-test-run')?.dataset.status === ${JSON.stringify(expected)}`,
      `Real worker result: ${expected}`);
    statuses.push(expected);
    await screenshot(`code-change-${expected}.png`);
  }
  assert.deepEqual(statuses, ["passed", "failed", "timed_out"]);
  const proposalId = await evaluate("document.querySelector('.code-changes .repository-reference dd').textContent");
  assert.match(proposalId, /^[0-9a-f-]{36}$/);
  assert.equal(await evaluate("localStorage.length + sessionStorage.length"), 0);
  assert.equal(await evaluate("document.querySelector('#preview-open-approval').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#preview-open-tests').disabled"), true);
  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`code-changes-${width}.png`);
  }
  await click(".repository-actions button:last-child");
  await waitFor("!!document.querySelector('#repository-token')");
  assert.equal(await evaluate("!!document.querySelector('.code-changes textarea')"), false);
}
