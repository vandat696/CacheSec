import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";
import { workspaceMetricValues } from "../src/features/metrics/workspaceMetricsModel.ts";
import { checkDeployedRule } from "./deployed-rule-browser-check.mjs";

// Existing local data only: no generation, source write, approval or activation.
export async function checkWorkspaceData(context) {
  const { cdp, navigate, evaluate, waitFor, click, screenshot } = context;
  const local = new URL("../../backend/.local/", import.meta.url);
  const report = JSON.parse(await readFile(new URL("workspace-rule-live-validation-20261116.json", local), "utf8"));
  process.env.CACHESEC_DEPLOYED_RULE_REPORT = "workspace-rule-live-validation-20261116.json";
  process.env.CACHESEC_REVIEW_ARTIFACT = report.artifact_digest;
  process.env.CACHESEC_REVIEW_PROPOSAL_ID = report.proposal_id;
  const observation = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original = window.fetch.bind(window);
    window.__dataMutations = 0;
    window.fetch = async (url, init) => {
      if (init?.method === 'POST' && /\\/api\\/v1\\/(?:agent\\/|changes\\/)/.test(String(url))) {
        window.__dataMutations++; throw new Error('Data smoke cannot mutate workflow');
      }
      const response = await original(url, init);
      if (window.__testRuntimeChange && response.ok && String(url).endsWith('/changes/workspace/config')) {
        const body = await response.clone().json();
        body.data.target_version++;
        return new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}});
      }
      if (response.ok && /\\/comparisons\\/[a-f0-9-]{36}$/.test(String(url)))
        window.__metricsPair = (await response.clone().json()).data;
      return response;
    };
  })()` });
  try {
    const store = new LocalSessionStore(fileURLToPath(local));
    await navigate("/workspace#local-launch=" + await store.issueLaunch());
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await checkDeployedRule(context);
    await waitFor("document.querySelector('.quotation-runtime-status')?.textContent.includes('Bản triển khai 1')");
    // Labeled config-response double only: no deployment is performed.
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate("window.__testRuntimeChange = true");
    await click('.sidebar a[href="/workspace"]');
    await click('.sidebar a[href="/quotations"]');
    await waitFor("document.querySelector('.quotation-runtime-status')?.textContent.includes('Bản triển khai 2') && !document.querySelector('[data-quotation-validation]')");
    await evaluate("window.__testRuntimeChange = false");
    await navigate("/metrics");
    await waitFor("!!document.querySelector('[data-metrics-source=workspace] [data-pair-id]') && !!window.__metricsPair");
    const pair = await evaluate("window.__metricsPair");
    const actual = await evaluate("[...document.querySelectorAll('[data-pair-id] tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))");
    assert.deepEqual(actual, workspaceMetricValues(pair.branches.none).map((value, index) => [value, workspaceMetricValues(pair.branches.local)[index]]));
    const other = await evaluate("[...document.querySelector('#metrics-workspace-session').options].map(option => option.value).find(value => value !== window.__metricsPair.pair_id)");
    if (other) {
      await evaluate(`(() => { const select=document.querySelector('#metrics-workspace-session'); select.value=${JSON.stringify(other)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      await waitFor(`document.querySelector('[data-pair-id]')?.dataset.pairId === ${JSON.stringify(other)}`);
    }
    for (const width of [390, 820, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
      await screenshot(`workspace-metrics-${width}.png`);
    }
    // Labeled HTTP denial injection: the live page must clear previously read data.
    await evaluate(`(() => {
      const original = window.fetch;
      window.fetch = (url, init) => String(url).includes('/agent/comparisons')
        ? Promise.resolve(new Response(JSON.stringify({error:{code:'FORBIDDEN'}}), {status:403})) : original(url, init);
    })()`);
    await click('.metrics-workspace button');
    await waitFor("!!document.querySelector('.metrics-workspace [role=alert]') && !document.querySelector('[data-pair-id]')");
    assert.equal(await evaluate("window.__dataMutations"), 0);
    console.log("Đạt: Báo giá/artifact thật, số liệu khớp lịch sử PostgreSQL, ba bố cục và xóa số liệu khi bị từ chối; không generation/approve/activate.");
  } finally { await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observation.identifier }); }
}
