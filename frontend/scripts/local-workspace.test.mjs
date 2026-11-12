import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cookieName, LocalSessionStore, localOrigin, launchLifetime, sessionLifetime } from "../src/features/local-workspace/localSessionStore.ts";
import { LocalWorkspaceServer } from "../src/features/local-workspace/localWorkspaceServer.ts";
import { RepositoryHttpClient } from "../src/features/repositories/repositoryApi.ts";
import { ChangeWorkflowClient } from "../src/features/code-changes/changeWorkflowApi.ts";
import { QuotationHttpClient } from "../src/features/quotations/quotationApi.ts";

const token = "test-only-local-workspace-" + "a".repeat(40);
async function fixture(t, fetcher = async () => Response.json({ data: {} })) {
  const root = await mkdtemp(join(tmpdir(), "cachesec-session-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const credential = join(root, "control-access.env");
  await writeFile(credential, `CONTROL_REPOSITORY_READ_TOKEN='${token}'\n`);
  const store = new LocalSessionStore(root);
  return { store, server: new LocalWorkspaceServer(store, fetcher), credential };
}
function request(path = "/session", method = "GET", value, cookie, extra = {}) {
  return new Request(localOrigin + "/api/local-control" + path, {
    method, headers: { host: "127.0.0.1:3000", "sec-fetch-site": "same-origin", origin: localOrigin,
      "x-cachesec-workspace": "1", ...(cookie ? { cookie } : {}),
      ...(value !== undefined ? { "content-type": "application/json" } : {}), ...extra },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}
async function login(store, server) {
  const launch = await store.issueLaunch();
  const result = await server.session(request("/session", "POST", { launch }));
  assert.equal(result.status, 200);
  const cookie = result.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly; SameSite=Strict; Max-Age=28800/);
  assert.ok(!cookie.includes(token));
  return cookie.split(";")[0];
}

test("local launch is one use, race-safe, origin-bound and expires after 60 seconds", async t => {
  const { store } = await fixture(t);
  const now = Date.now();
  const launch = await store.issueLaunch(now);
  await assert.rejects(store.consumeLaunch(launch, "http://127.0.0.1:3001", now));
  const results = await Promise.allSettled([store.consumeLaunch(launch, localOrigin, now), store.consumeLaunch(launch, localOrigin, now)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  await assert.rejects(store.consumeLaunch(launch, localOrigin, now));
  await assert.rejects(store.consumeLaunch(await store.issueLaunch(now), localOrigin, now + launchLifetime));
  await assert.rejects(store.consumeLaunch("../../control-access.env", localOrigin, now));
});

test("session survives a server restart, expires at 8 hours and cannot adopt rotated credentials", async t => {
  const { store, credential } = await fixture(t);
  const { digest } = await store.credential(), now = Date.now();
  const session = await store.createSession(localOrigin, digest, now);
  assert.equal((await store.session(session.value, localOrigin, now + sessionLifetime - 1)).token, token);
  const restarted = new LocalSessionStore(join(store.root, ".."));
  assert.equal((await restarted.session(session.value, localOrigin, now)).token, token);
  await assert.rejects(store.session(session.value, localOrigin, now + sessionLifetime));
  const launch = await store.issueLaunch(now);
  await writeFile(credential, `CONTROL_REPOSITORY_READ_TOKEN=${token}rotated\n`);
  await assert.rejects(store.session(session.value, localOrigin, now));
  await assert.rejects(store.consumeLaunch(launch, localOrigin, now));
});

test("cookie alone, cross-origin, same-site different port, DNS rebinding and missing metadata fail before upstream", async t => {
  let calls = 0;
  const { store, server } = await fixture(t, async () => { calls++; return Response.json({}); });
  const cookie = await login(store, server); calls = 0;
  for (const extra of [{ origin: "http://127.0.0.1:4000" }, { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" }, { host: "evil.example:3000" }, { "x-cachesec-workspace": "" }, { "sec-fetch-site": "" }]) {
    const result = await server.proxy(request("/api/v1/repository", "GET", undefined, cookie, extra));
    assert.equal(result.status, 403);
    assert.equal(result.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(calls, 0);
});

test("NextRequest loopback normalization keeps exact browser Host/Origin enforcement", async t => {
  const { NextRequest } = await import("next/server.js");
  const { store, server } = await fixture(t);
  const source = request("/session", "POST", { launch: await store.issueLaunch() });
  const normalized = new NextRequest(source);
  assert.equal(new URL(normalized.url).hostname, "localhost");
  assert.equal((await server.session(normalized)).status, 200);
  assert.equal((await server.session(new NextRequest(request("/session", "GET", undefined, undefined, { host: "localhost:3000" })))).status, 403);
});

test("launch authenticates current identity, cannot replay or accept a posted token", async t => {
  const seen = [];
  const { store, server } = await fixture(t, async (url, init) => { seen.push({ url, init }); return Response.json({}); });
  const launch = await store.issueLaunch();
  const result = await server.session(request("/session", "POST", { launch }));
  assert.equal(result.status, 200);
  assert.equal(seen[0].url, "http://127.0.0.1:8000/api/v1/repository");
  assert.equal(seen[0].init.headers.Authorization, "Bearer " + token);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.ok(!JSON.stringify(await result.json()).includes(token));
  assert.equal((await server.session(request("/session", "POST", { launch }))).status, 401);
  assert.equal((await server.session(request("/session", "POST", { token }))).status, 400);
});

test("no backend identity or unavailable backend cannot create a local session", async t => {
  for (const status of [401, 403, 503]) {
    const { store, server } = await fixture(t, async () => Response.json({}, { status }));
    const result = await server.session(request("/session", "POST", { launch: await store.issueLaunch() }));
    assert.equal(result.status, status);
    assert.equal(result.headers.get("set-cookie"), null);
  }
});

test("proxy preserves artifact request and retry key, rechecks upstream each time, strips browser authority headers", async t => {
  let last, calls = 0;
  const { store, server } = await fixture(t, async (url, init) => {
    calls++; last = { url, init };
    return Response.json({ data: {} }, { headers: { "set-cookie": "unsafe=upstream", "access-control-allow-origin": "*" } });
  });
  const cookie = await login(store, server); calls = 0;
  const data = { base_snapshot_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", content: "# test\n" };
  for (let i = 0; i < 2; i++) {
    const result = await server.proxy(request("/api/v1/changes/proposals", "POST", data, cookie,
      { "idempotency-key": "retry-test", authorization: "Bearer client-injected", "x-tenant-id": "other" }));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("set-cookie"), null);
    assert.equal(result.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(calls, 2);
  assert.equal(last.url, "http://127.0.0.1:8000/api/v1/changes/proposals");
  assert.deepEqual(last.init.headers, { "Content-Type": "application/json", "Idempotency-Key": "retry-test", Authorization: "Bearer " + token });
  assert.deepEqual(JSON.parse(last.init.body), data);
  assert.equal(last.init.redirect, "error");
  assert.equal(last.init.cache, "no-store");
});

test("proxy never exposes admin, worker, approval, deploy, arbitrary URLs, queries or wrong methods", async t => {
  let calls = 0;
  const { store, server } = await fixture(t, async () => { calls++; return Response.json({}); });
  const cookie = await login(store, server); calls = 0;
  for (const [path, method] of [["/_internal/test-worker/claim", "POST"], ["/api/v1/admin", "POST"],
    ["/api/v1/changes/approve", "POST"], ["/api/v1/deploy", "POST"], ["/http://evil.example", "GET"],
    ["/api/v1/repository", "DELETE"], ["/api/v1/repository?url=http://evil.example", "GET"]]) {
    assert.ok([403, 404].includes((await server.proxy(request(path, method, undefined, cookie))).status));
  }
  assert.equal(calls, 0);
  assert.equal((await server.proxy(request("/api/v1/repository"))).status, 401);
  assert.equal((await server.proxy(request("/api/v1/changes/proposals", "POST", { content: "x".repeat(400000) }, cookie))).status, 413);
});

test("revocation response is preserved and invalidates the local session; logout prevents cookie replay", async t => {
  let denied = false;
  const { store, server } = await fixture(t, async () => Response.json({}, { status: denied ? 401 : 200 }));
  const cookie = await login(store, server);
  denied = true;
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, cookie))).status, 401);
  assert.equal((await server.session(request("/session", "GET", undefined, cookie)).then(r => r.json())).connected, false);
  denied = false;
  const second = await login(store, server);
  assert.equal((await server.session(request("/session", "DELETE", undefined, second))).status, 200);
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, second))).status, 401);
  assert.equal((await server.session(request("/session", "GET", undefined, `${cookieName}=a; ${cookieName}=b`)).then(r => r.json())).connected, false);
});

test("local clients send same-origin session requests without Bearer; external adapters keep their contract", async () => {
  for (const Api of [RepositoryHttpClient, ChangeWorkflowClient, QuotationHttpClient]) {
    let seen;
    const client = new Api("/api/local-control", null, async (url, init) => { seen = { url, init }; return Response.json({}, { status: 401 }); });
    await assert.rejects(Api === RepositoryHttpClient ? client.describe(new AbortController().signal)
      : Api === QuotationHttpClient ? client.list(new AbortController().signal) : client.config(new AbortController().signal));
    assert.equal(seen.init.credentials, "same-origin");
    assert.equal(seen.init.headers.Authorization, undefined);
    assert.equal(seen.init.headers["X-CacheSec-Workspace"], "1");
    assert.ok(seen.url.startsWith("/api/local-control/api/v1/"));
    assert.throws(() => new Api("https://external.example", null));
  }
});

const quotationToken = "test-only-quotation-operator-" + "q".repeat(40);
async function quotationAccess(store, value = quotationToken) {
  await writeFile(join(store.root, "../quotation-access.json"), JSON.stringify({ operator_token: value }));
}
test("one owner launch binds separate existing realm credentials; quotation cursor and validate stay scoped", async t => {
  const seen = [];
  const { store, server } = await fixture(t, async (url, init) => { seen.push({ url, init }); return Response.json({}); });
  await quotationAccess(store);
  const cookie = await login(store, server); seen.length = 0;
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  assert.equal((await server.proxy(request(`/api/v1/quotations?cursor=${id}`, "GET", undefined, cookie))).status, 200);
  assert.equal(seen[0].url, `http://127.0.0.1:8001/api/v1/quotations?cursor=${id}`);
  assert.equal(seen[0].init.headers.Authorization, "Bearer " + quotationToken);
  assert.equal((await server.proxy(request(`/api/v1/quotations/${id}/validate`, "POST", undefined, cookie))).status, 200);
  assert.equal(seen[1].init.body, undefined);
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, cookie))).status, 200);
  assert.equal(seen[2].init.headers.Authorization, "Bearer " + token);
  for (const path of ["/api/v1/quotations?cursor=bad", `/api/v1/quotations?cursor=${id}&cursor=${id}`,
    "/api/v1/quotations?role=operator", "/api/v1/quotations?url=http://evil.example"])
    assert.equal((await server.proxy(request(path, "GET", undefined, cookie))).status, 403);
  assert.equal(seen.length, 3);
});

