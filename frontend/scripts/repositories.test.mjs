import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { RepositoryHttpClient, RepositoryApiError, sourceText } from "../src/features/repositories/repositoryApi.ts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const meta = { request_id: id, contract_version: "v0.2", identity_mode: "fixture" };
const signal = () => new AbortController().signal;
const hash = (content) => "sha256:" + createHash("sha256").update(content).digest("hex");
const bytes = Buffer.from("print('source')\r\n");
const file = { file_id: fid, path: "source/code.py", digest: hash(bytes), byte_size: bytes.length };
const snapshot = { snapshot_id: id, repository_identity: "test-repo", source_profile_digest: hash("profile"),
  manifest_digest: hash("manifest"), files: [file] };
const contents = (content = bytes) => ({ snapshot_id: id, file_id: fid, encoding: "base64", content: content.toString("base64") });
const api = (data, status = 200) => new RepositoryHttpClient("http://local.test", "test-only-token", async () =>
  Response.json({ data, meta }, { status }));

test("repository transport sends only Bearer, no cookies, body, path or scope metadata", async () => {
  let seen;
  const client = new RepositoryHttpClient("http://local.test/", "test-only-token", async (url, init) => {
    seen = { url, init }; return Response.json({ data: snapshot, meta }, { status: 201 });
  });
  assert.deepEqual(await client.capture(signal()), snapshot);
  assert.equal(seen.url, "http://local.test/api/v1/repository/snapshots");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.credentials, "omit"); assert.equal(seen.init.redirect, "error");
  assert.equal(seen.init.cache, "no-store"); assert.equal(seen.init.body, undefined);
  assert.deepEqual(seen.init.headers, { Authorization: "Bearer test-only-token" });
});

test("saved file decoding preserves bytes and verifies content identity, size and hash", async () => {
  assert.deepEqual(await api(contents()).readFile(id, file, signal()), new Uint8Array(bytes));
  const binary = Buffer.from([0, 255, 10, 13]);
  assert.deepEqual(await api(contents(binary)).readFile(id, { ...file, digest: hash(binary), byte_size: binary.length }, signal()), new Uint8Array(binary));
  for (const change of [{ file_id: id }, { snapshot_id: fid }, { encoding: "utf8" }, { content: "!!!=" },
    { content: "" }, { content: Buffer.from("x".repeat(1048577)).toString("base64") }]) {
    await assert.rejects(api({ ...contents(), ...change }).readFile(id, file, signal()), RepositoryApiError);
  }
  await assert.rejects(api(contents()).readFile(id, { ...file, digest: hash("wrong") }, signal()), RepositoryApiError);
});

test("rejects wrong resource, traversal, duplicate files, caps and malformed envelope", async () => {
  await assert.rejects(api(snapshot).get(fid, signal()), RepositoryApiError);
  for (const files of [[], Array(257).fill(file), [file, file], [{ ...file, path: "../.env" }],
    [{ ...file, path: "C:/secret" }], [{ ...file, byte_size: -1 }], [{ ...file, byte_size: 1048577 }]]) {
    await assert.rejects(api({ ...snapshot, files }).get(id, signal()), RepositoryApiError);
  }
  const client = new RepositoryHttpClient("http://local.test", "test", async () => Response.json({ data: snapshot }));
  await assert.rejects(client.get(id, signal()), RepositoryApiError);
  await assert.rejects(client.get("../../.env", signal()), RepositoryApiError);
});

test("error messages never render arbitrary upstream errors or source paths", async () => {
  for (const status of [401, 403, 404, 409, 413, 500, 503]) {
    const client = new RepositoryHttpClient("http://local.test", "test", async () => Response.json({
      error: { code: "private-token-source-path", message: "secret" }, meta,
    }, { status }));
    await assert.rejects(client.describe(signal()), (error) => error instanceof RepositoryApiError
      && error.status === status && error.requestId === id && !error.message.includes("secret")
      && !error.message.includes("private-token"));
  }
});

test("text view uses strict UTF-8 and keeps binary and control characters out of the code view", () => {
  assert.equal(sourceText(new Uint8Array(bytes)), "print('source')\n");
  assert.equal(sourceText(new Uint8Array([255])), null);
  assert.equal(sourceText(new Uint8Array([0])), null);
  assert.equal(sourceText(new Uint8Array([27, 91, 109])), null);
  assert.equal(sourceText(new Uint8Array()), "");
  assert.equal(sourceText(new TextEncoder().encode("<script>test</script>")), "<script>test</script>");
});
