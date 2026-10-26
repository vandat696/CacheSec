import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateDocument,
  maxFileBytes,
  queueDocuments,
  filterDocuments,
  fileKey,
  isDocumentCategory,
} from "../src/features/documents/document-model.ts";

const file = (name, text = "Nội dung giả lập", lastModified = 1) =>
  new File([text], name, { lastModified });
const ids = () => {
  let value = 0;
  return () => `document-${++value}`;
};

test("Chỉ nhận định dạng hỗ trợ, có nội dung và trong giới hạn", () => {
  for (const name of ["sample.pdf", "sample.DOCX", "sample.txt", "sample.MD"])
    assert.equal(validateDocument(file(name)), null);
  for (const name of ["sample.exe", "sample.pdf.exe", "sample", "."])
    assert.equal(typeof validateDocument(file(name)), "string");
  assert.equal(typeof validateDocument(file("empty.txt", "")), "string");
  assert.equal(
    validateDocument({
      name: "limit.txt",
      size: maxFileBytes,
      lastModified: 1,
    }),
    null,
  );
  assert.equal(
    typeof validateDocument({
      name: "large.txt",
      size: maxFileBytes + 1,
      lastModified: 1,
    }),
    "string",
  );
});

test("Tiếp nhận từng tệp hợp lệ, báo riêng lỗi của tệp bị từ chối", () => {
  const result = queueDocuments(
    [],
    [file("policy.txt"), file("bad.exe"), file("guide.md")],
    "hr",
    ids(),
  );
  assert.deepEqual(
    result.documents.map((document) => document.file.name),
    ["policy.txt", "guide.md"],
  );
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].name, "bad.exe");
  assert.ok(
    result.documents.every(
      (document) => document.category === "hr" && document.status === "pending",
    ),
  );
});

test("Chặn tệp trùng cả trong một lần chọn và danh sách đã có", () => {
  const sample = file("policy.txt");
  const first = queueDocuments([], [sample, sample], "policy", ids());
  assert.equal(first.documents.length, 1);
  assert.equal(first.issues.length, 1);
  const second = queueDocuments(
    first.documents,
    [file("policy.txt")],
    "technical",
    ids(),
  );
  assert.equal(second.documents.length, 1);
  assert.equal(second.documents[0].category, "policy");
  assert.equal(second.issues.length, 1);
});

test("Tên giống nhưng metadata khác không bị tự ghi đè", () => {
  assert.notEqual(
    fileKey(file("policy.txt", "Version 1", 1)),
    fileKey(file("policy.txt", "Version 2", 2)),
  );
  const result = queueDocuments(
    [],
    [file("policy.txt", "A", 1), file("policy.txt", "B", 2)],
    "uncategorized",
    ids(),
  );
  assert.equal(result.documents.length, 2);
  assert.equal(
    new Set(result.documents.map((document) => document.id)).size,
    2,
  );
});

test("Lọc đồng thời theo tên và danh mục, không sửa danh sách gốc", () => {
  const first = queueDocuments(
    [],
    [file("Chính sách.txt")],
    "hr",
    ids(),
  ).documents;
  const all = queueDocuments(
    first,
    [file("Guide.md")],
    "technical",
    () => "guide",
  ).documents;
  assert.equal(filterDocuments(all, "  CHÍNH ", "hr").length, 1);
  assert.equal(filterDocuments(all, "chính", "technical").length, 0);
  assert.equal(filterDocuments(all, "", "all").length, 2);
  assert.equal(all.length, 2);
});

test("Phân loại là danh mục định sẵn, không nhận giá trị ngoài danh sách", () => {
  assert.equal(isDocumentCategory("hr"), true);
  assert.equal(isDocumentCategory("toString"), false);
  assert.throws(() => queueDocuments([], [file("policy.txt")], "admin", ids()));
});

test("Chỉ giữ File trong phiên; không đọc nội dung hoặc giả thành đã nạp", () => {
  const source = file("policy.txt");
  source.text = () => {
    throw new Error("Không được đọc nội dung trong bản xem trước");
  };
  const result = queueDocuments([], [source], "other", ids());
  assert.equal(result.documents[0].file, source);
  assert.equal(result.documents[0].status, "pending");
  assert.equal("permissions" in result.documents[0], false);
});
