import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialProfiles,
  sampleQuestions,
  createComparisonPreview,
  createExperimentPlan,
  validateProfile,
  createSetupPlan,
  initialSetup,
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

test("Setup tính ma trận theo mode, không nhân baseline theo threshold/eviction", () => {
  const draft = { ...initialSetup, modes: ["none", "local", "server"] };
  const plan = createSetupPlan(draft, "setup-1", "2026-10-29T00:00:00Z", 1);
  assert.equal(plan.plannedVariants, (1 + 3 * 3 * 2) * 2 * 3);
  assert.equal(plan.plannedQueries, plan.plannedVariants * 3 * 3);
  assert.deepEqual(plan.thresholds, [0.8, 0.85, 0.9]);
  assert.deepEqual(plan.embeddingModels, ["embedding-a", "embedding-b"]);
  assert.equal(plan.dataset.documentSetRevision, 1);
  assert.equal(plan.previewOnly, true);
  assert.equal(plan.results, null);
  assert.deepEqual(plan.loggingFields, ["duration_ms", "llm_tokens", "cache_status", "authorization_decision"]);
});

test("Setup chỉ No Cache bỏ qua threshold, eviction, TTL và dung lượng", () => {
  const plan = createSetupPlan({ ...initialSetup, modes: ["none"], thresholds: "", evictionPolicies: [], ttlSeconds: 0, capacity: 0, requestLogging: false }, "id", "date", 1);
  assert.equal(plan.plannedVariants, 6);
  assert.equal(plan.plannedQueries, 54);
  assert.deepEqual(plan.thresholds, []);
  assert.deepEqual(plan.loggingFields, []);
});

test("Setup snapshot không đổi theo bản nháp; lựa chọn training/export không tạo kết quả", () => {
  const draft = structuredClone(initialSetup);
  draft.localTraining = "fl-simulation";
  draft.exportFormat = "csv";
  const plan = createSetupPlan(draft, "id", "date", 2);
  draft.modes.push("server");
  draft.evictionPolicies.pop();
  draft.accessPolicies.pop();
  draft.embeddingModels = "changed";
  assert.deepEqual(plan.configuration.modes, ["none", "local"]);
  assert.equal(plan.configuration.evictionPolicies.length, 3);
  assert.equal(plan.configuration.accessPolicies.length, 3);
  assert.equal(plan.configuration.localTraining, "fl-simulation");
  assert.equal(plan.configuration.exportFormat, "csv");
  assert.equal(plan.revision, 2);
  assert.equal(JSON.parse(JSON.stringify(plan)).results, null);
});

test("Setup từ chối cấu hình sai, không bỏ qua threshold rỗng hoặc trùng", () => {
  for (const invalid of [
    { name: " " }, { modes: [] }, { modes: ["local", "local"] }, { modes: ["unknown"] },
    { workloadId: "missing" }, { documentSetId: "missing" },
    { embeddingModels: "" }, { embeddingModels: "a\na" }, { embeddingModels: "a\n" },
    { embeddingModels: Array.from({ length: 9 }, (_, i) => `model-${i}`).join("\n") },
    { thresholds: "" }, { thresholds: "0.8," }, { thresholds: "0.8,0.80" },
    { thresholds: "-0.1" }, { thresholds: "1.1" }, { thresholds: "NaN" }, { thresholds: "0x1" },
    { evictionPolicies: [] }, { evictionPolicies: ["unknown"] },
    { accessPolicies: [] }, { accessPolicies: ["unsafe"] },
    { ttlSeconds: NaN }, { capacity: 0 }, { capacity: 1.5 },
    { repeats: 0 }, { seed: -1 }, { phase: "unknown" },
    { localTraining: "unknown" }, { requestLogging: "true" }, { exportFormat: "exe" },
  ]) assert.throws(() => createSetupPlan({ ...initialSetup, ...invalid }, "id", "date", 1), JSON.stringify(invalid));
});
