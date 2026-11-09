import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyQuotationDraft, quotationFromDraft, expirationLabel } from "../src/features/quotations/quotationModel.ts";
import { QuotationHttpClient, QuotationApiError } from "../src/features/quotations/quotationApi.ts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const meta = { request_id: id, contract_version: "v0.2", identity_mode: "fixture" };
const draft = (values = {}) => ({ ...emptyQuotationDraft(), amount: "001.2300", ...values });
const payload = quotationFromDraft(draft());
const record = { ...payload, id };
const baselineValidation = {
  quotation_id: id, flags: [], evaluated_rules: [], validation_config_ref: "quotation-baseline-v1",
  reference_date: null, active_artifact: null,
};
const signal = () => new AbortController().signal;

test("keeps decimal text and missing/null/raw expiration distinct without date validation", () => {
  assert.equal(payload.total_amount, "001.2300");
  assert.equal(Object.hasOwn(payload, "expires_on"), false);
  assert.equal(quotationFromDraft(draft({ expirationMode: "null" })).expires_on, null);
  for (const expiration of ["", "2026-02-30", "2024-01-01", " 2026-11-07 "]) {
    assert.equal(quotationFromDraft(draft({ expirationMode: "text", expiration })).expires_on, expiration);
  }
  for (const expiration of ["false", "0", '{"raw":1}', "[]"]) {
    assert.deepEqual(quotationFromDraft(draft({ expirationMode: "json", expiration })).expires_on, JSON.parse(expiration));
  }
  assert.equal(expirationLabel(record), "Không có trường");
  assert.equal(expirationLabel({ ...record, expires_on: null }), "null");
  assert.equal(expirationLabel({ ...record, expires_on: "" }), '""');
});

test("rejects invalid decimal/JSON and counts UTF-8 bytes", () => {
  for (const amount of ["1e3", "NaN", "1,2", " 1", ""]) assert.throws(() => quotationFromDraft(draft({ amount })));
  for (const expiration of ["undefined", "1e999", "{", "NaN"]) {
    assert.throws(() => quotationFromDraft(draft({ expirationMode: "json", expiration })));
  }
  assert.throws(() => quotationFromDraft(draft({ description: "đ".repeat(33000) })), /64 KiB/);
});

test("rejects decimal strings with trailing line breaks in drafts and API responses", async () => {
  for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
    const amount = `1.2300${suffix}`;
    assert.throws(() => quotationFromDraft(draft({ amount })), /chuỗi thập phân/);
    const api = new QuotationHttpClient("http://local.test", "test-only-token", async () =>
      Response.json({ data: { ...record, total_amount: amount }, meta }));
    await assert.rejects(api.get(id, signal()), (error) => error instanceof QuotationApiError && error.status === 502);
  }
});

test("baseline keeps unrestricted text, currency and decimal lexemes", () => {
  for (const amount of ["0", "-1", "+0001.230000", `${"9".repeat(100)}.000001`]) {
    const data = quotationFromDraft(draft({ supplier: "", description: " \n", currency: " vnd ", amount }));
    assert.equal(data.supplier_name, "");
    assert.equal(data.description, " \n");
    assert.equal(data.currency, " vnd ");
    assert.equal(data.total_amount, amount);
    assert.equal(Object.hasOwn(data, "expires_on"), false);
  }
});

test("HTTP adapter sends Bearer/key with no browser credentials/cache and preserves retry body", async () => {
  const calls = [];
  const api = new QuotationHttpClient("http://local.test/", "test-only-token", async (url, options) => {
    calls.push({ url, options });
    return Response.json({ data: record, meta }, { status: 201 });
  });
  for (let attempt = 0; attempt < 2; attempt++) assert.deepEqual((await api.create(payload, "same-key", signal())).data, record);
  assert.equal(calls[0].url, "http://local.test/api/v1/quotations");
  assert.deepEqual(calls[0].options.headers, { Authorization: "Bearer test-only-token", "Content-Type": "application/json", "Idempotency-Key": "same-key" });
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.body, calls[1].options.body);
  assert.equal(Object.hasOwn(JSON.parse(calls[0].options.body), "expires_on"), false);
});

test("does not invoke native fetch with the API client as its receiver", async () => {
  const api = new QuotationHttpClient("http://local.test", "test-only-token", function () {
    assert.equal(this, undefined);
    return Promise.resolve(Response.json({ data: record, meta }));
  });
  assert.equal((await api.get(id, signal())).data.id, id);
});

test("list and detail go to the API, including cursor", async () => {
  const urls = [];
  const api = new QuotationHttpClient("http://local.test", "test-only-token", async (url) => {
    urls.push(url);
    return Response.json({ data: urls.length === 1 ? { items: [record], next_cursor: id } : record, meta });
  });
  assert.equal((await api.list(signal(), id)).data.next_cursor, id);
  assert.equal((await api.get(id, signal())).data.id, id);
  assert.ok(urls[0].endsWith(`?after=${id}`));
  assert.ok(urls[1].endsWith(`/${id}`));
});

test("validation uses a bodyless POST and decodes the explicit baseline without inventing evidence", async () => {
  let request;
  const api = new QuotationHttpClient("http://local.test", "test-only-token", async (url, options) => {
    request = { url, options };
    return Response.json({ data: baselineValidation, meta });
  });
  assert.deepEqual((await api.validate(id, signal())).data, baselineValidation);
  assert.ok(request.url.endsWith(`/${id}/validate`));
  assert.equal(request.options.method, "POST");
  assert.deepEqual(request.options.headers, { Authorization: "Bearer test-only-token" });
  assert.equal(request.options.body, undefined);
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.cache, "no-store");
});

test("validation rejects mismatched quotation IDs, missing metadata and fabricated evidence", async () => {
  for (const data of [
    { ...baselineValidation, quotation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    { ...baselineValidation, evaluated_rules: undefined },
    { ...baselineValidation, flags: [{ code: "x", field: "expires_on" }] },
    { ...baselineValidation, reference_date: "2026-11-07" },
    { ...baselineValidation, active_artifact: { id: "pretend", digest: "client value" } },
  ]) {
    const api = new QuotationHttpClient("http://local.test", "test-only-token", async () =>
      Response.json({ data, meta }));
    await assert.rejects(api.validate(id, signal()), (error) => error instanceof QuotationApiError && error.status === 502);
  }
  for (const status of [401, 403, 404, 503]) {
    const api = new QuotationHttpClient("http://local.test", "test-only-token", async () =>
      Response.json({ error: { message: "do-not-echo" }, meta }, { status }));
    await assert.rejects(api.validate(id, signal()), (error) => error.status === status && !error.message.includes("do-not-echo"));
  }
});

test("does not echo untrusted server errors or treat an invalid response as success", async () => {
  for (const status of [400, 401, 403, 409, 413, 500, 503]) {
    const api = new QuotationHttpClient("http://local.test", "test-only-token", async () =>
      Response.json({ error: { message: "do-not-echo-secrets" }, meta }, { status }));
    await assert.rejects(api.list(signal()), (error) => error instanceof QuotationApiError
      && error.status === status && error.requestId === id && !error.message.includes("secrets"));
  }
  for (const body of [{ data: record }, { data: { items: [record] }, meta }, { data: record, meta: { ...meta, identity_mode: "production" } }]) {
    const api = new QuotationHttpClient("http://local.test", "test-only-token", async () => Response.json(body));
    await assert.rejects(api.list(signal()), (error) => error.status === 502);
  }
});
