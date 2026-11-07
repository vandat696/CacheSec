import assert from "node:assert/strict";

// Runs through the existing browser-smoke CDP session; no additional framework/browser.
export async function checkDeveloperPreview({ cdp, navigate, evaluate, waitFor, click, fill, key, screenshot }) {
  async function closeReview() {
    if (await evaluate("document.querySelector('#developer-review-dialog').open")) {
      await key("Escape");
      await waitFor("!document.querySelector('#developer-review-dialog').open");
    }
  }

  async function openReview(panel) {
    await closeReview();
    await click(`#preview-open-${panel}`);
    await waitFor("document.querySelector('#developer-review-dialog').open");
    assert.equal(await evaluate("document.activeElement.classList.contains('dev-dialog-close')"), true);
  }

  await navigate("/workspace");
  await waitFor("!!document.querySelector('.developer-workspace')");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewOnly"), "true");
  assert.equal(await evaluate("document.querySelector('.sidebar a[aria-current=page]').getAttribute('href')"), "/workspace");
  assert.equal(await evaluate("document.querySelectorAll('.dev-code-line.added').length"), 7);
  assert.equal(await evaluate("document.querySelectorAll('.dev-message, .dev-cache-card, .dev-suggestions, .dev-task-card, .dev-progress, .dev-review-tabs, .dev-preview-banner').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('.dev-workbench > section').length"), 2);
  assert.equal(await evaluate("document.querySelector('.dev-demo-label').textContent"), "Mô phỏng");
  await screenshot("developer-diff-1440x900.png");

  await click('.dev-segment button[aria-pressed="false"]');
  assert.equal(await evaluate("document.querySelectorAll('.dev-code-line.added').length"), 0);
  await click('.dev-segment button[aria-pressed="false"]');
  await openReview("approval");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#preview-deploy').disabled"), true);
  await click("#preview-acknowledge");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  await openReview("tests");
  await click("#preview-tests");
  assert.equal(await evaluate("document.querySelectorAll('.dev-test-pass').length"), 4);
  await screenshot("developer-tests-1440x900.png");
  await openReview("approval");
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
  await closeReview();
  assert.equal(await evaluate("document.activeElement.id"), "preview-open-approval");

  await click(".dev-code-details > summary");
  await click("#preview-revise");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewRevision"), "2");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewApproval"), "pending");
  await openReview("tests");
  assert.equal(await evaluate("document.querySelectorAll('.dev-test-pass').length"), 0);
  await openReview("approval");
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  await click("#preview-request-changes");
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewApproval"), "changes-requested");
  await click(".dev-trace-details > summary");
  assert.ok(await evaluate("document.querySelectorAll('.dev-trace-list li').length > 5"));
  await closeReview();

  await openReview("tests");
  await key("Tab");
  assert.equal(await evaluate("document.querySelector('#developer-review-dialog').contains(document.activeElement)"), true);
  await closeReview();
  assert.equal(await evaluate("document.activeElement.id"), "preview-open-tests");
  await openReview("approval");
  await click(".dev-dialog-close");
  await waitFor("!document.querySelector('#developer-review-dialog').open");
  assert.equal(await evaluate("document.activeElement.id"), "preview-open-approval");

  await click('.dev-composer button[type="submit"]');
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 0);
  assert.equal(await evaluate("document.querySelector('#developer-prompt').getAttribute('aria-invalid')"), "true");
  await fill("#developer-prompt", '<img src=x onerror="window.previewInjected=true">');
  await click('.dev-composer button[type="submit"]');
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('.dev-message img').length"), 0);
  assert.equal(await evaluate("window.previewInjected === true"), false);
  await fill("#developer-prompt", "Validation nằm ở đâu?");
  await click("#developer-prompt");
  await key("Enter");
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 4);
  await click("#preview-reset");
  assert.equal(await evaluate("document.querySelectorAll('.dev-message').length"), 0);
  assert.equal(await evaluate("document.querySelector('.developer-workspace').dataset.previewRevision"), "1");
  await openReview("approval");
  assert.equal(await evaluate("document.querySelectorAll('.dev-trace-list li').length"), 1);
  assert.equal(await evaluate("document.querySelector('#preview-approve').disabled"), true);
  await closeReview();
  assert.equal(await evaluate("document.querySelectorAll('[id]').length === new Set([...document.querySelectorAll('[id]')].map(el => el.id)).size"), true);

  for (const [width, height] of [[360, 800], [390, 844], [820, 1180], [1440, 900]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("/workspace");
    if (width >= 1024) {
      assert.ok(await evaluate("document.querySelector('.dev-editor').getBoundingClientRect().right <= document.querySelector('.dev-assistant').getBoundingClientRect().left + 1"), "Code bên trái, Agent bên phải");
      assert.ok(await evaluate("document.querySelector('.dev-composer').getBoundingClientRect().bottom <= innerHeight"), "Ô nhập nằm trong viewport");
    } else {
      assert.ok(await evaluate("document.querySelector('.dev-editor').getBoundingClientRect().bottom <= document.querySelector('.dev-assistant').getBoundingClientRect().top + 1"), "Code và Agent xếp dọc trên màn nhỏ");
    }
    for (const view of ["diff", "tests", "approval", "trace"]) {
      await closeReview();
      if (view !== "diff") await openReview(view === "trace" ? "approval" : view);
      if (view === "trace") await click(".dev-trace-details > summary");
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Workspace không tràn ngang: ${view} ${width}`);
      if (view !== "diff") {
        assert.ok(await evaluate("document.querySelector('#developer-review-dialog').getBoundingClientRect().right <= innerWidth"));
        assert.ok(await evaluate("document.querySelector('#developer-review-dialog').scrollWidth <= document.querySelector('#developer-review-dialog').clientWidth"), "Nội dung hộp thoại không tràn ngang");
      }
      await screenshot(`developer-${view}-${width}x${height}.png`);
    }
    await closeReview();
    if (width < 768) {
      await click(".mobile-toggle");
      await click('.sidebar a[href="/workspace"]');
      assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), false);
    }
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("/workspace");
  await screenshot("developer-workspace-desktop.png");
}
