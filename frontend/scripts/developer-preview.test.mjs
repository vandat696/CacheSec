import assert from "node:assert/strict";
import { test } from "node:test";
import { canPreviewApproval, developerPreviewReducer as reduce, initialDeveloperPreview } from "../src/features/developer/developer-preview-model.ts";
import { previewDiff } from "../src/features/developer/developer-preview-data.ts";

function reviewed() {
  return reduce(reduce(initialDeveloperPreview(), { type: "tests" }), { type: "acknowledge", checked: true });
}

test("Duyệt mẫu cần xem test, xác nhận diff và reviewer; cache hit không cấp phép", () => {
  const initial = initialDeveloperPreview();
  assert.equal(initial.cacheScenario, "hit");
  assert.equal(canPreviewApproval(initial), false);
  assert.equal(reduce(initial, { type: "approve", revision: 1 }).approval, "pending");
  assert.equal(canPreviewApproval(reduce(initial, { type: "tests" })), false);
  assert.equal(canPreviewApproval(reduce(initial, { type: "acknowledge", checked: true })), false);
  assert.equal(canPreviewApproval(reviewed()), true);
  const developer = reduce(reviewed(), { type: "role", role: "developer" });
  assert.equal(reduce(developer, { type: "approve", revision: 1 }).approval, "pending");
});

test("Đổi bản sửa thay nội dung mẫu và vô hiệu test/approval cũ; không nhận sự kiện revision cũ", () => {
  const approved = reduce(reviewed(), { type: "approve", revision: 1 });
  assert.equal(approved.approval, "approved");
  const revised = reduce(approved, { type: "revise" });
  assert.equal(revised.revision, 2);
  assert.equal(revised.approval, "pending");
  assert.equal(revised.testRevision, null);
  assert.equal(revised.acknowledgedRevision, null);
  assert.notDeepEqual(previewDiff(1), previewDiff(2));
  const readyAgain = reduce(reduce(revised, { type: "tests" }), { type: "acknowledge", checked: true });
  assert.equal(reduce(readyAgain, { type: "approve", revision: 1 }).approval, "pending");
  assert.equal(reduce(readyAgain, { type: "approve", revision: 2 }).approval, "approved");
  assert.equal(approved.revision, 1);
});

test("Yêu cầu sửa và đổi vai trò đặt lại duyệt; reset chỉ tạo trạng thái demo mới", () => {
  const requested = reduce(reviewed(), { type: "request-changes", revision: 1 });
  assert.equal(requested.approval, "changes-requested");
  assert.equal(canPreviewApproval(requested), false);
  const approved = reduce(reviewed(), { type: "approve", revision: 1 });
  assert.equal(reduce(approved, { type: "role", role: "developer" }).approval, "pending");
  assert.deepEqual(reduce(requested, { type: "reset" }), initialDeveloperPreview());
});

test("Kịch bản cache chỉ cập nhật mô phỏng và trace, không sinh quyền hoặc số đo", () => {
  const state = reduce(initialDeveloperPreview(), { type: "cache", scenario: "rejected" });
  assert.equal(state.cacheScenario, "rejected");
  assert.equal(state.approval, "pending");
  assert.equal(state.testRevision, null);
  assert.match(state.events.at(-1).text, /minh họa/);
  assert.deepEqual(state.events.map((event) => event.id), [1, 2]);
});
