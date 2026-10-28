// Local browser checks without a test framework. Requires Edge/Chrome and a running app.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const output = join(frontend, "test-results", "browser");
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3100";
const browserPath =
  process.env.BROWSER_PATH ??
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].find(existsSync);
assert.ok(
  browserPath,
  "Đặt BROWSER_PATH tới Edge/Chrome để kiểm tra trình duyệt.",
);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(output, "profile-"));
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const errors = [];
let socket;
let referenceServer;
let captureFailure;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error(`Timeout: ${label}`);
}

try {
  let port;
  await until(async () => {
    try {
      port = (
        await readFile(join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      return !!port;
    } catch {
      return false;
    }
  }, "Khởi động trình duyệt");
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  socket = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await once(socket, "open");
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    if (
      message.method === "Runtime.consoleAPICalled" &&
      message.params.type === "error"
    )
      errors.push(
        message.params.args
          .map((arg) => arg.value ?? arg.description)
          .join(" "),
      );
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  const waitFor = (expression, label = expression) =>
    until(() => evaluate(expression), label);
  const click = async (selector) => {
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center', behavior: 'instant' })`,
    );
    await pause(300);
    const point = await evaluate(
      `(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}; })()`,
    );
    await cdp("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...point,
      button: "left",
      clickCount: 1,
    });
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...point,
      button: "left",
      clickCount: 1,
    });
    await pause(60);
  };
  const fill = async (selector, value) => {
    await evaluate(
      `(() => { const input = document.querySelector(${JSON.stringify(selector)}); const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
    );
    await pause(60);
  };
  const key = async (key, code = key) => {
    const virtualKey = {
      Enter: 13,
      Escape: 27,
      Tab: 9,
      ArrowDown: 40,
      ArrowUp: 38,
      ArrowLeft: 37,
      ArrowRight: 39,
    }[key];
    await cdp("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      windowsVirtualKeyCode: virtualKey,
      text: key === "Enter" ? "\r" : undefined,
    });
    await cdp("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: virtualKey,
    });
    await pause(60);
  };
  const navigate = async (path) => {
    await cdp("Page.navigate", { url: new URL(path, baseUrl).href });
    await waitFor(
      `document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)} && !!document.querySelector('main')`,
    );
    await waitFor(
      `Object.keys(document.querySelector('button')).some(key => key.startsWith('__reactProps'))`,
      "React hydration",
    );
  };
  const setChatMode = async (mode) => {
    await click('.chat-settings button[aria-label="Cài đặt chat"]');
    await waitFor("document.querySelector('.chat-settings button').getAttribute('aria-expanded') === 'true'");
    await click(`.chat-mode-options label:has(input[value="${mode}"])`);
    await key("Escape");
    assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Cài đặt chat");
  };
  const openMetrics = async () => {
    await click(".chat-metrics-trigger");
    await waitFor("document.querySelector('.chat-metrics-dialog').open");
    assert.equal(await evaluate("document.querySelectorAll('.chat-metrics-column').length"), 2);
    assert.ok(await evaluate("[...document.querySelectorAll('.chat-metrics-column')].every(column => column.querySelectorAll('dl > div').length === 5)"));
  };
  const closeMetrics = async () => {
    await key("Escape");
    await waitFor("!document.querySelector('.chat-metrics-dialog').open");
    assert.equal(await evaluate("document.activeElement.classList.contains('chat-metrics-trigger')"), true);
  };
  const checkComposerRow = async (label) => {
    const bounds = await evaluate(`(() => {
      const input = document.querySelector('#prompt').getBoundingClientRect();
      const button = document.querySelector('.composer button[type=submit]').getBoundingClientRect();
      const box = document.querySelector('.composer-box').getBoundingClientRect();
      return {inputRight:input.right,inputBottom:input.bottom,inputHeight:input.height,buttonLeft:button.left,buttonBottom:button.bottom,width:box.width,height:box.height};
    })()`);
    assert.ok(bounds.inputRight <= bounds.buttonLeft, `Nút Gửi phải nằm bên phải ô nhập: ${label}`);
    assert.ok(Math.abs(bounds.inputBottom - bounds.buttonBottom) < 2, `Nút Gửi phải cùng hàng với ô nhập: ${label}`);
    assert.ok(bounds.inputHeight >= 44 && bounds.inputHeight <= 160, `Chiều cao ô nhập: ${label}`);
    return bounds;
  };
  const screenshot = async (filename) => {
    await pause(350);
    const result = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(join(output, filename), Buffer.from(result.data, "base64"));
  };
  captureFailure = async () => {
    await screenshot("failure.png");
    console.error(
      await evaluate(
        "JSON.stringify({url:location.href,focus:document.activeElement.outerHTML.slice(0,200),width:innerWidth})",
      ),
    );
    console.error(errors);
  };
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("/ui");
  assert.equal(
    await evaluate("document.querySelectorAll('.catalog-item').length"),
    21,
  );
  await fill('input[type="search"]', "NumberInput");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.catalog-item:not([hidden])').length",
    ),
    1,
  );
  await fill('input[type="search"]', "không có component này");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.catalog-item:not([hidden])').length",
    ),
    0,
  );
  await fill('input[type="search"]', "");
  await fill(".catalog-toolbar select", "charts");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.catalog-item:not([hidden])').length",
    ),
    3,
  );
  await fill(".catalog-toolbar select", "all");

  await fill("#template-NumberInput input", "257");
  await evaluate(
    "document.querySelector('#template-NumberInput input').dispatchEvent(new FocusEvent('focusout', {bubbles:true}))",
  );
  await waitFor(
    "document.querySelector('#template-NumberInput input').getAttribute('aria-invalid') === 'true'",
  );
  await fill("#template-NumberInput input", "2048");
  await waitFor(
    "document.querySelector('#template-NumberInput input').getAttribute('aria-invalid') === 'false'",
  );
  await fill('#template-Slider input[type="number"]', "1.2");
  assert.equal(
    await evaluate(
      "document.querySelector('#template-Slider input[type=range]').value",
    ),
    "1.2",
  );
  await click('#template-Switch [role="switch"]');
  assert.equal(
    await evaluate(
      "document.querySelector('#template-Switch [role=switch]').getAttribute('aria-checked')",
    ),
    "false",
  );

  await evaluate("document.querySelector('#template-Tabs [role=tab]').focus()");
  await key("ArrowRight");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('#template-Tabs [role=tab]')[1].getAttribute('aria-selected')",
    ),
    "true",
  );
  await click("#template-Dropdown .nui-dropdown > button");
  await key("ArrowDown");
  await key("Enter");
  await waitFor(
    "document.querySelector('.app-toast').textContent.includes('details')",
  );
  await click("#template-Dialog .catalog-preview > button");
  await waitFor("document.querySelector('dialog').open");
  await key("Escape");
  await waitFor("!document.querySelector('dialog').open");
  assert.equal(
    await evaluate("document.activeElement.textContent"),
    "Mở Dialog",
  );

  for (const name of ["LineChart", "BarChart", "DonutChart", "DataTable"]) {
    await click(`#template-${name} .catalog-preview > button`);
    assert.ok(
      await evaluate(
        `document.querySelector('#template-${name} .nui-empty') !== null`,
      ),
    );
    await click(`#template-${name} .catalog-preview > button`);
  }
  await click("#template-FlowDiagram .nui-node:last-child");
  assert.ok(
    await evaluate(
      "document.querySelector('#template-FlowDiagram .nui-flow-detail').textContent.includes('Đầu ra')",
    ),
  );
  await evaluate(
    "Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText: async text => { window.copiedText = text; }}})",
  );
  await click("#template-Button .catalog-item-footer button");
  assert.ok(await evaluate("window.copiedText.includes('import { Button }')"));
  await evaluate(
    "Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText: async () => { throw new Error('Clipboard denied'); }}})",
  );
  await click("#template-TextInput .catalog-item-footer button");
  assert.ok(
    await evaluate(
      "!document.querySelector('#template-TextInput .copy-fallback').hidden",
    ),
  );

  await navigate("/");
  assert.equal(await evaluate("document.querySelector('.chat-mode-options input:checked').value"), "compare");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.chat-mode-options label span')].map(label => label.textContent)"), ["Không cache", "Cache", "Cả hai"]);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.chat-panel-heading h2')].map(heading => heading.textContent)"), ["Không cache", "Cache"]);
  await fill('#prompt', 'Mặc định gửi cho cả hai nhánh');
  await click('.composer button[type="submit"]');
  await waitFor("document.querySelectorAll('.message.assistant').length === 2");
  assert.ok(await evaluate("[...document.querySelectorAll('.chat-panel')].every(panel => panel.querySelector('.message.user p').textContent === 'Mặc định gửi cho cả hai nhánh')"));
  await screenshot('chat-default-both-1440x900.png');
  await navigate('/');
  assert.equal(await evaluate("document.querySelector('.chat-mode-options input:checked').value"), "compare");
  await setChatMode('no-cache');
  assert.ok(await evaluate("!!document.querySelector('.topbar .chat-settings')"));
  assert.equal(await evaluate("document.querySelector('.chat-settings button').textContent.trim()"), "");
  assert.equal(await evaluate("document.querySelectorAll('.chat-heading, .chat-current-mode').length"), 0);
  await openMetrics();
  assert.equal(await evaluate("document.querySelector('.chat-metrics-dialog select').disabled"), true);
  assert.ok(await evaluate("[...document.querySelectorAll('.chat-metrics-column dd')].every(value => value.textContent === '—')"));
  await closeMetrics();
  assert.equal(
    await evaluate("document.querySelectorAll('.sidebar nav a.nav').length"),
    3,
  );
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.sidebar nav a.nav')].map(link => link.textContent.trim())"), ["Chat", "Số liệu", "Tài liệu"]);
  assert.equal(
    await evaluate(
      "document.querySelector('.sidebar').textContent.includes('Cấu hình')",
    ),
    false,
  );
  await click('.composer button[type="submit"]');
  assert.equal(
    await evaluate(
      "document.querySelector('#prompt').getAttribute('aria-invalid')",
    ),
    "true",
  );
  await fill("#prompt", "Dòng thứ nhất\nDòng thứ hai\nDòng thứ ba");
  const multiline = await checkComposerRow("nhiều dòng");
  assert.ok(multiline.inputHeight > 44);
  await evaluate("document.querySelector('#prompt').focus()");
  await cdp("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,modifiers:8,text:"\r"});
  await cdp("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,modifiers:8});
  await pause(100);
  assert.equal(await evaluate("document.querySelectorAll('.message.user').length"), 0);
  assert.equal(await evaluate("document.querySelector('#prompt').value.split('\\n').length"), 4);
  await fill("#prompt", "Dòng dài\n".repeat(20));
  assert.equal((await checkComposerRow("giới hạn nhiều dòng")).inputHeight, 160);
  assert.ok(await evaluate("document.querySelector('#prompt').scrollHeight > document.querySelector('#prompt').clientHeight"));
  const unsafeText = '<img src=x onerror="window.injected=true"> Câu hỏi mẫu';
  await fill("#prompt", unsafeText);
  await click('.composer button[type="submit"]');
  await click('.composer button[type="submit"]');
  await waitFor("document.querySelectorAll('.message.assistant').length === 1");
  assert.equal((await checkComposerRow("sau gửi")).inputHeight, 44);
  assert.equal(
    await evaluate("document.querySelectorAll('.message.user').length"),
    1,
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.messages img').length"),
    0,
  );
  assert.equal(await evaluate("window.injected === true"), false);
  assert.ok(
    await evaluate(
      "document.querySelector('.message.assistant').textContent.includes('chưa kết nối')",
    ),
  );
  await openMetrics();
  assert.equal(await evaluate("document.querySelectorAll('.chat-metrics-dialog select option').length"), 1);
  assert.equal(await evaluate("document.querySelector('.chat-metrics-prompt').textContent"), unsafeText);
  assert.equal(await evaluate("document.querySelectorAll('.chat-metrics-prompt img').length"), 0);
  assert.ok(await evaluate("[...document.querySelectorAll('[data-metrics-branch=cache] dd')].every(value => value.textContent === 'Không chạy')"));
  await closeMetrics();

  assert.equal(await evaluate("document.querySelector('#chat-history').inert"), true);
  await evaluate("document.querySelector('.history-toggle').focus()");
  await key("Enter");
  await waitFor("!document.querySelector('#chat-history').inert");
  await pause(250);
  await click(".new-conversation");
  await fill("#prompt", "Bản nháp hội thoại mới");
  await click(".history-item:last-child");
  assert.equal(
    await evaluate("document.querySelectorAll('.message').length"),
    2,
  );
  await click(".history-item:first-child");
  assert.equal(
    await evaluate("document.querySelector('#prompt').value"),
    "Bản nháp hội thoại mới",
  );

  await click('.sidebar a[href="/documents"]');
  await waitFor(
    "location.pathname === '/documents' && !!document.querySelector('#document-files')",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    0,
  );
  const fixtures = join(output, "fixtures");
  await mkdir(fixtures, { recursive: true });
  await writeFile(join(fixtures, "policy.txt"), "SYNTHETIC_POLICY_BODY");
  await writeFile(join(fixtures, "guide.md"), "# Synthetic guide");
  await writeFile(join(fixtures, "bad.exe"), "Synthetic unsupported file");
  await writeFile(join(fixtures, "empty.txt"), "");
  const upload = async (names) => {
    const { root } = await cdp("DOM.getDocument");
    const { nodeId } = await cdp("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "#document-files",
    });
    await cdp("DOM.setFileInputFiles", {
      nodeId,
      files: names.map((name) => join(fixtures, name)),
    });
    await pause(100);
  };
  await fill(".document-intake select", "hr");
  await upload(["policy.txt", "guide.md", "bad.exe", "empty.txt"]);
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    2,
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.document-issues').textContent.includes('bad.exe')",
    ),
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.document-issues').textContent.includes('empty.txt')",
    ),
  );
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.document-row select')].every(select => select.value === 'hr')",
    ),
  );
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.document-status')].every(node => node.textContent === 'Chờ tải lên')",
    ),
  );
  await click(".document-issues button");
  await upload(["policy.txt"]);
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    2,
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.document-issues').textContent.includes('đã có')",
    ),
  );
  await click(".document-issues button");
  await fill(".document-row select", "technical");
  await fill(".document-toolbar select", "hr");
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    1,
  );
  await fill(".document-toolbar select", "all");
  await fill('.document-toolbar input[type="search"]', "POLICY");
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    1,
  );
  await fill('.document-toolbar input[type="search"]', "missing");
  assert.ok(
    await evaluate(
      "document.querySelector('.documents-empty').textContent.includes('Không tìm thấy')",
    ),
  );
  await fill('.document-toolbar input[type="search"]', "");

  await evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["Synthetic dropped file"], "drop.txt", {lastModified: 1}));
    document.querySelector(".upload-dropzone").dispatchEvent(new DragEvent("drop", {dataTransfer: transfer, bubbles: true, cancelable: true}));
  })()`);
  await waitFor("document.querySelectorAll('.document-row').length === 3");
  await click('.document-row button[aria-label="Bỏ guide.md khỏi danh sách"]');
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    2,
  );
  await screenshot("documents-populated-1440x900.png");

  await click('.sidebar a[href="/"]');
  await waitFor(
    "location.pathname === '/' && !!document.querySelector('#prompt')",
  );
  assert.equal(
    await evaluate("document.querySelector('#prompt').value"),
    "Bản nháp hội thoại mới",
  );
  await evaluate("document.querySelector('#prompt').focus()");
  await key("Enter");
  await click('.sidebar a[href="/documents"]');
  await waitFor(
    "location.pathname === '/documents' && !!document.querySelector('#document-files')",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    2,
  );
  await pause(1100);
  await click('.sidebar a[href="/"]');
  await waitFor(
    "location.pathname === '/' && document.querySelectorAll('.message.assistant').length === 1",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.message.assistant').textContent.includes('SYNTHETIC_POLICY_BODY')",
    ),
    false,
  );

  // One composer, independent branch histories, and concurrent comparison replies.
  await setChatMode("cache");
  assert.equal(await evaluate("document.querySelectorAll('.chat-panel').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('.message').length"), 0);
  await fill("#prompt", "Câu hỏi riêng cho nhánh cache");
  await click('.composer button[type="submit"]');
  assert.equal(await evaluate("document.querySelector('.chat-settings button').disabled"), true);
  await openMetrics();
  assert.equal(await evaluate("document.querySelector('[data-metrics-branch=cache] .chat-metrics-state').textContent"), "Đang chờ phản hồi");
  await waitFor("document.querySelector('[data-metrics-branch=cache] .chat-metrics-state').textContent === 'Phản hồi mẫu'");
  await closeMetrics();
  await waitFor("document.querySelectorAll('.message.assistant').length === 1");
  assert.ok(await evaluate("document.querySelector('.message.assistant').textContent.includes('Cache chưa được triển khai')"));
  await setChatMode("compare");
  assert.equal(await evaluate("document.querySelectorAll('.chat-panel').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('.composer textarea').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('.chat-mode-options input').length"), 3);
  await fill("#prompt", unsafeText);
  await click('.composer button[type="submit"]');
  await click('.composer button[type="submit"]');
  for (const branch of ["cache", "no-cache"]) {
    assert.equal(await evaluate(`document.querySelectorAll('[data-branch="${branch}"] .message.user').length`), 2);
    assert.equal(await evaluate(`document.querySelector('[data-branch="${branch}"] .message.user:last-of-type p').textContent`), unsafeText);
    assert.ok(await evaluate(`!!document.querySelector('[data-branch="${branch}"] [role="status"]')`));
  }
  assert.equal(await evaluate("document.querySelector('.new-conversation').disabled"), true);
  await click('.sidebar a[href="/documents"]');
  await waitFor("location.pathname === '/documents' && !!document.querySelector('#document-files')");
  await pause(1100);
  await click('.sidebar a[href="/"]');
  await waitFor("location.pathname === '/' && document.querySelectorAll('.message.assistant').length === 4");
  assert.equal(await evaluate("document.querySelectorAll('.messages img').length"), 0);
  assert.equal(await evaluate("window.injected === true"), false);
  await evaluate("Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText: async text => { window.copiedText = text; }}})");
  await click('[data-branch="cache"] .message.assistant:last-child .message-body > button');
  assert.ok(await evaluate("window.copiedText.includes('Cache chưa được triển khai')"));
  await screenshot("chat-comparison-1440x900.png");
  await setChatMode("no-cache");
  assert.equal(await evaluate("document.querySelectorAll('.message.assistant').length"), 2);
  await setChatMode("compare");
  await click(".new-conversation");
  assert.equal(await evaluate("document.querySelectorAll('.chat-panel').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('.message').length"), 0);
  await click(".history-item:last-child");
  assert.equal(await evaluate("document.querySelectorAll('.chat-panel').length"), 1);
  await click(".history-item:nth-child(2)");
  assert.equal(await evaluate("document.querySelectorAll('.message.assistant').length"), 4);
  await openMetrics();
  const turnOptions = await evaluate("[...document.querySelector('.chat-metrics-dialog select').options].map(option => ({value:option.value,text:option.textContent}))");
  assert.equal(turnOptions.length, 3);
  assert.equal(await evaluate("document.querySelector('.chat-metrics-dialog select').value"), turnOptions[0].value);
  assert.equal(await evaluate("document.querySelector('.chat-metrics-prompt').textContent"), unsafeText);
  for (const branch of ["cache", "no-cache"]) {
    assert.equal(await evaluate(`document.querySelector('[data-metrics-branch="${branch}"] [data-metric=llmCalls] dd').textContent`), "0");
    assert.equal(await evaluate(`document.querySelector('[data-metrics-branch="${branch}"] [data-metric=llmTokens] dd').textContent`), "0");
    assert.equal(await evaluate(`document.querySelector('[data-metrics-branch="${branch}"] [data-metric=responseTime] dd').textContent`), "Chưa đo");
    assert.equal(await evaluate(`document.querySelector('[data-metrics-branch="${branch}"] [data-metric=permission] dd').textContent`), "Chưa xác minh");
  }
  assert.equal(await evaluate("document.querySelector('[data-metrics-branch=cache] [data-metric=cacheStatus] dd').textContent"), "Chưa xác định");
  await fill(".chat-metrics-dialog select", turnOptions[2].value);
  assert.equal(await evaluate("document.querySelector('.chat-metrics-prompt').textContent"), "Bản nháp hội thoại mới");
  assert.ok(await evaluate("[...document.querySelectorAll('[data-metrics-branch=cache] dd')].every(value => value.textContent === 'Không chạy')"));
  await fill(".chat-metrics-dialog select", turnOptions[1].value);
  assert.equal(await evaluate("document.querySelector('.chat-metrics-prompt').textContent"), "Câu hỏi riêng cho nhánh cache");
  assert.ok(await evaluate("[...document.querySelectorAll('[data-metrics-branch=no-cache] dd')].every(value => value.textContent === 'Không chạy')"));
  await closeMetrics();
  await openMetrics();
  assert.equal(await evaluate("document.querySelector('.chat-metrics-dialog select').value"), turnOptions[0].value);
  await screenshot("chat-metrics-1440x900.png");
  await click('.chat-metrics-heading button[aria-label="Đóng thông số"]');
  await waitFor("!document.querySelector('.chat-metrics-dialog').open");
  await fill("#prompt", unsafeText);
  await click('.composer button[type="submit"]');
  await waitFor("document.querySelectorAll('.message.assistant').length === 6");
  await openMetrics();
  const repeatedOptions = await evaluate("[...document.querySelector('.chat-metrics-dialog select').options].map(option => ({value:option.value,text:option.textContent}))");
  assert.equal(repeatedOptions.length, 4);
  assert.notEqual(repeatedOptions[0].value, repeatedOptions[1].value);
  assert.ok(repeatedOptions[0].text.includes("Câu hỏi mẫu") && repeatedOptions[1].text.includes("Câu hỏi mẫu"));
  await closeMetrics();

  // Dashboard reuses session turns without turning demo completion into measurements.
  await click('.sidebar a[href="/metrics"]');
  await waitFor("location.pathname === '/metrics' && !!document.querySelector('#metrics-conversation')");
  assert.equal(await evaluate("document.querySelector('.metrics-workspace').dataset.metricsSource"), "sample");
  assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), "24");
  assert.equal(await evaluate("document.querySelectorAll('.metrics-trend-series circle').length"), 48);
  assert.equal(await evaluate("document.querySelectorAll('.metrics-comparison-table [data-better]').length"), 3);
  assert.ok(await evaluate("document.querySelector('.metrics-preview-control').textContent.includes('Không phải kết quả đo')"));
  await click('[data-metrics-view=general] .metrics-turn-button');
  assert.ok(await evaluate("document.querySelector('[data-metrics-view=general] .metrics-turn-detail').textContent.includes('1.480 ms')"));
  await fill('#metrics-conversation', 'sample-permissions');
  assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), "8");
  assert.equal(await evaluate("document.querySelector('#metrics-query-index').max"), "8");
  await click('.metrics-preview-control [role=switch]');
  assert.equal(await evaluate("document.querySelector('.metrics-workspace').dataset.metricsSource"), "session");
  assert.equal(await evaluate("document.querySelector('#metrics-conversation').value"), "all");
  assert.ok(await evaluate("[...document.querySelector('#metrics-conversation').options].every(option => !option.value.startsWith('sample-'))"));
  assert.equal(await evaluate("document.querySelector('.nav[aria-current=page]').textContent.trim()"), "Số liệu");
  assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), "5");
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=general] .metrics-turns-table tbody tr').length"), 5);
  assert.equal(await evaluate("document.querySelector('[data-metrics-view=general] .metrics-empty-ring strong').textContent"), "—");
  assert.equal(await evaluate("document.querySelectorAll('.metrics-workspace img').length"), 0);
  await click('[data-metrics-view=general] .metrics-turn-button');
  assert.ok(await evaluate("!document.querySelector('[data-metrics-view=general] .metrics-turn-detail-region').hidden"));
  assert.ok(await evaluate("document.querySelector('[data-metrics-view=general] .metrics-turn-detail').textContent.includes('Chưa xác minh')"));
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=general] .metrics-turn-detail img').length"), 0);
  await fill('#metrics-chart-kind', 'calls');
  assert.equal(await evaluate("document.querySelectorAll('.metrics-trend-series circle').length"), 7);
  assert.equal(await evaluate("document.querySelector('#metrics-query-index').max"), '5');
  assert.equal(await evaluate("document.querySelector('#metrics-query-index').value"), '5');
  await fill('#metrics-query-index', '1');
  assert.ok(await evaluate("document.querySelector('.metrics-trend-inspector').textContent.includes('Không chạy')"));
  await fill('#metrics-chart-kind', 'tokens');
  assert.equal(await evaluate("document.querySelectorAll('.metrics-trend-series circle').length"), 7);
  await fill('#metrics-chart-kind', 'response');
  assert.equal(await evaluate("document.querySelectorAll('.metrics-trend-series circle, .metrics-trend-series polyline').length"), 0);
  const dashboardConversations = await evaluate("[...document.querySelector('#metrics-conversation').options].map(item => item.value)");
  await fill('#metrics-conversation', dashboardConversations.at(-1));
  assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), "1");
  await click('[data-metrics-view=general] .metrics-turn-button');
  assert.ok(await evaluate("document.querySelector('[data-metrics-view=general] .metrics-turn-detail').textContent.includes('Không chạy')"));
  await fill('#metrics-conversation', 'all');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.metrics-tabs [role=tab]')].map(tab => tab.textContent)"), ['Chung', 'Không cache', 'Cache']);
  assert.equal(await evaluate("document.querySelector('.metrics-tabs [role=tab][aria-selected=true]').textContent"), 'Chung');
  const comparisonBounds = await evaluate("[...document.querySelectorAll('[data-comparison-branch]')].map(card => {const r = card.getBoundingClientRect(); return {top:r.top,left:r.left,right:r.right};})");
  assert.equal(comparisonBounds[0].top, comparisonBounds[1].top);
  assert.ok(comparisonBounds[0].right <= comparisonBounds[1].left);
  assert.equal(await evaluate("document.querySelectorAll('.metrics-comparison-table tbody tr').length"), 9);
  assert.ok(await evaluate("[...document.querySelectorAll('.metrics-comparison-table tbody tr')].every(row => row.children.length === 3 && row.children[1].tagName === 'TH')"));
  assert.equal(await evaluate("document.querySelectorAll('.metrics-comparison-table [data-better]').length"), 0);
  await evaluate("document.querySelector('.metrics-tabs [role=tab]').focus()");
  await key('ArrowRight');
  assert.equal(await evaluate("document.querySelector('.metrics-tabs [role=tab][aria-selected=true]').textContent"), 'Không cache');
  assert.equal(await evaluate("document.querySelector('[data-metrics-view=no-cache] [data-summary=turns]').textContent"), '4');
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=no-cache] .metrics-turns-table tbody tr').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=no-cache] .metrics-turns-table thead th').length"), 3);
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=no-cache] .metrics-empty-ring').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=no-cache] .metrics-series').length"), 1);
  await click('[data-metrics-view=no-cache] .metrics-turn-button');
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=no-cache] .metrics-detail-columns > section').length"), 1);
  await evaluate("document.querySelector('.metrics-tabs [role=tab][aria-selected=true]').focus()");
  await key('End');
  assert.equal(await evaluate("document.querySelector('.metrics-tabs [role=tab][aria-selected=true]').textContent"), 'Cache');
  assert.equal(await evaluate("document.querySelector('[data-metrics-view=cache] [data-summary=turns]').textContent"), '3');
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=cache] .metrics-turns-table tbody tr').length"), 3);
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=cache] .metrics-series').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=cache] .metrics-empty-ring').length"), 1);
  await click('[data-metrics-view=cache] .metrics-turn-button');
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=cache] .metrics-detail-columns > section').length"), 1);
  await fill('#metrics-conversation', dashboardConversations.at(-1));
  assert.equal(await evaluate("document.querySelector('[data-metrics-view=cache] [data-summary=turns]').textContent"), '0');
  await evaluate("document.querySelector('.metrics-tabs [role=tab][aria-selected=true]').focus()");
  await key('Home');
  assert.equal(await evaluate("document.querySelector('.metrics-tabs [role=tab][aria-selected=true]').textContent"), 'Chung');
  assert.equal(await evaluate("document.querySelector('#metrics-conversation').value"), dashboardConversations.at(-1));
  await fill('#metrics-conversation', 'all');
  assert.equal(await evaluate("document.querySelectorAll('[id]').length === new Set([...document.querySelectorAll('[id]')].map(node => node.id)).size"), true);
  await evaluate('window.scrollTo(0, 0)');
  await screenshot('metrics-populated-1440x900.png');
  await click('.sidebar a[href="/"]');
  await waitFor("location.pathname === '/' && !!document.querySelector('#prompt')");

  // Nested history: five initially, incremental reveal, reset, and cross-route selection.
  for (let index = 0; index < 10; index++) {
    await click(".new-conversation");
    await fill("#prompt", `History draft ${index + 1}`);
  }
  assert.equal(await evaluate("document.querySelectorAll('.history-item').length"), 5);
  assert.ok(await evaluate("!!document.querySelector('.history-more')"));
  await click(".history-more");
  assert.equal(await evaluate("document.querySelectorAll('.history-item').length"), 10);
  await click(".history-more");
  assert.equal(await evaluate("document.querySelectorAll('.history-item').length"), 13);
  assert.equal(await evaluate("!!document.querySelector('.history-more')"), false);
  await click(".history-item:last-child");
  assert.equal(await evaluate("document.querySelectorAll('.message').length"), 2);
  await click('.sidebar a[href="/documents"]');
  await waitFor("location.pathname === '/documents'");
  await click(".history-item:first-child");
  await waitFor("location.pathname === '/' && !!document.querySelector('#prompt')");
  assert.equal(await evaluate("document.querySelector('#prompt').value"), "History draft 10");
  await click(".sidebar-chat-heading .nav");
  await pause(250);
  assert.equal(await evaluate("document.querySelector('#chat-history').inert"), true);
  assert.equal(await evaluate("document.querySelector('#chat-history').getBoundingClientRect().height"), 0);
  await click(".sidebar-chat-heading .nav");
  await pause(250);
  assert.equal(await evaluate("document.querySelectorAll('.history-item').length"), 5);
  assert.equal(await evaluate("document.querySelector('.history-item').getAttribute('aria-current')"), "true");
  assert.equal(await evaluate("document.querySelector('#prompt').value"), "History draft 10");
  await screenshot("chat-history-1440x900.png");

  // Pagination and a response completing while viewing the dashboard.
  for (let index = 0; index < 5; index++) {
    await fill('#prompt', `Lượt kiểm tra dashboard ${index + 1}`);
    await click('.composer button[type="submit"]');
    await waitFor("!document.querySelector('.chat-settings button').disabled");
  }
  await fill('#prompt', 'Hoàn tất khi đang xem Số liệu');
  await click('.composer button[type="submit"]');
  await click('.sidebar a[href="/metrics"]');
  await waitFor("location.pathname === '/metrics' && !!document.querySelector('#metrics-conversation')");
  await click('.metrics-preview-control [role=switch]');
  await waitFor("[...document.querySelectorAll('[data-metrics-view=general] .metrics-stacked-bar')].every(bar => bar.getAttribute('aria-label').includes('0 đang chờ'))");
  assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), '11');
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=general] .metrics-turns-table tbody tr').length"), 8);
  await click('[data-metrics-view=general] .metrics-pagination button:last-child');
  assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=general] .metrics-turns-table tbody tr').length"), 3);
  await click('[data-metrics-view=general] .metrics-turn-button');
  assert.ok(await evaluate("!document.querySelector('[data-metrics-view=general] .metrics-turn-detail-region').hidden"));
  await click('[data-metrics-view=general] .metrics-pagination button:first-of-type');
  assert.equal(await evaluate("document.querySelector('[data-metrics-view=general] .metrics-turn-detail-region').hidden"), true);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.querySelector("[data-metrics-view=general] .metrics-turns").scrollIntoView({block:"start",behavior:"instant"})');
  await click('[data-metrics-view=general] .metrics-turn-button');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await screenshot('metrics-detail-390x844.png');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await navigate("/");
  await openMetrics();
  assert.equal(await evaluate("document.querySelector('.chat-metrics-dialog select').disabled"), true);
  await closeMetrics();
  assert.equal(
    await evaluate("document.querySelectorAll('.message').length"),
    0,
  );
  await click('.sidebar a[href="/documents"]');
  await waitFor(
    "location.pathname === '/documents' && !!document.querySelector('#document-files')",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.document-row').length"),
    0,
  );
  for (const oldPath of ["/chat", "/settings", "/experiments"]) {
    await cdp("Page.navigate", { url: new URL(oldPath, baseUrl).href });
    await waitFor(
      "location.pathname === '/' && !!document.querySelector('.chat-layout')",
    );
  }

  const viewports = [
    [360, 800],
    [390, 844],
    [430, 932],
    [600, 960],
    [820, 1180],
    [1024, 768],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ];
  for (const [width, height] of viewports) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const path of ["/", "/metrics", "/documents"]) {
      await navigate(path);
      if (path === "/metrics") {
        assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), '24');
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Tràn ngang dữ liệu mẫu: ${width}`);
        await screenshot(`metrics-sample-general-${width}x${height}.png`);
        for (const [index, branch] of [[1, 'no-cache'], [2, 'cache']]) {
          await click(`.metrics-tabs [role=tab]:nth-child(${index + 1})`);
          assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Tràn ngang dữ liệu mẫu ${branch}: ${width}`);
          assert.equal(await evaluate(`document.querySelector('[data-metrics-view=${branch}] [data-summary=turns]').textContent`), '24');
          await screenshot(`metrics-sample-${branch}-${width}x${height}.png`);
        }
        await click('.metrics-tabs [role=tab]:first-child');
        await click('.metrics-preview-control [role=switch]');
      }
      if (path === "/") {
        assert.equal(await evaluate("document.querySelector('.chat-mode-options input:checked').value"), 'compare');
        await screenshot(`chat-default-both-${width}x${height}.png`);
        await setChatMode('no-cache');
      }
      if (path === "/documents") await upload(["policy.txt", "guide.md"]);
      await pause(350);
      assert.ok(
        await evaluate("document.documentElement.scrollWidth <= innerWidth"),
        `Tràn ngang: ${path} ${width}x${height}`,
      );
      await screenshot(
        `${path === "/" ? "chat" : path === "/metrics" ? "metrics" : "documents"}-${width}x${height}.png`,
      );
      if (path === '/metrics') {
        assert.equal(await evaluate("document.querySelector('#metrics-query-index').disabled"), true);
        assert.equal(await evaluate("document.querySelector('.metrics-kpis-overview .metrics-kpi:first-child > strong').textContent"), '0');
        assert.equal(await evaluate("document.querySelectorAll('[data-metrics-view=general] .metrics-panel').length"), 4);
        assert.ok(await evaluate("[...document.querySelectorAll('[data-metrics-view=general] .metrics-table-scroll')].every(table => table.scrollWidth === table.clientWidth || getComputedStyle(table).overflowX === 'auto')"));
        const columns = await evaluate("[...document.querySelectorAll('[data-comparison-branch]')].map(card => {const r = card.getBoundingClientRect(); return {top:r.top,left:r.left,right:r.right};})");
        assert.equal(columns[0].top, columns[1].top, `Hai cột so sánh: ${width}`);
        assert.ok(columns[0].right <= columns[1].left);
        const cells = await evaluate("[...document.querySelector('.metrics-comparison-table tbody tr').children].map(cell => {const r = cell.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top};})");
        assert.equal(cells[0].top, cells[1].top);
        assert.equal(cells[1].top, cells[2].top);
        assert.ok(cells[0].right <= cells[1].left && cells[1].right <= cells[2].left, `Tiêu chí ở giữa: ${width}`);
        for (const [index, branch] of [[1, 'no-cache'], [2, 'cache']]) {
          await click(`.metrics-tabs [role=tab]:nth-child(${index + 1})`);
          assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Tràn ngang tab ${branch}: ${width}`);
          assert.equal(await evaluate(`document.querySelector('[data-metrics-view=${branch}] [data-summary=turns]').textContent`), '0');
          await evaluate('window.scrollTo(0,0)');
          await screenshot(`metrics-${branch}-${width}x${height}.png`);
        }
        await click('.metrics-tabs [role=tab]:first-child');
      }
      if (path === "/") {
        const baselineComposer = await checkComposerRow(`không cache ${width}x${height}`);
        await setChatMode("cache");
        const cacheComposer = await checkComposerRow(`có cache ${width}x${height}`);
        assert.equal(cacheComposer.width, baselineComposer.width);
        assert.equal(cacheComposer.height, baselineComposer.height);
        await screenshot(`chat-cache-${width}x${height}.png`);
        await setChatMode("compare");
        const comparisonComposer = await checkComposerRow(`chia đôi ${width}x${height}`);
        assert.equal(comparisonComposer.width, baselineComposer.width);
        assert.equal(comparisonComposer.height, baselineComposer.height);
        await fill("#prompt", "Cùng một câu hỏi cho hai nhánh, kiểm tra nội dung dài: " + "CacheSec".repeat(24));
        await click('.composer button[type="submit"]');
        await waitFor("document.querySelectorAll('.message.assistant').length === 2");
        assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Tràn ngang chia đôi: ${width}x${height}`);
        assert.ok(await evaluate("[...document.querySelectorAll('.messages')].every(log => log.scrollWidth <= log.clientWidth)"), `Tràn ngang tin nhắn: ${width}x${height}`);
        assert.ok(await evaluate("document.querySelector('.composer').getBoundingClientRect().bottom <= innerHeight"), `Ô nhập ngoài màn hình: ${width}x${height}`);
        const bounds = await evaluate("[...document.querySelectorAll('.chat-panel')].map(panel => { const r = panel.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top}; })");
        assert.equal(bounds[0].top, bounds[1].top);
        assert.ok(bounds[0].right <= bounds[1].left);
        assert.ok(await evaluate("[...document.querySelectorAll('.chat-panel, .chat-panel-heading')].every(panel => getComputedStyle(panel).borderTopWidth === '0px' && getComputedStyle(panel).borderLeftWidth === '0px')"), `Viền khung chia đôi: ${width}x${height}`);
        assert.ok(await evaluate("document.querySelector('.chat-panels').getBoundingClientRect().top < 64"), `Vùng chat chưa sát đầu trang: ${width}x${height}`);
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.chat-settings-trigger .icon')).width"), "16px");
        await screenshot(`chat-comparison-${width}x${height}.png`);
        await openMetrics();
        assert.ok(await evaluate("document.querySelector('.chat-metrics-dialog').scrollWidth <= document.querySelector('.chat-metrics-dialog').clientWidth"), `Tràn ngang thông số: ${width}x${height}`);
        assert.ok(await evaluate("document.querySelector('.chat-metrics-dialog').getBoundingClientRect().height <= innerHeight"));
        const metricBounds = await evaluate("[...document.querySelectorAll('.chat-metrics-column')].map(column => { const r = column.getBoundingClientRect(); return {top:r.top,left:r.left,right:r.right}; })");
        assert.equal(metricBounds[0].top, metricBounds[1].top);
        assert.ok(metricBounds[0].right <= metricBounds[1].left);
        await screenshot(`chat-metrics-${width}x${height}.png`);
        await closeMetrics();
      }
      if (path === "/documents" && width === 390) {
        await evaluate(
          "document.querySelector('.document-list').scrollIntoView({block:'center',behavior:'instant'})",
        );
        await screenshot("documents-list-390x844.png");
      }
    }
  }
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("/");
  await click(".mobile-toggle");
  await waitFor(
    "document.querySelector('.sidebar').classList.contains('open')",
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.sidebar').contains(document.activeElement)",
    ),
  );
  await click(".sidebar-chat-heading .nav");
  await pause(250);
  assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), true);
  assert.equal(await evaluate("document.querySelector('#chat-history').inert"), false);
  await screenshot("chat-history-390x844.png");
  await click(".history-item:first-child");
  assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), false);
  await click(".mobile-toggle");
  await click(".history-toggle");
  await pause(250);
  await evaluate("document.querySelector('.history-toggle').focus()");
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.getAttribute('href')"), "/metrics");
  await evaluate(
    "[...document.querySelectorAll('.sidebar a, .sidebar button:not(:disabled)')].filter(control => !control.closest('[inert]')).at(-1).focus()",
  );
  await key("Tab");
  assert.equal(
    await evaluate("document.activeElement.getAttribute('aria-label')"),
    "Đóng điều hướng",
  );
  await key("Escape");
  await waitFor(
    "!document.querySelector('.sidebar').classList.contains('open')",
  );
  assert.equal(
    await evaluate("document.activeElement.getAttribute('aria-label')"),
    "Mở điều hướng",
  );
  await click('.mobile-toggle');
  await click('.sidebar a[href="/metrics"]');
  await waitFor("location.pathname === '/metrics' && !!document.querySelector('#metrics-conversation')");
  assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), false);
  await navigate('/');
  await setChatMode('no-cache');
  await cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.history-collapse')).transitionDuration"), "0s");
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.welcome')).animationName",
    ),
    "none",
  );

  if (process.argv.includes("--reference")) {
    const referenceRoot = join(frontend, "design-reference");
    referenceServer = createServer(async (request, response) => {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const path = resolve(
        referenceRoot,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (
        !path.startsWith(referenceRoot + "/") &&
        !path.startsWith(referenceRoot + "\\")
      ) {
        response.writeHead(403).end();
        return;
      }
      try {
        let content = await readFile(path, "utf8");
        // The export has a syntax typo. Repair only the preview response; keep the original file intact.
        if (pathname === "/app.js") content = content.replace("$$let", "let");
        response.setHeader(
          "Content-Type",
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
          }[extname(path)] ?? "text/plain",
        );
        response.end(content);
      } catch {
        response.writeHead(404).end();
      }
    });
    referenceServer.listen(0, "127.0.0.1");
    await once(referenceServer, "listening");
    for (const [width, height] of [
      [390, 844],
      [820, 1180],
      [1440, 900],
    ]) {
      await cdp("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const view of ["library", "chat"]) {
        await cdp("Page.navigate", {
          url: `http://127.0.0.1:${referenceServer.address().port}/index.html#${view}`,
        });
        await waitFor(
          `document.readyState === 'complete' && !!document.querySelector('${view === "library" ? ".catalog-item" : ".welcome"}')`,
        );
        await screenshot(`reference-${view}-${width}x${height}.png`);
      }
    }
  }
  assert.deepEqual(errors, [], "Lỗi runtime/React trên trình duyệt");
  console.log(
    "Đạt: ba chế độ Chat, Thông số theo lượt gửi, Số liệu ba tab/dữ liệu mẫu tách phiên/lọc/biểu đồ/chi tiết, giữ phiên/reset, Tài liệu, UI kit, keyboard, 72 bố cục và 27 bố cục dữ liệu mẫu.",
  );
  console.log(`Ảnh kiểm chứng: ${output}`);
} catch (error) {
  await captureFailure?.();
  throw error;
} finally {
  socket?.close();
  referenceServer?.close();
  browser.kill();
}
