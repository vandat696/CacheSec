import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";

// All Agent run/config endpoints here are marked transport doubles. No model or test executor is called.
export async function checkAgentRuns({ cdp, navigate, evaluate, waitFor, click, fill, screenshot }) {
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
    for (const [width,height] of [[390,844],[820,1180],[1440,900]]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await screenshot('agent-run-'+width+'.png');
    }
  } finally {
    await cdp("Page.removeScriptToEvaluateOnNewDocument", {identifier:injection.identifier});
  }
}
