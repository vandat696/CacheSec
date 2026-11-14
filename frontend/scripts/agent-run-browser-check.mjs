import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";

// All Agent run/config endpoints here are marked transport doubles. No model or test executor is called.
export async function checkAgentRuns({ cdp, navigate, evaluate, waitFor, click, fill, key, screenshot }) {
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local", import.meta.url)));
  const injection = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original = window.fetch.bind(window);
    const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hash='sha256:'+'a'.repeat(64);
    const meta={request_id:id,contract_version:'v0.2',identity_mode:'fixture'};
    window.__agentRunMode='complete'; window.__agentRunPolls=0; window.__agentRunRequests=[];
    window.fetch=async (url,init={}) => {
      const path=String(url);
      if(path.endsWith('/api/v1/agent/config')) return Response.json({meta,data:{model:'gemini-3.5-flash-lite',configured:true,mode:'assisted',
        automation:{can_start:true,max_turns:3,deadline_seconds:600,persistence:'process',active_run_id:null}}});
      if(path.endsWith('/api/v1/agent/runs')) {
        const body=JSON.parse(init.body); window.__agentRunRequests.push({body,key:init.headers['Idempotency-Key']});
        const repository=(await (await original('/api/local-control/api/v1/repository',
          {headers:{'X-CacheSec-Workspace':'1'},credentials:'same-origin'})).json()).data;
        window.__agentRunPolls=0;
        window.__agentRun={run_id:id,snapshot_id:body.snapshot_id,tenant_id:repository.tenant_id,repo_id:repository.repo_id,
          status:'queued',turn:0,max_turns:3,deadline_seconds:600,model:'gemini-3.5-flash-lite',created_at:'test-only timestamp',
          answer:'Test-only automation double',error_code:null,proposal_id:null,revision:null,artifact_digest:null,
          test_job_id:null,test_status:null,test_may_continue:false,events:[]};
        return Response.json({meta,data:window.__agentRun},{status:202});
      }
      if(path.endsWith('/api/v1/agent/runs/'+id+'/cancel')) {
        Object.assign(window.__agentRun,{status:'cancelled',test_may_continue:true});
        return Response.json({meta,data:window.__agentRun});
      }
      if(path.endsWith('/api/v1/agent/runs/'+id)) {
        if(window.__failRunRead) {
          window.__failRunRead=false;
          return Response.json({meta,error:{code:'MODEL_UNAVAILABLE'}},{status:503});
        }
        const run=window.__agentRun;
        if(run.status!=='cancelled') {
          window.__agentRunPolls++;
          Object.assign(run,{status:'testing',turn:1,proposal_id:id,revision:1,artifact_digest:hash,test_job_id:id,test_status:'running'});
          if(window.__agentRunMode==='complete' && window.__agentRunPolls>=3) Object.assign(run,{status:'passed',test_status:'passed',
            events:[{sequence:1,at:'test-only timestamp',turn:1,tool:'test',state:'passed',job_id:id,evidence_digest:hash}]});
        }
        return Response.json({meta,data:run});
      }
      return original(url,init);
    };
  })()` });
  try {
    await navigate("/workspace#local-launch=" + await store.issueLaunch());
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await waitFor("!document.querySelector('.agent-run-option input')?.disabled");
    await click(".agent-run-option input");
    assert.ok(await evaluate("document.querySelector('.dev-composer').innerText.includes('3 tệp source')"));
    await fill("#agent-prompt", "Test-only automation UI check");
    await click('.dev-composer button[type="submit"]');
    await waitFor("document.querySelector('.agent-run')?.dataset.status === 'passed'", "test-only run completion");
    assert.ok(await evaluate("document.querySelector('.agent-run').innerText.includes('Test kỹ thuật đạt')"));
    assert.ok(await evaluate("window.__agentRunRequests[0].body.provider_consent === true"));
    await evaluate("window.__agentRunMode='waiting'");
    await fill("#agent-prompt", "Test-only cancellation UI check");
    await click('.dev-composer button[type="submit"]');
    await waitFor("document.querySelector('.agent-run')?.dataset.status === 'testing'");
    await evaluate("window.__failRunRead=true");
    await waitFor("document.querySelector('.agent-run')?.innerText.includes('Tải lại tiến trình')");
    assert.equal(await evaluate("document.querySelectorAll('.dev-assistant [role=alert]').length"), 1);
    await click(".agent-run > button:last-of-type");
    await waitFor("!document.querySelector('.agent-run')?.innerText.includes('Tải lại tiến trình')");
    assert.equal(await evaluate("document.querySelectorAll('.dev-assistant [role=alert]').length"), 0);
    const stop = ".agent-run button";
    await click(stop);
    await waitFor("document.querySelector('.agent-run')?.dataset.status === 'cancelled'");
    assert.ok(await evaluate("document.querySelector('.agent-run').innerText.includes('Job Docker đã nhận')"));
    await waitFor("!!document.querySelector('.pane-resize-repository-console')");
    const editorText = await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').textContent");
    for (const [id, dimension, dx, dy, delta] of [
      ['repository-explorer', 'width', 40, 0, 40],
      ['workspace-agent', 'width', -40, 0, 40],
      ['repository-console', 'height', 0, -40, 40],
    ]) {
      const selector = `.pane-resize-${id}`;
      const size = () => evaluate(`document.getElementById('${id}').getBoundingClientRect().${dimension}`);
      const before = await size();
      const point = await evaluate(`(() => { const r=document.querySelector('${selector}').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await cdp('Input.dispatchMouseEvent', {type:'mouseMoved', ...point});
      await cdp('Input.dispatchMouseEvent', {type:'mousePressed', ...point, button:'left', clickCount:1});
      await cdp('Input.dispatchMouseEvent', {type:'mouseMoved', x:point.x+dx, y:point.y+dy, button:'left', buttons:1});
      await cdp('Input.dispatchMouseEvent', {type:'mouseReleased', x:point.x+dx, y:point.y+dy, button:'left', clickCount:1});
      await waitFor(`document.querySelector('${selector}').dataset.dragging === 'false'`);
      assert.ok(Math.abs(await size()-before-delta)<3, `${id} responds to pointer drag`);
      await key('Home');
      await waitFor(`Math.abs(document.getElementById('${id}').getBoundingClientRect().${dimension}-Number(document.querySelector('${selector}').getAttribute('aria-valuemin')))<2`);
      await key('End');
      await waitFor(`Math.abs(document.getElementById('${id}').getBoundingClientRect().${dimension}-Number(document.querySelector('${selector}').getAttribute('aria-valuemax')))<2`);
      await key('Enter');
      const reset = await size();
      await key(dimension === 'height' ? 'ArrowUp' : id === 'workspace-agent' ? 'ArrowLeft' : 'ArrowRight');
      await waitFor(`document.getElementById('${id}').getBoundingClientRect().${dimension}>${reset+5}`);
      const resetPoint = await evaluate(`(() => { const r=document.querySelector('${selector}').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      for (const clickCount of [1, 2]) {
        await cdp('Input.dispatchMouseEvent', {type:'mousePressed', ...resetPoint, button:'left', clickCount});
        await cdp('Input.dispatchMouseEvent', {type:'mouseReleased', ...resetPoint, button:'left', clickCount});
      }
      await waitFor(`Math.abs(document.getElementById('${id}').getBoundingClientRect().${dimension}-${reset})<2`);
    }
    assert.equal(await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').textContent"), editorText);
    await screenshot('workspace-resizable-1440.png');
    await click('#workspace-agent-toggle');
    assert.equal(await evaluate("document.querySelector('.pane-resize-workspace-agent').getClientRects().length"), 0);
    await click('#workspace-agent-toggle');
    await click('.repository-explorer-toggle');
    assert.equal(await evaluate("document.querySelector('.pane-resize-repository-explorer').getClientRects().length"), 0);
    await click('.repository-explorer-toggle');
    for (const [width,height] of [[390,844],[820,1180],[1440,900]]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      assert.equal(await evaluate("!!document.querySelector('.pane-resize-workspace-agent').getClientRects().length"), width >= 1024);
      assert.equal(await evaluate("!!document.querySelector('.pane-resize-repository-explorer').getClientRects().length"), width > 700);
      await screenshot('agent-run-'+width+'.png');
    }
    await cdp('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    const expandedWidth = await evaluate("document.querySelector('.sidebar').getBoundingClientRect().width");
    const workspaceWidth = await evaluate("document.querySelector('.workspace').getBoundingClientRect().width");
    await click('.history-toggle');
    assert.equal(await evaluate("document.querySelector('#chat-history').inert"), false);
    const intermediate = await evaluate("new Promise(resolve => { document.querySelector('#sidebar-collapse-toggle').click(); setTimeout(() => resolve(document.querySelector('.sidebar').getBoundingClientRect().width), 80); })");
    assert.ok(intermediate>72 && intermediate<expandedWidth, 'sidebar width animates between expanded and collapsed');
    await waitFor("Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-72)<1");
    assert.ok(await evaluate("document.querySelector('.workspace').getBoundingClientRect().width")>workspaceWidth+140);
    assert.equal(await evaluate("document.querySelector('#chat-history').inert"), true);
    assert.equal(await evaluate("document.querySelector('#sidebar-collapse-toggle').getAttribute('aria-expanded')"), 'false');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.sidebar .nav > span')).opacity"), '0');
    assert.ok(await evaluate("[...document.querySelectorAll('.sidebar a.nav')].every(link => link.getAttribute('aria-label') && link.title)"));
    await screenshot('sidebar-collapsed-1440.png');
    await click('.sidebar a[href="/quotations"]');
    await waitFor("location.pathname === '/quotations'");
    assert.equal(await evaluate("document.querySelector('.app').dataset.sidebarCollapsed"), 'true');
    await click('.sidebar a[href="/workspace"]');
    await waitFor("location.pathname === '/workspace'");
    assert.equal(await evaluate("document.querySelector('.source-editor:not([hidden]) .cm-content').textContent"), editorText);
    await cdp('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await click('.mobile-toggle');
    await waitFor("document.querySelector('.sidebar').classList.contains('open')");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.sidebar .nav > span')).opacity"), '1');
    assert.equal(await evaluate("document.querySelector('#chat-history').inert"), false);
    assert.equal(await evaluate("document.querySelector('#sidebar-collapse-toggle').getClientRects().length"), 0);
    await screenshot('sidebar-mobile-expanded.png');
    await key('Escape');
    await waitFor("!document.querySelector('.sidebar').classList.contains('open')");
    assert.equal(await evaluate("document.activeElement.classList.contains('mobile-toggle')"), true);
    await cdp('Emulation.setDeviceMetricsOverride', {width:820,height:1180,deviceScaleFactor:1,mobile:false});
    await waitFor("Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-72)<1");
    await cdp('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.app')).transitionDuration"), '0s');
    await evaluate("document.querySelector('#sidebar-collapse-toggle').focus()");
    await key('Enter');
    await waitFor("Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-196)<1");
    await cdp('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await waitFor("Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-224)<1");
    await cdp('Emulation.setEmulatedMedia', {features:[]});
  } finally {
    await cdp("Page.removeScriptToEvaluateOnNewDocument", {identifier:injection.identifier});
  }
}
