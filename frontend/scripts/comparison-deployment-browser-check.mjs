import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { passedDeploymentTest } from "../src/features/code-changes/deploymentSelection.ts";

// Read existing pairs; open and cancel human review. Never approve or activate.
export async function checkComparisonDeployment({ cdp, navigate, evaluate, waitFor, click, screenshot }) {
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local/", import.meta.url)));
  const { token } = await store.credential();
  const read = async path => {
    const response = await fetch("http://127.0.0.1:8000/api/v1/" + path, {
      headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(5000), redirect: "error",
    });
    assert.ok(response.ok); return (await response.json()).data;
  };
  const before = await read("changes/workspace/config");
  const sessions = await read("agent/comparisons");
  let pair;
  for (const summary of sessions) {
    const candidate = await read("agent/comparisons/" + summary.pair_id);
    if (["none", "local"].every(mode => {
      const revision = candidate.branches[mode].revisions?.at(-1);
      return revision && passedDeploymentTest(revision, revision.tests);
    })) { pair = candidate; break; }
  }
  assert.ok(pair, "Need an existing pair with two tested revisions; no generation is started by this smoke.");
  const observation = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const fetch = window.fetch.bind(window); window.__deploymentMutations = 0;
    window.fetch = (url, init) => {
      if (init?.method === 'POST' && /\\/api\\/v1\\/(?:agent|changes)\\//.test(String(url))) {
        window.__deploymentMutations++; throw new Error('Review-only smoke cannot mutate workflow');
      }
      return fetch(url, init);
    };
  })()` });
  try {
    await navigate(`/workspace?comparison=${pair.pair_id}#local-launch=${await store.issueLaunch()}`);
    await waitFor("!!document.querySelector('[data-select-deployment=none]:not(:disabled)')");
    for (const [mode, label] of [["none", "Không cache"], ["local", "Có Context Cache"]]) {
      const revision = pair.branches[mode].revisions.at(-1);
      await click(`[data-select-deployment=${mode}]`);
      await waitFor("!!document.querySelector('.comparison-deployment #comparison-run:not(:disabled)')");
      assert.ok(await evaluate(`document.querySelector('.comparison-deployment').textContent.includes(${JSON.stringify(label)})`));
      await click('.comparison-deployment #comparison-run');
      await waitFor("!!document.querySelector('.comparison-deployment dialog[open]')");
      const dialog = ".comparison-deployment dialog[open]";
      assert.equal(await evaluate(`document.querySelector('${dialog} [data-review-source]').textContent`), `${label} · Bản ${revision.revision}`);
      assert.equal(await evaluate(`document.querySelector('${dialog} pre code').textContent`), revision.diff || "Không đổi source so với snapshot gốc.");
      assert.equal(await evaluate(`document.querySelector('${dialog} details code').textContent`), revision.artifact_digest);
      assert.equal(await evaluate("[...document.querySelectorAll('[data-select-deployment]')].every(button=>button.disabled)"), true);
      await screenshot(`comparison-deployment-${mode}.png`);
      await click(`${dialog} button:first-of-type`);
      await waitFor("!document.querySelector('.comparison-deployment dialog[open]') && !document.querySelector('[data-select-deployment=local]').disabled");
    }
    assert.equal(await evaluate("window.__deploymentMutations"), 0);
    assert.deepEqual(await read("changes/workspace/config"), before);
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    await screenshot("comparison-deployment-mobile.png");
    console.log("Đạt: chọn Không cache/Context Cache, đúng diff/artifact trong gate, khóa đổi nhánh khi review, Hủy không tạo approval/activation.");
  } finally { await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observation.identifier }); }
}
