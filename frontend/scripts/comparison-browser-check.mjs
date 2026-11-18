import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { visibleEditorText } from "./editor-browser-actions.mjs";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";

const chatTab = index => `.comparison-chat-tabs [role=tab]:nth-of-type(${index})`;
const selectedChat = ".comparison-chat-tabs [role=tabpanel]:not([hidden])";
const selectedAnswer = `document.querySelector(${JSON.stringify(`${selectedChat} .dev-message.assistant`)})?.textContent`;

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
    assert.equal(await evaluate("document.querySelector('#agent-comparison-toggle')?.getAttribute('aria-pressed')"), "true");
    await waitFor("!document.querySelector('#workspace-editor')?.hidden && !!document.querySelector('#workspace-editor .cm-content')", "source editor visible by default");
    assert.equal(await evaluate("!!document.querySelector('#workspace-agent .dev-agent-navbar #agent-session-toggle')"), true);
    assert.equal(await evaluate("!!document.querySelector('.dev-ide-toolbar #agent-session-toggle')"), false);
    assert.equal(await evaluate("document.querySelector('.agent-options')?.open"), false);
    assert.deepEqual(await evaluate("[...document.querySelector('.agent-options select').options].map(option => option.value)"),
      ["gemini-3.5-flash-lite", "gemini-4-hydrogen", "gemini-3.8-flash"]);
  };
  const discardDraft = async () => {
    if (await evaluate("!!document.querySelector('dialog[open][aria-labelledby=unsaved-title]')")) {
      await click("dialog[open][aria-labelledby=unsaved-title] button:nth-of-type(2)");
    }
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
  const checkReview = async () => {
    await waitFor("document.querySelectorAll('.workspace-comparison-results .comparison-code').length === 2", "both code diffs available below Workspace");
    const displayed = await evaluate(String.raw`(() => {
      const review = document.querySelector('.workspace-comparison-results .comparison-review');
      return [...review.querySelectorAll('.comparison-review-branch')].map(branch => ({
        added: [...branch.querySelectorAll('[data-kind="added"] code')].map(code => code.textContent),
        removed: [...branch.querySelectorAll('[data-kind="removed"] code')].map(code => code.textContent),
        path: review.querySelector('.comparison-file').textContent,
        markers: [...branch.querySelectorAll('tr:is([data-kind="added"], [data-kind="removed"]) .comparison-code-sign')].map(cell => cell.textContent),
      }));
    })()`);
    const expected = await evaluate("['none', 'local'].map(mode => window.__comparisonPair.branches[mode].revisions.at(-1))");
    for (const [index, revision] of expected.entries()) {
      const lines = revision.diff.replaceAll("\r\n", "\n").split("\n").slice(2);
      assert.deepEqual(displayed[index], {
        added: lines.filter(line => line.startsWith("+")).map(line => line.slice(1)),
        removed: lines.filter(line => line.startsWith("-")).map(line => line.slice(1)),
        path: revision.path,
        markers: lines.filter(line => line.startsWith("+") || line.startsWith("-")).map(line => line.startsWith("+") ? "+" : "−"),
      });
    }
    assert.equal(await evaluate(`[...document.querySelectorAll('.comparison-review-branch')].every(branch =>
      branch.querySelector('.comparison-editor-file code')?.textContent === 'quotation_validation.py'
      && branch.querySelector('.comparison-code tbody tr[data-kind="context"] td')?.textContent === '1')`), true);
    return expected;
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
    for (const [index, mode] of [[1, "none"], [2, "local"]]) {
      await click(chatTab(index));
      assert.equal(await evaluate(selectedAnswer), warm.branches[mode].run.answer);
    }
    await screenshot("comparison-agent-replies.png");
    await screenshot("comparison-live-desktop.png");
    const reviewed = await checkReview();
    assert.equal(await evaluate(`(() => {
      const [first, second] = document.querySelectorAll('.comparison-review-branch');
      const a = first.getBoundingClientRect(), b = second.getBoundingClientRect();
      const workspace = document.querySelector('.dev-workbench').getBoundingClientRect();
      return b.left > a.left && b.top === a.top && a.top >= workspace.bottom
        && a.left <= workspace.left + 2 && b.right >= workspace.right - 2
        && !!first.querySelector('.tok-keyword') && !!second.querySelector('.tok-keyword');
    })()`), true);
    await evaluate("document.querySelector('#workspace-comparison').scrollIntoView({ behavior: 'instant' })");
    await waitFor("window.scrollY > 0 && document.querySelector('#workspace-comparison').getBoundingClientRect().top < innerHeight / 2", "page scrolls to code");
    await click(".comparison-review-branch:first-child .comparison-first-change");
    await waitFor("document.querySelector('.comparison-review-branch:first-child .comparison-code-scroll').scrollTop > 0", "first edit is in view");
    await click(".comparison-review-branch:last-child .comparison-first-change");
    await screenshot("comparison-review-desktop.png");
    for (const [value, part] of [["base", "base_text"], ["candidate", "content"]]) {
      await evaluate(`(() => {
        const branch = document.querySelector('.comparison-review-branch');
        const select = branch.querySelector('.comparison-diff-toolbar select');
        select.value = ${JSON.stringify(value)};
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await waitFor("!!document.querySelector('.comparison-review-branch pre code')");
      assert.equal(await evaluate("document.querySelector('.comparison-review-branch pre code').textContent"), reviewed[0][part].replace(/\r\n?/g, "\n"));
    }
    assert.equal(await evaluate("window.__comparisonStarts"), resume ? 0 : 4);
    await navigate("/workspace?comparison=" + warm.pair_id); await connect();
    await waitFor("document.querySelectorAll('.comparison-branch-details details').length > 0", "durable history restored");
    assert.equal(await evaluate("window.__comparisonStarts"), 0);
    const stored = await evaluate("window.__comparisonPair"); assert.equal(stored.pair_id, warm.pair_id);
    assert.deepEqual(stored.branches.local.revisions.map(r => r.artifact_digest), warm.branches.local.revisions.map(r => r.artifact_digest));
    if (process.argv.includes("--comparison-approved")) {
      const revision = stored.branches.local.revisions.at(-1);
      const base = await readFile(resolve(root, "baseline", revision.path), "utf8");
      assert.equal(revision.base_text, base);
      await checkReview();
      await click(".comparison-review-branch:last-child > button");
      await waitFor("!document.querySelector('#workspace-editor')?.hidden", "editor opens from a result");
      await waitFor("!!document.querySelector('#change-restore-base:not(:disabled)')", "baseline restore available");
      await click("#change-restore-base");
      await discardDraft();
      await waitFor("document.querySelector('#change-restore-base')?.disabled", "baseline loaded into editor");
      const normalized = base.replace(/\r\n?/g, "\n").trimEnd();
      assert.ok(normalized.startsWith((await evaluate(visibleEditorText)).trimEnd()));
      await evaluate("const scroller = document.querySelector('.source-editor:not([hidden]) .cm-scroller'); scroller.scrollTop = scroller.scrollHeight;");
      await waitFor(`${visibleEditorText}.includes('evaluated_rules=(),')`, "end of baseline shown");
      assert.ok(normalized.endsWith((await evaluate(visibleEditorText)).trimEnd()));
      assert.equal(await evaluate("document.querySelector('#workspace-run')?.disabled"), true);
      assert.equal(await evaluate("window.__comparisonForbidden"), 0);
    }
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await screenshot("comparison-live-mobile.png");
    await checkReview();
    assert.equal(await evaluate(`(() => {
      const [first, second] = document.querySelectorAll('.comparison-review-branch');
      const panel = document.querySelector('.workspace-comparison-results');
      return second.getBoundingClientRect().top > first.getBoundingClientRect().top && panel.scrollWidth <= panel.clientWidth;
    })()`), true);
    await evaluate("document.querySelector('.comparison-review').scrollIntoView({ block: 'start', behavior: 'instant' })");
    await screenshot("comparison-review-mobile.png");
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
      assert.match(deployed.quotation_id, /^[a-f0-9-]{36}$/i);
      const { stdout } = await promisify(execFile)(resolve("../backend/.venv/Scripts/python.exe"), [
        resolve("../scripts/check_comparison_baseline.py"), root, deployed.quotation_id,
      ], { windowsHide: true, timeout: 30000 });
      const before = JSON.parse(stdout);
      assert.equal(before.quotation_id, deployed.quotation_id);
      assert.equal(before.expires_on, null);
      assert.deepEqual(before.flags, []);
      await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await click("#repository-disconnect");
      await discardDraft();
      await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'false'");
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
      console.log(`Same quotation ${deployed.quotation_id}: disposable baseline = 0 flags, approved 18001 = 1 expiration_review flag.`);
      await screenshot("comparison-approved-app.png");
      assert.equal(await evaluate("window.__comparisonStarts"), 0); assert.equal(await evaluate("window.__comparisonForbidden"), 0);
    }
    console.log(resume ? "Durable history verified without generation/test/approval/activation." : "Real cold/warm comparison verified; candidates await human review.");
  } finally { await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observation.identifier }); }
}

export async function checkComparisonLayout({ cdp, navigate, evaluate, waitFor, click, fill, key, screenshot }) {
  const pairId = process.env.CACHESEC_COMPARISON_PAIR_ID;
  assert.match(pairId ?? "", /^[a-f0-9-]{36}$/i);
  const store = new LocalSessionStore(resolve("../backend/.local"));
  await navigate("/workspace#local-launch=" + await store.issueLaunch());
  await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
  const clock = "#agent-session-toggle";
  const session = `#comparison-sessions [data-pair-id=${JSON.stringify(pairId)}]`;
  const composer = '#workspace-agent textarea[aria-label="Yêu cầu chung cho hai nhánh"]';
  await waitFor("!!document.querySelector('#agent-session-toggle:not(:disabled)')");
  await evaluate(`(() => {
    const fetch = window.fetch.bind(window);
    window.__sessionMutations = 0;
    window.fetch = (url, init) => {
      if (init?.method === 'POST' && String(url).includes('/api/v1/agent/comparisons')) window.__sessionMutations++;
      return fetch(url, init);
    };
  })()`);
  const chatHasSettings = "!!document.querySelector('#workspace-agent :is(.dev-messages, .dev-composer) :is(select, details, .comparison-review-branch)')";
  assert.equal(await evaluate("!!document.querySelector('.dev-ide-toolbar :is(#agent-session-toggle, .agent-options, #agent-comparison-toggle)')"), false);
  assert.equal(await evaluate("!!document.querySelector('.dev-agent-navbar a[href$=workspace-comparison]')"), false);
  assert.equal(await evaluate(chatHasSettings), false);
  const initialStatuses = await evaluate("[...document.querySelectorAll('#workspace-comparison .comparison-test-state')].map(element => element.textContent.trim())");
  assert.deepEqual(initialStatuses, ["Chưa chạy", "Chưa chạy"]);
  const modelPicker = "#workspace-agent .agent-options select:first-child";
  await click("#workspace-agent .agent-options summary");
  await waitFor(`document.querySelector(${JSON.stringify(modelPicker)})?.options.length === 3`);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(modelPicker)}).value`), "gemini-3.5-flash-lite");
  await evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(modelPicker)});
    select.value = 'gemini-4-hydrogen';
    select.dispatchEvent(new Event('change', {bubbles: true}));
  })()`);
  await waitFor("document.querySelector('.agent-options summary').title.includes('Gemini 4 Hydrogen')");
  await screenshot("comparison-model-picker.png");
  await click(clock);
  await waitFor(`!!document.querySelector(${JSON.stringify(session)})`, "saved sessions appear");
  assert.equal(await evaluate("document.querySelector('.comparison-conversation').hidden"), true);
  await screenshot("comparison-session-picker.png");
  await click(session);
  await waitFor("document.querySelector('#workspace-comparison [data-mode=local] [role=alert]')?.textContent === 'MODEL_UNAVAILABLE'");
  assert.equal(await evaluate("document.querySelector('.comparison-review-model').textContent"), "gemini-3.5-flash-lite");
  assert.equal(await evaluate(chatHasSettings), false);
  assert.equal(await evaluate("document.querySelector('#workspace-agent').innerText.includes('MODEL_UNAVAILABLE')"), false);
  assert.equal(await evaluate("document.querySelector('#workspace-comparison [data-mode=none] [role=status]').textContent.trim()"), "Test đạt");
  assert.equal(await evaluate("document.querySelector('#workspace-comparison [data-mode=local]').innerText.includes('Verified Hit')"), true);
  await waitFor("!document.querySelector('#comparison-sessions')");
  await waitFor(`!document.querySelector(${JSON.stringify(composer)})?.disabled`);
  await fill(composer, "Draft kept when browsing history");
  assert.ok(await evaluate(selectedAnswer), "default tab shows the successful branch's real answer");
  await click(chatTab(2));
  assert.equal(await evaluate(selectedAnswer), undefined);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(`${selectedChat} .comparison-chat-status`)})?.textContent`),
    "Nhánh gặp lỗi trước khi trả lời.");
  await key("ArrowLeft");
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-selected')"), "true");
  assert.ok(await evaluate(selectedAnswer), "arrow key returns to the first branch's reply");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(composer)}).value`), "Draft kept when browsing history");
  await click(clock);
  await key("Escape");
  assert.equal(await evaluate("document.activeElement.id"), "agent-session-toggle");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(composer)}).value`), "Draft kept when browsing history");
  await click(clock);
  await click("#comparison-new-session");
  await waitFor("!document.querySelector('#comparison-sessions') && !new URLSearchParams(location.search).has('comparison')");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(composer)}).value`), "");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('#workspace-comparison .comparison-test-state')].map(element => element.textContent.trim())"), initialStatuses);
  await click(clock);
  await waitFor(`!!document.querySelector(${JSON.stringify(session)})`, "previous session kept");
  await click(session);
  await waitFor("document.querySelector('#workspace-comparison [data-mode=local] [role=alert]')?.textContent === 'MODEL_UNAVAILABLE'");
  assert.equal(await evaluate("window.__sessionMutations"), 0);
  await screenshot("comparison-chat-clean.png");
  await evaluate("document.querySelector('#workspace-comparison').scrollIntoView({ behavior: 'instant' })");
  await waitFor("window.scrollY > 0");
  await screenshot("comparison-partial-result.png");
  const observeTurns = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      const response = await fetch(url, init);
      if (!response.ok || !String(url).endsWith(${JSON.stringify(`/comparisons/${pairId}/turns`)})) return response;
      const value = await response.json();
      value.data.turns.push({
        pair_id: '4e77f773-d4ac-43b6-ac1c-2457bfa18db4', prompt: 'Saved follow-up (test fixture)',
        branches: { none: { status: 'needs_input', answer: 'Without cache follow-up' },
          local: { status: 'needs_input', answer: 'With cache follow-up' } },
      });
      return Response.json(value, { status: response.status });
    };
  })()` });
  await navigate(`/workspace?comparison=${pairId}`);
  const prompts = `[...document.querySelectorAll(${JSON.stringify(`${selectedChat} .dev-message.developer`)})].map(node => node.textContent)`;
  await waitFor(`${prompts}.length === 2`, "earlier and later prompts appear after reopening a conversation");
  const originalPrompts = await evaluate(prompts);
  assert.equal(originalPrompts[1], "Saved follow-up (test fixture)");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(`${selectedChat} .dev-message.assistant:last-of-type`)})?.textContent`), "Without cache follow-up");
  await click(chatTab(2));
  assert.deepEqual(await evaluate(prompts), originalPrompts);
  assert.equal(await evaluate(selectedAnswer), "With cache follow-up");
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: observeTurns.identifier });
}
