import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// Live opt-in: real browser IndexedDB, HTTP, Gemini, PostgreSQL and Docker.
// Uses only the isolated demo. Never writes source, approves or activates.
export async function checkComparisons({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
  const root = resolve(process.env.CACHESEC_COMPARISON_DEMO_ROOT ?? "../backend/.local/comparison-demo-20261118");
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  assert.ok(["ready-awaiting-human-approval", "active-human-approved"].includes(manifest.status));
  const access = JSON.parse(await readFile(resolve(root, "access.json"), "utf8"));
  const resume = process.env.CACHESEC_COMPARISON_PAIR_ID;
  if (manifest.status === "active-human-approved") assert.ok(resume, "Use history-only mode after activation; prepare a new isolated baseline for another live task.");
  if (resume) assert.match(resume, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  const before = await Promise.all(manifest.source_paths.map(path => readFile(resolve(root, "project", path))));
  const hashes = before.map(value => createHash("sha256").update(value).digest("hex"));
  const observation = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: String.raw`(() => {
    const original=window.fetch.bind(window); window.__comparisonStarts=0; window.__comparisonForbidden=0;
    window.fetch=async (url,init) => {
      const path=String(url);
      if(init?.method==='POST' && /\/comparisons\/[a-f0-9-]{36}\/(?:none|local)$/.test(path)) window.__comparisonStarts++;
      if(init?.method==='POST' && /\/workspace\/(?:source|approvals|activations)$/.test(path)) window.__comparisonForbidden++;
      const response=await original(url,init);
      if(response.ok && /\/comparisons\/[a-f0-9-]{36}$/.test(path) && (!init?.method || init.method==='GET'))
        window.__comparisonPair=(await response.clone().json()).data;
      if(response.ok && init?.method==='POST' && path.endsWith('/validate')) window.__comparisonValidation=(await response.clone().json()).data;
      return response;
    };
  })()` });
  const connect = async () => {
    await waitFor("!!document.querySelector('.repository-manual-connection')");
    await click(".repository-manual-connection > summary"); await fill("#repository-token", access.control_token);
    await click('.repository-connection button[type="submit"]');
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await waitFor("document.querySelector('.dev-assistant')?.dataset.agentReady === 'true'");
    await click("#agent-comparison-toggle");
  };
  const run = async (prompt, state) => {
    const previous = await evaluate("window.__comparisonPair?.pair_id ?? null");
    await evaluate(`(() => { const e=document.querySelector('[aria-label="Điều kiện cache"]'); e.value=${JSON.stringify(state)}; e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await fill('[aria-label="Yêu cầu chung cho hai nhánh"]', prompt);
    await click('.comparison-composer button[type="submit"]');
    await waitFor(`!!window.__comparisonPair?.pair_id && window.__comparisonPair.pair_id!==${JSON.stringify(previous)}`, "comparison accepted", 600);
    console.log("Live comparison accepted: " + await evaluate("window.__comparisonPair.pair_id"));
    await waitFor("!!window.__comparisonPair && Object.values(window.__comparisonPair.branches).every(b=>['passed','needs_input','exhausted','cancelled','timed_out','error','incomplete'].includes(b.status))", "both real branches terminal", 7400);
    const pair = await evaluate("window.__comparisonPair");
    console.log(JSON.stringify({ pair_id: pair.pair_id, branches: Object.fromEntries(Object.entries(pair.branches).map(([mode, b]) => [mode, { status: b.status, error_code: b.run?.error_code ?? b.error_code, cache: b.context?.outcome, revision: b.run?.revision }])) }));
    assert.equal(pair.branches.none.status, "passed"); assert.equal(pair.branches.local.status, "passed");
    assert.notEqual(pair.branches.none.run.proposal_id, pair.branches.local.run.proposal_id);
    return pair;
  };
  try {
    await navigate("/workspace" + (resume ? "?comparison=" + resume : "")); await connect();
    const details = " Chỉ sửa quotation_validation.py. Giữ dataclass và signature hiện có. expires_on hợp lệ khi đúng chuỗi ASCII YYYY-MM-DD, ngày tồn tại và >= reference_date. Không trim, không ép kiểu, không nhận timestamp/ISO tuần. Missing/null/rỗng/sai kiểu/định dạng/ngày không tồn tại hoặc trước reference_date phải có đúng một flag code expiration_review, field expires_on; ngày hợp lệ không có flag. evaluated_rules chứa expiration_review và giữ reference_date. Nếu reference_date=None thì báo lỗi rõ ràng. Trả toàn bộ file; không sửa test, policy hoặc file khác. Test là kỹ thuật, không tuyên bố acceptance nghiên cứu.";
    const saved = resume ? JSON.parse(await readFile(resolve(root, "comparison-results.json"), "utf8")) : null;
    if (resume) await waitFor("!!window.__comparisonPair?.pair_id", "history-only restore");
    const cold = saved?.cold ?? await run("Bổ sung quy tắc đánh dấu báo giá thiếu ngày hết hạn hợp lệ." + details, "cold");
    assert.equal(cold.branches.none.context.outcome, "not_applicable"); assert.equal(cold.branches.local.context.outcome, "miss");
    const warm = resume ? await evaluate("window.__comparisonPair") : await run("Thêm cờ xem xét cho báo giá không có ngày hết hạn hợp lệ." + details, "warm");
    assert.equal(warm.branches.local.context.outcome, "hit"); assert.equal(warm.branches.local.context.decisions.at(-1).kind, "semantic");
    assert.equal(await evaluate("window.__comparisonForbidden"), 0);
    await screenshot("comparison-live-desktop.png");
    assert.equal(await evaluate("window.__comparisonStarts"), resume ? 0 : 4);
    await navigate("/workspace?comparison=" + warm.pair_id); await connect();
    await waitFor("document.querySelectorAll('.comparison-branch details').length > 0", "durable history restored");
    assert.equal(await evaluate("window.__comparisonStarts"), 0);
    const stored = await evaluate("window.__comparisonPair"); assert.equal(stored.pair_id, warm.pair_id);
    assert.deepEqual(stored.branches.local.revisions.map(r => r.artifact_digest), warm.branches.local.revisions.map(r => r.artifact_digest));
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await screenshot("comparison-live-mobile.png");
    const after = await Promise.all(manifest.source_paths.map(path => readFile(resolve(root, "project", path))));
    assert.deepEqual(after.map(value => createHash("sha256").update(value).digest("hex")), hashes);
    if (!resume) await writeFile(resolve(root, "comparison-results.json"), JSON.stringify({ cold, warm }, null, 2));
    let review = "# Bản sửa demo chờ human approval\n\nKiểm chứng kỹ thuật; chưa acceptance nghiên cứu. Không source write, approve hoặc activate.\n\n";
    for (const [mode, branch] of Object.entries(warm.branches)) {
      const r = branch.revisions.at(-1), job = r.tests.find(t => t.status === "passed" && t.artifact_digest === r.artifact_digest);
      assert.ok(job?.evidence_digest);
      review += `## ${mode}\n\nProposal: ${r.proposal_id}\n\nRevision: ${r.revision}\n\nArtifact: ${r.artifact_digest}\n\nEvidence: ${job.evidence_digest}\n\n\`\`\`diff\n${r.diff}\n\`\`\`\n\n`;
    }
    if (!resume) await writeFile(resolve(root, "review.md"), review);
    if (process.argv.includes("--comparison-approved")) {
      const deployed = JSON.parse(await readFile(resolve(root, "live-approved-result.json"), "utf8"));
      await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await navigate("/quotations?quotation=" + deployed.quotation_id);
      await waitFor("!!document.querySelector('.quotation-manual-connection') && !document.querySelector('#quotation-token').disabled");
      await click(".quotation-manual-connection > summary"); await fill("#quotation-token", access.quotation_token);
      await click('.quotation-connection button[type="submit"]');
      await waitFor("document.querySelector('.quotation-workspace')?.dataset.connected === 'true'");
      await waitFor("!!document.querySelector('#quotation-validate')"); await click("#quotation-validate");
      await waitFor("!!window.__comparisonValidation && document.querySelectorAll('.quotation-validation li').length === 1");
      const validation = await evaluate("window.__comparisonValidation");
      assert.equal(validation.quotation_id, deployed.quotation_id);
      assert.equal(validation.flags[0].code, "expiration_review"); assert.equal(validation.flags[0].field, "expires_on");
      await screenshot("comparison-approved-app.png");
      assert.equal(await evaluate("window.__comparisonStarts"), 0); assert.equal(await evaluate("window.__comparisonForbidden"), 0);
    }
    console.log(resume ? "Durable history verified without generation/test/approval/activation." : "Real cold/warm comparison verified; candidates await human review.");
  } finally { await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observation.identifier }); }
}
