import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

// Reads already-created synthetic records. It cannot approve, activate or call a provider.
export async function checkDeployedRule({ cdp, navigate, evaluate, waitFor, click, screenshot }) {
  const filename = process.env.CACHESEC_DEPLOYED_RULE_REPORT;
  assert.match(filename ?? "", /^[a-z0-9][a-z0-9_-]*\.json$/);
  const root = new URL("../../", import.meta.url);
  const report = JSON.parse(await readFile(new URL("backend/.local/" + filename, root), "utf8"));
  assert.equal(report.artifact_digest, process.env.CACHESEC_REVIEW_ARTIFACT);
  assert.equal(report.proposal_id, process.env.CACHESEC_REVIEW_PROPOSAL_ID);
  assert.deepEqual(report.cases.map(value => value.case), ["missing", "valid_date", "iso_week_rejected"]);
  const source = new URL("backend/app/quotation_demo/business/quotation_validation.py", root);
  const original = await readFile(source);
  const observer = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: String.raw`(() => {
    const original = window.fetch.bind(window);
    window.__deployedForbidden = 0;
    window.fetch = async (url, init) => {
      if (init?.method === 'POST' && /\/api\/v1\/(?:agent\/(?:messages|runs)|changes\/workspace\/(?:source|approvals|activations))/.test(String(url))) {
        window.__deployedForbidden++;
        throw new Error('Deployed rule check cannot write, generate, approve or activate');
      }
      const response = await original(url, init);
      if (/\/quotations\/[a-f0-9-]{36}\/validate$/.test(String(url)) && response.ok) {
        window.__deployedValidation = (await response.clone().json()).data;
      }
      return response;
    };
  })()` });
  async function config() {
    return evaluate(`fetch('/api/local-control/api/v1/changes/workspace/config', {
      headers:{'X-CacheSec-Workspace':'1'},credentials:'same-origin',cache:'no-store'
    }).then(async response => {
      if (!response.ok) throw new Error('Cannot read active artifact');
      return (await response.json()).data;
    })`);
  }
  const target = await config();
  assert.equal(target.active_artifact, report.artifact_digest);
  assert.equal(target.target_version, report.target_version);
  assert.equal(target.pending_id, null);
  const observed = [];
  try {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const sample of report.cases) {
      console.log("Checking deployed quotation: " + sample.case);
      assert.match(sample.quotation_id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
      await navigate("/quotations?proposal=" + report.proposal_id + "&quotation=" + sample.quotation_id);
      await waitFor(`document.querySelector('.quotation-details')?.dataset.quotationId === ${JSON.stringify(sample.quotation_id)}`);
      await waitFor("!document.querySelector('#quotation-validate').disabled");
      await click("#quotation-validate");
      await waitFor(`window.__deployedValidation?.quotation_id === ${JSON.stringify(sample.quotation_id)}`);
      const result = await evaluate("window.__deployedValidation");
      assert.equal(result.reference_date, "2026-11-07");
      assert.equal(result.validation_config_ref, "quotation-expiration-v1");
      assert.deepEqual(result.evaluated_rules, ["expiration_review"]);
      assert.deepEqual(result.flags.map(flag => [flag.code, flag.field]),
        sample.expected_flag ? [["expiration_review", "expires_on"]] : []);
      await waitFor(`document.querySelector('[data-quotation-validation]')?.dataset.quotationValidation === ${JSON.stringify(sample.quotation_id)}`);
      assert.equal(await evaluate("document.querySelectorAll('[data-quotation-validation] li').length"), sample.expected_flag ? 1 : 0);
      assert.equal(await evaluate("window.__deployedForbidden"), 0);
      await screenshot("deployed-rule-" + sample.case + ".png");
      observed.push({ case: sample.case, quotation_id: sample.quotation_id, flags: result.flags.map(flag => flag.code) });
    }
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    await screenshot("deployed-rule-mobile.png");
    assert.deepEqual(await config(), target);
    assert.ok((await readFile(source)).equals(original));
    await writeFile(new URL("frontend/test-results/browser/deployed-rule.json", root), JSON.stringify({
      artifact_digest: report.artifact_digest, target_version: report.target_version, observed,
      model_calls: 0, approvals: 0, activations: 0,
    }, null, 2));
    console.log(JSON.stringify({ target_version: target.target_version, deployed_rule_checks: observed }));
  } finally {
    await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observer.identifier });
  }
}
