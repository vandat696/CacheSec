import assert from "node:assert/strict";

// The Python runner supplies a disposable PostgreSQL database and test-only tokens.
export async function checkQuotations({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const reader = process.env.QUOTATION_SMOKE_READER_TOKEN;
  const operator = process.env.QUOTATION_SMOKE_OPERATOR_TOKEN;
  assert.ok(reader && operator, "Chạy browser_smoke.py để cấp API/database/token test riêng.");
  const connected = "document.querySelector('.quotation-workspace')?.dataset.connected === 'true'";
  const idle = "!document.querySelector('#quotation-save')?.disabled";

  async function connect(token) {
    await waitFor("!document.querySelector('#quotation-token').disabled");
    if (!await evaluate("document.querySelector('.quotation-manual-connection').open")) await click(".quotation-manual-connection > summary");
    await fill("#quotation-token", token);
    await click('.quotation-connection button[type="submit"]');
  }
  async function create(supplier, mode, value = "") {
    await fill("#quotation-supplier", supplier);
    await fill("#quotation-description", "Báo giá kiểm thử trình duyệt");
    await fill("#quotation-amount", "001234567890123456789.2300");
    await fill("#quotation-expiration-mode", mode);
    if (mode === "text") await fill("#quotation-expiration", value);
    if (mode === "json") await fill("#quotation-expiration-json", value);
    await click("#quotation-save");
  }

  await navigate("/workspace");
  await click('.dev-quotation-link');
  await waitFor("!!document.querySelector('#quotation-token')");
  assert.equal(await evaluate("document.querySelector('.sidebar a[aria-current=page]').getAttribute('href')"), "/quotations");
  await connect("invalid-test-token");
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Token không hợp lệ')");
  assert.equal(await evaluate("document.querySelectorAll('.quotation-row').length"), 0);

  await connect(reader);
  await waitFor(connected);
  assert.equal(await evaluate("document.querySelectorAll('.quotation-row').length"), 50);
  await click("#quotation-more");
  await waitFor("document.querySelectorAll('.quotation-row').length === 53");
  await create("Reader must not create", "missing");
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('không có quyền')");
  assert.equal(await evaluate("document.querySelectorAll('.quotation-row').length"), 53);
  await click(".quotation-row");
  await waitFor("!!document.querySelector('#quotation-validate')");
  await click("#quotation-validate");
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('không có quyền') && !document.querySelector('#quotation-validate').disabled");
  assert.equal(await evaluate("!!document.querySelector('[data-quotation-validation]')"), false);
  await click("#quotation-disconnect");
  assert.equal(await evaluate("document.querySelectorAll('.quotation-row, .quotation-details').length"), 0);

  // Install fault injection before the HTTP client captures its fetch dependency.
  await evaluate(`(() => {
    const original = window.fetch;
    window.quotationRetryCalls = [];
    window.fetch = async (...args) => {
      const options = args[1];
      const validating = options?.method === 'POST' && String(args[0]).endsWith('/validate');
      const creating = options?.method === 'POST' && !validating;
      if (window.quotationTrackRetry && creating) {
        window.quotationRetryCalls.push({key: options.headers['Idempotency-Key'], body: options.body});
      }
      if (window.quotationFailNextRead && options?.method === 'GET') {
        window.quotationFailNextRead = false;
        throw new TypeError('Simulated read connection failure');
      }
      const response = await original(...args);
      if (validating) {
        window.lastQuotationValidation = await response.clone().json();
        if (window.quotationHoldNextValidation) {
          window.quotationHoldNextValidation = false;
          await new Promise(resolve => { window.releaseQuotationValidation = resolve; });
        }
      }
      if (window.quotationDropNextCreate && creating) {
        window.quotationDropNextCreate = false;
        throw new TypeError('Simulated lost response after commit');
      }
      if (window.quotationHoldNextRead && options?.method === 'GET') {
        window.quotationHoldNextRead = false;
        await new Promise(resolve => { window.releaseQuotationRead = resolve; });
      }
      return response;
    };
  })()`);
  await connect(operator);
  await waitFor(connected);
  const cases = [
    ["Browser missing", "missing", ""],
    ["Browser null", "null", ""],
    ["Browser invalid date", "text", "2026-02-30"],
    ["Browser raw JSON", "json", "false"],
    ['<img src=x onerror="window.quotationXss=true">', "text", ""],
  ];
  for (const [supplier, mode, value] of cases) {
    if (mode === "null") await evaluate("window.quotationFailNextRead = true");
    await create(supplier, mode, value);
    await waitFor("document.querySelector('.quotation-notice')?.textContent === 'Đã lưu báo giá.'");
    await waitFor(idle);
    const detail = await evaluate("JSON.parse(document.querySelector('.quotation-details pre').textContent)");
    assert.equal(detail.supplier_name, supplier);
    assert.equal(detail.total_amount, "001234567890123456789.2300");
    assert.equal(Object.hasOwn(detail, "expires_on"), mode !== "missing");
    if (mode !== "missing") assert.deepEqual(detail.expires_on, mode === "null" ? null : mode === "json" ? false : value);
    assert.equal(Object.hasOwn(detail, "flags"), false);
    assert.equal(await evaluate("document.querySelector('#quotation-save').textContent"), "Lưu báo giá");
    assert.equal(await evaluate("!!document.querySelector('[data-quotation-validation]')"), false);
    await click("#quotation-validate");
    await waitFor("!!document.querySelector('[data-quotation-validation]') && !document.querySelector('#quotation-validate').disabled");
    assert.deepEqual(await evaluate("window.lastQuotationValidation.data"), {
      quotation_id: detail.id, flags: [], evaluated_rules: [], validation_config_ref: "quotation-baseline-v1",
      reference_date: null, active_artifact: null,
    });
    assert.equal(await evaluate("document.querySelector('[data-quotation-validation]').textContent.trim()"), "Chưa áp dụng quy tắc nghiệp vụ.");
  }
  assert.equal(await evaluate("!!window.quotationXss || !!document.querySelector('.quotation-details img')"), false);

  // Drop one response after the real fetch has committed on the backend.
  await evaluate("window.quotationTrackRetry = true; window.quotationDropNextCreate = true");
  await create("Browser lost response", "missing");
  await waitFor("document.querySelector('#quotation-save')?.textContent === 'Thử lại lần gửi'");
  assert.equal(await evaluate("document.querySelector('#quotation-supplier').disabled || document.querySelector('.quotation-form fieldset').disabled"), true);
  await click("#quotation-save");
  await waitFor("document.querySelector('.quotation-notice')?.textContent === 'Đã lưu báo giá.'");
  await waitFor(idle);
  const retry = await evaluate("window.quotationRetryCalls");
  assert.equal(retry.length, 2);
  assert.deepEqual(retry[0], retry[1]);
  await click("#quotation-refresh");
  await waitFor(idle);
  await click(".quotation-row");
  await waitFor("!!document.querySelector('.quotation-details')");
  await screenshot("quotations-connected-1440x900.png");

  for (const width of [390, 820, 1440]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Tràn ngang ở ${width}`);
    await screenshot(`quotations-${width}.png`);
  }

  await evaluate("window.quotationFailNextRead = true");
  await click("#quotation-refresh");
  await waitFor("document.querySelector('.quotation-empty')?.textContent === 'Chưa tải được danh sách.'");
  assert.equal(await evaluate("document.querySelectorAll('.quotation-row').length"), 0);
  await click("#quotation-refresh");
  await waitFor("document.querySelectorAll('.quotation-row').length === 50");

  // A delayed validation must not restore results or a previous session after disconnect.
  await click(".quotation-row");
  await waitFor("!!document.querySelector('#quotation-validate')");
  await evaluate("window.quotationHoldNextValidation = true");
  await click("#quotation-validate");
  await waitFor("typeof window.releaseQuotationValidation === 'function'");
  await click("#quotation-disconnect");
  await evaluate("window.releaseQuotationValidation()");
  await connect(operator);
  await waitFor(connected);
  assert.equal(await evaluate("!!document.querySelector('[data-quotation-validation]')"), false);

  // A late GET response must not restore data after disconnecting.
  await evaluate("window.quotationHoldNextRead = true");
  await click("#quotation-refresh");
  await waitFor("typeof window.releaseQuotationRead === 'function'");
  await click("#quotation-disconnect");
  await evaluate("window.releaseQuotationRead()");
  await waitFor("!!document.querySelector('#quotation-token')");
  assert.equal(await evaluate("document.querySelectorAll('.quotation-row, .quotation-details').length"), 0);
  for (const token of [reader, operator]) {
    assert.equal(await evaluate(`JSON.stringify([Object.values(localStorage), Object.values(sessionStorage), document.cookie, location.href]).includes(${JSON.stringify(token)})`), false);
  }
  await connect(operator);
  await waitFor(connected);
  await click('.sidebar a[href="/workspace"]');
  await waitFor("!!document.querySelector('.developer-workspace')");
  await click('.dev-quotation-link');
  await waitFor("!!document.querySelector('#quotation-token')");
  assert.equal(await evaluate(connected), false);
  await navigate("/quotations");
  assert.equal(await evaluate(connected), false);
  await screenshot("quotations-disconnected.png");
}
