import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialProfiles,
  sampleQuestions,
  createComparisonPreview,
  createExperimentPlan,
  validateProfile,
} from "../src/features/workspace/workspace-model.ts";

const profiles = () => initialProfiles.map((profile) => ({ ...profile }));
const input = {
  name: "Kế hoạch mẫu",
  workloadId: "basic",
  repeats: 3,
  phase: "cold",
  seed: 42,
  profileIds: ["baseline", "local"],
};

test("Preview chỉ hiển thị fixture khớp, không bịa số đo hoặc quyền", () => {
  const current = profiles();
  const preview = createComparisonPreview(sampleQuestions[0].question, [
    current[0],
    current[1],
  ]);
  assert.equal(preview.answer, sampleQuestions[0].answer);
  assert.equal(preview.measurements, null);
  assert.equal(preview.authorization, "not-verified");
  const unknown = createComparisonPreview("Câu hỏi khác hoàn toàn", [
    current[0],
    current[1],
  ]);
  assert.equal(unknown.answer, null);
  assert.equal(unknown.source, null);
});

test("So sánh giữ snapshot profile thay vì tham chiếu cấu hình đang sửa", () => {
  const current = profiles();
  const preview = createComparisonPreview("Câu hỏi", [current[0], current[1]]);
  current[1].name = "Tên mới";
  current[1].revision++;
  assert.equal(preview.profiles[1].name, "Secure local");
  assert.equal(preview.profiles[1].revision, 1);
});

test("Kế hoạch tính đúng số lượt dự kiến, không chứa kết quả đo", () => {
  const plan = createExperimentPlan(
    input,
    profiles(),
    "plan-1",
    "2026-10-27T00:00:00Z",
  );
  assert.equal(plan.plannedQueries, 18);
  assert.equal(plan.kind, "experiment-plan");
  assert.equal(plan.previewOnly, true);
  assert.equal(plan.results, null);
  assert.equal(plan.profiles.length, 2);
  assert.deepEqual(plan.caseIds, ["leave", "equipment", "paraphrase"]);
});

test("Kế hoạch không đổi khi sửa profile về sau", () => {
  const current = profiles();
  const plan = createExperimentPlan(
    input,
    current,
    "plan-1",
    "2026-10-27T00:00:00Z",
  );
  current[1].ttlSeconds = 120;
  assert.equal(plan.profiles[1].ttlSeconds, 3600);
});

test("Từ chối kế hoạch không hợp lệ thay vì lưu giả thành công", () => {
  for (const invalid of [
    { repeats: 0 },
    { repeats: NaN },
    { repeats: 1.5 },
    { repeats: 101 },
    { seed: -1 },
    { workloadId: "missing" },
    { profileIds: ["baseline", "missing"] },
    { profileIds: ["local", "local"] },
    { name: "  " },
    { phase: "unknown" },
  ]) {
    assert.throws(() =>
      createExperimentPlan({ ...input, ...invalid }, profiles(), "id", "date"),
    );
  }
});

test("Validate profile chặn TTL, similarity và tên sai", () => {
  const profile = profiles()[1];
  assert.equal(validateProfile(profile), null);
  for (const invalid of [
    { name: " " },
    { ttlSeconds: 0 },
    { ttlSeconds: Infinity },
    { ttlSeconds: 1.5 },
    { similarity: NaN },
    { similarity: 1.1 },
    { cacheLocation: "invalid" },
    { cacheLocation: "toString" },
    { matching: "invalid" },
  ]) {
    assert.equal(typeof validateProfile({ ...profile, ...invalid }), "string");
  }
});
