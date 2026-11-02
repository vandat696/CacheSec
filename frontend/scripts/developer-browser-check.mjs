import assert from "node:assert/strict";

// Runs through the existing browser-smoke CDP session; no additional framework/browser.
export async function checkDeveloperPreview({ cdp, navigate, evaluate, waitFor, click, fill, key, screenshot }) {
  await navigate("/workspace");
  await waitFor("!!document.querySelector('.developer-workspace')");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewOnly"), "true");
  assert.equal(await evaluate("document.querySelector('.sidebar a[aria-current=page]').getAttribute('href')"), "/workspace");
  assert.equal(await evaluate("document.querySelectorAll('.dev-code-line.added').length"), 7);
  await screenshot("developer-diff-1440x900.png");

  await click('.dev-segment button[aria-pressed="false"]');
  assert.equal(await evaluate("document.querySelectorAll('.dev-code-line.added').length"), 0);
  await click('.dev-segment button[aria-pressed="false"]');
  await fill("#preview-cache", "rejected");
  assert.match(await evaluate("document.querySelector('.dev-cache-outcome').textContent"), /truy xuất lại/);
  await fill("#preview-cache", "miss");
  assert.match(await evaluate("document.querySelector('.dev-cache-label').textContent"), /Miss/);
  await fill("#preview-cache", "hit");
  await click("#dev-tab-approval");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#preview-deploy').disabled"), true);
  await click("#preview-acknowledge");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  await click("#dev-tab-tests");
  await click("#preview-tests");
  assert.equal(await evaluate("document.querySelectorAll('.dev-test-pass').length"), 4);
  await screenshot("developer-tests-1440x900.png");
  await click("#dev-tab-approval");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), false);
  await fill("#preview-role", "developer");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#preview-acknowledge').disabled"), true);
  await fill("#preview-role", "reviewer");
  await click("#preview-acknowledge");
  await click("#preview-approve");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewApproval"), "approved");
  assert.equal(await evaluate("document.querySelector('#preview-deploy').disabled"), true);
  await screenshot("developer-approval-1440x900.png");
  await click("#dev-tab-diff");
  await click("#preview-revise");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewRevision"), "2");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewApproval"), "pending");
  await click("#dev-tab-tests");
  assert.equal(await evaluate("document.querySelectorAll('.dev-test-pass').length"), 0);
  await click("#dev-tab-approval");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  await click("#preview-request-changes");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewApproval"), "changes-requested");
  await click("#dev-tab-trace");
  assert.ok(await evaluate("document.querySelectorAll('.dev-trace-list li').length > 5"));
  await click("#dev-tab-diff");
  await key("ArrowRight");
  assert.equal(await evaluate("document.activeElement.id"), "dev-tab-tests");
  await key("End");
  assert.equal(await evaluate("document.activeElement.id"), "dev-tab-trace");
  await key("Home");
  assert.equal(await evaluate("document.activeElement.id"), "dev-tab-diff");

  await fill("#developer-prompt", '<img src=x onerror="window.previewInjected=true">');
  await click('.dev-composer button[type="submit"]');
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('.dev-message img').length"), 0);
  assert.equal(await evaluate("window.previewInjected === true"), false);
  await click('.dev-suggestions button');
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 6);
  await click("#preview-reset");
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 2);
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewRevision"), "1");
  assert.equal(await evaluate("document.querySelectorAll('.dev-trace-list li').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('[id]').length === new Set([...document.querySelectorAll('[id]')].map(el => el.id)).size"), true);

  for (const [width, height] of [[360, 800], [390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/workspace");
    for (const tab of ["diff", "tests", "approval", "trace"]) {
      await click(`#dev-tab-${tab}`);
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Workspace không tràn ngang: ${tab} ${width}`);
      assert.ok(await evaluate("[...document.querySelectorAll('.dev-review-tabs button')].every(el => el.getBoundingClientRect().right <= innerWidth)"));
      await screenshot(`developer-${tab}-${width}x${height}.png`);
    }
    if (width < 768) {
      await click(".mobile-toggle");
      await click('.sidebar a[href="/workspace"]');
      assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), false);
    }
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("/workspace");
  await click("#dev-tab-diff");
  await screenshot("developer-workspace-desktop.png");
}