test("a control-only cookie never gains quotation access when configuration is added later", async t => {
  let calls = 0;
  const { store, server } = await fixture(t, async () => { calls++; return Response.json({}); });
  const cookie = await login(store, server);
  await quotationAccess(store); calls = 0;
  assert.equal((await server.proxy(request("/api/v1/quotations", "GET", undefined, cookie))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, cookie))).status, 200);
  const second = await login(store, server);
  assert.equal((await server.proxy(request("/api/v1/quotations", "GET", undefined, second))).status, 200);
});

test("quotation revocation/rotation does not upgrade credentials or log control out; shared logout revokes both", async t => {
  let denyQuotation = false;
  const { store, server } = await fixture(t, async url => Response.json({}, {
    status: denyQuotation && String(url).includes(":8001/") ? 401 : 200,
  }));
  await quotationAccess(store);
  const cookie = await login(store, server);
  denyQuotation = true;
  assert.equal((await server.proxy(request("/api/v1/quotations", "GET", undefined, cookie))).status, 401);
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, cookie))).status, 200);
  denyQuotation = false;
  await quotationAccess(store, quotationToken + "rotated");
  assert.equal((await server.proxy(request("/api/v1/quotations", "GET", undefined, cookie))).status, 401);
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, cookie))).status, 200);
  await server.session(request("/session", "DELETE", undefined, cookie));
  assert.equal((await server.proxy(request("/api/v1/repository", "GET", undefined, cookie))).status, 401);
  assert.equal((await server.proxy(request("/api/v1/quotations", "GET", undefined, cookie))).status, 401);
});

test("quotation credential rotation between launch and exchange cannot adopt the new identity", async t => {
  const { store, server } = await fixture(t);
  await quotationAccess(store);
  const launch = await store.issueLaunch();
  await quotationAccess(store, quotationToken + "rotated");
  const result = await server.session(request("/session", "POST", { launch }));
  assert.equal(result.status, 401);
  assert.equal(result.headers.get("set-cookie"), null);
});
