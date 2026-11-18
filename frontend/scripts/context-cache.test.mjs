// Dexie runs against a labeled IndexedDB double; provider/verification tests are backend-owned.
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DexieContextCache } from "../src/features/context-cache/dexieContextCache.ts";
import { isContextRequest, isContextEntry, matchContextEntries } from "../src/features/context-cache/contextCacheModel.ts";

const hash = char => "sha256:" + char.repeat(64);
const vector = () => [1, ...Array(767).fill(0)];
const request = (changes = {}) => ({ request_id: crypto.randomUUID(), snapshot_id: crypto.randomUUID(), prompt: "test-only",
  mode: "local", purpose: "change", intent: "full-authorized-source", namespace: hash("a"), partition: hash("b"),
  manifest_digest: hash("c"), query_fingerprint: hash("d"), vector: vector(), created_at: 1000, expires_at: 1300,
  embedding_calls: 1, embedding_ms: 1, policy: { version: "full-source-context-v1", dimensions: 768, threshold: .85,
    top_k: 3, ttl_seconds: 1800, capacity: 100 }, ...changes });
const entry = (changes = {}) => { const r = request(); return { namespace: r.namespace, partition: r.partition, purpose: r.purpose,
  intent: r.intent, manifest_digest: r.manifest_digest, query_fingerprint: r.query_fingerprint, vector: r.vector,
  created_at: 1000, expires_at: 2800, entry_id: crypto.randomUUID(), payload_digest: hash("e"),
  payload: { kind: "full-source-context-v1", files: [{ path: "a.py", content: "test-only source" }] }, ...changes }; };

test("browser accepts only bounded normalized compatible vectors and source payloads", () => {
  assert.ok(isContextRequest(request())); assert.ok(isContextEntry(entry()));
  for (const change of [{ vector: [1] }, { vector: Array(768).fill(NaN) }, { vector: Array(768).fill(1) }, { namespace: "bad" }]) {
    assert.equal(isContextRequest(request(change)), false);
    assert.equal(isContextEntry(entry(change)), false);
  }
  assert.equal(isContextEntry(entry({ payload: { kind: "full-source-context-v1", files: [{ path: "a.py", content: "x".repeat(131073) }] } })), false);
});

test("exact precedes semantic, top-k is bounded and incompatible/expired contexts are excluded", () => {
  const exact = entry();
  const others = Array.from({ length: 5 }, () => entry({ query_fingerprint: hash("f") }));
  const result = matchContextEntries(request(), [entry({ namespace: hash("f") }), ...others, exact, entry({ expires_at: 1000 })], 1000);
  assert.equal(result.kind, "candidate"); assert.equal(result.candidates.length, 3);
  assert.equal(result.candidates[0].entry_id, exact.entry_id); assert.equal(result.candidates[1].kind, "semantic");
  assert.deepEqual(matchContextEntries(request({ vector: [0, 1, ...Array(766).fill(0)] }), others, 1000), { kind: "no_candidate" });
});

test("None never opens IndexedDB or admits to Local", async () => {
  const cache = new DexieContextCache("test-context-none-" + crypto.randomUUID());
  assert.deepEqual(await cache.lookup(request({ mode: "none", vector: null, embedding_calls: 0 })), { report: { kind: "not_applicable" }, epoch: "", state: "cold" });
  cache.close();
});

test("Dexie cold -> admit -> warm -> reload retains exact payload and evicts expired entries", async () => {
  let now = 1000;
  const name = "test-context-reload-" + crypto.randomUUID();
  let cache = new DexieContextCache(name, () => now);
  const cold = await cache.lookup(request()); assert.equal(cold.report.kind, "no_candidate");
  const admitted = entry(); assert.equal(await cache.admit(admitted, cold.epoch), true);
  cache.close(); cache = new DexieContextCache(name, () => now);
  const warm = await cache.lookup(request()); assert.equal(warm.state, "warm"); assert.equal(warm.report.kind, "candidate");
  assert.equal(warm.report.candidates[0].payload.files[0].content, "test-only source");
  now = 2800;
  assert.equal((await cache.lookup(request())).report.kind, "no_candidate");
  await cache.clear(); cache.close();
});

test("logout, account switch and source/config invalidation reject in-flight writes", async () => {
  const cache = new DexieContextCache("test-context-session-" + crypto.randomUUID(), () => 1000);
  const before = await cache.lookup(request()); const admitted = entry();
  await cache.clear(); assert.equal(await cache.admit(admitted, before.epoch), false);
  await assert.rejects(cache.lookup(request(), before.epoch), /CACHE_SESSION_CHANGED/);
  const fresh = await cache.lookup(request()); await cache.admit(admitted, fresh.epoch);
  await cache.lookup(request({ namespace: hash("f") }));
  assert.equal(await cache.admit(admitted, fresh.epoch), false);
  assert.equal((await cache.lookup(request())).report.kind, "no_candidate");
  const owner = await cache.lookup(request()); await cache.admit(admitted, owner.epoch);
  await cache.lookup(request({ partition: hash("f") }));
  assert.equal(await cache.admit(admitted, owner.epoch), false);
  await cache.clear(); cache.close();
});

test("LRU caps local entries at 100 and touching an entry protects it from eviction", async () => {
  let now = 1000;
  const name = "test-context-lru-" + crypto.randomUUID();
  const cache = new DexieContextCache(name, () => now);
  const { epoch } = await cache.lookup(request());
  const different = { query_fingerprint: hash("f"), vector: [0, 1, ...Array(766).fill(0)] };
  const first = entry(), second = entry(different);
  await cache.admit(first, epoch); now++; await cache.admit(second, epoch);
  for (let i = 0; i < 98; i++) { now++; await cache.admit(entry(different), epoch); }
  now++; await cache.lookup(request()); now++; await cache.admit(entry(different), epoch);
  const result = await cache.lookup(request());
  assert.ok(result.report.candidates.some(item => item.entry_id === first.entry_id));
  // Access the fake DB only in the test to assert actual persistence capacity.
  const db = await new Promise((resolve, reject) => { const open = indexedDB.open(name); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
  const rows = await new Promise((resolve, reject) => { const get = db.transaction("entries").objectStore("entries").getAll(); get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
  assert.equal(rows.length, 100); assert.equal(rows.some(item => item.entry_id === second.entry_id), false);
  db.close(); await cache.clear(); cache.close();
});
