import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { LocalSessionStore } from "../src/features/local-workspace/localSessionStore.ts";

export async function checkAppPages({ cdp, navigate, evaluate, waitFor, click, screenshot }) {
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local/", import.meta.url)));
  const observation = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const original=window.fetch.bind(window); window.__pageMutations=0;
    window.fetch=(url,init)=>{
      const path=String(url);
      if(init?.method==='POST' && path.includes('/api/v1/') && !path.endsWith('/repository/snapshots')) {
        window.__pageMutations++; throw new Error('Page check cannot mutate workflow');
      }
      if(window.__denyPage && path.includes('/api/v1/')) return Promise.resolve(new Response(JSON.stringify({error:{code:'FORBIDDEN'}}),{status:403}));
      return original(url,init);
    };
  })()` });
  try {
    await navigate("/workspace#local-launch=" + await store.issueLaunch());
    await waitFor("document.querySelector('.repository-panel')?.dataset.connected === 'true'");
    await navigate("/settings");
    await waitFor("location.pathname === '/setup' && !!document.querySelector('[data-runtime-settings=loaded]')");
    assert.equal(await evaluate("!!document.querySelector('#setup-mode-title')"), false);
    for (const width of [390, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height:1000,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
      await screenshot(`runtime-settings-${width}.png`);
    }
    // Explicitly labeled denial injection: previously read config must disappear.
    await evaluate("window.__denyPage=true"); await click('.runtime-settings button');
    await waitFor("!!document.querySelector('.runtime-settings [role=alert]') && !document.querySelector('[data-runtime-settings=loaded]')");
    await navigate("/documents");
    await waitFor("!!document.querySelector('#documents-capture:not(:disabled)')");
    assert.equal(await evaluate("!!document.querySelector('#document-files')"), false);
    await click('#documents-capture');
    await waitFor("document.querySelectorAll('[data-document-file]').length === 3");
    await click('[data-document-file]');
    await waitFor("!!document.querySelector('[data-document-preview] code')");
    assert.ok((await evaluate("document.querySelector('[data-document-preview] code').textContent")).includes('Quotation'));
    for (const width of [390, 820, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height:1000,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
      await screenshot(`repository-documents-${width}.png`);
    }
    await evaluate("window.__denyPage=true"); await click('[data-document-file]');
    await waitFor("!!document.querySelector('.repository-documents [role=alert]') && !document.querySelector('[data-document-preview]') && !document.querySelector('[data-source-snapshot]')");
    assert.equal(await evaluate("window.__pageMutations"), 0);
    await navigate('/experiments');
    await waitFor("location.pathname==='/setup' && location.search==='?view=preview' && !!document.querySelector('#setup-mode-title')");
    await navigate('/documents?view=preview');
    await waitFor("!!document.querySelector('#document-files')");
    console.log('Đạt: cấu hình/source API thật, scope ba file, responsive, xóa dữ liệu khi 403 và giữ giao diện mẫu riêng; không gọi provider/approval/activation.');
  } finally { await cdp("Page.removeScriptToEvaluateOnNewDocument", {identifier:observation.identifier}); }
}
