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
  await click('.composer button[type="submit"]');
  assert.equal(
    await evaluate(
      "document.querySelector('#prompt').getAttribute('aria-invalid')",
    ),
    "true",
  );
  const unsafeText = '<img src=x onerror="window.injected=true"> Câu hỏi mẫu';
  await fill("#prompt", unsafeText);
  await click('.composer button[type="submit"]');
  await click('.composer button[type="submit"]');
  await waitFor("document.querySelectorAll('.message.assistant').length === 1");
  assert.equal(
    await evaluate("document.querySelectorAll('.message.user').length"),
    1,
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.messages img').length"),
    0,
  );
  assert.equal(await evaluate("window.injected === true"), false);
  await click(".history > button");
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
  await evaluate("document.querySelector('#prompt').focus()");
  await key("Enter");
  await waitFor("document.querySelectorAll('.message.assistant').length === 1");
  await click('.sidebar a[href="/ui"]');
  await waitFor(
    "location.pathname === '/ui' && !!document.querySelector('.catalog-grid')",
  );
  await click('.sidebar a[href="/"]');
  await waitFor(
    "location.pathname === '/' && !!document.querySelector('.welcome')",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.message').length"),
    0,
  );

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
    for (const path of ["/", "/ui"]) {
      await navigate(path);
      await pause(350);
      assert.ok(
        await evaluate("document.documentElement.scrollWidth <= innerWidth"),
        `Tràn ngang: ${path} ${width}x${height}`,
      );
      await screenshot(
        `${path === "/" ? "chat" : "ui"}-${width}x${height}.png`,
      );
    }
  }
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await click(".mobile-toggle");
  await waitFor(
    "document.querySelector('.sidebar').classList.contains('open')",
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.sidebar').contains(document.activeElement)",
    ),
  );
  await evaluate("document.querySelector('.sidebar nav a:last-child').focus()");
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
  await cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.intro')).animationName",
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
    "Đạt: 21 component, lọc/validation, bàn phím, copy, dữ liệu rỗng, hội thoại/XSS, 18 bố cục, drawer và reduced motion.",
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
