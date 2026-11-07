import type { CacheLocation } from "./cacheProfileModel.ts";
import { workloads } from "./experimentPlanModel.ts";

// Setup snapshots describe intent only; they never grant access or execute a run.
export const experimentModes = [
  { value: "none", label: "No Cache" },
  { value: "local", label: "Local Cache" },
  { value: "server", label: "Server Cache" },
] as const;
export const evictionPolicies = ["FIFO", "LRU", "LFU"] as const;
export const accessPolicies = ["RBAC", "ABAC", "RBAC + ABAC"] as const;
export const documentSets = [
  {
    id: "internal-demo-v1",
    name: "Tài liệu nội bộ giả lập",
    revision: 1,
    documents: ["Quy chế nhân sự", "Hướng dẫn IT"],
  },
] as const;

export type SetupDraft = {
  name: string;
  modes: CacheLocation[];
  workloadId: string;
  documentSetId: string;
  embeddingModels: string;
  thresholds: string;
  evictionPolicies: (typeof evictionPolicies)[number][];
  accessPolicies: (typeof accessPolicies)[number][];
  localTraining: "off" | "fine-tuning" | "fl-simulation";
  requestLogging: boolean;
  exportFormat: "json" | "csv";
  ttlSeconds: number;
  capacity: number;
  repeats: number;
  phase: "cold" | "warm";
  seed: number;
};

export const initialSetup: SetupDraft = {
  name: "So sánh các chế độ cache",
  modes: ["none", "local"],
  workloadId: "basic",
  documentSetId: "internal-demo-v1",
  embeddingModels: "embedding-a\nembedding-b",
  thresholds: "0.80, 0.85, 0.90",
  evictionPolicies: ["FIFO", "LRU", "LFU"],
  accessPolicies: ["RBAC", "ABAC", "RBAC + ABAC"],
  localTraining: "off",
  requestLogging: true,
  exportFormat: "json",
  ttlSeconds: 3600,
  capacity: 100,
  repeats: 3,
  phase: "cold",
  seed: 42,
};

export type SetupPlan = {
  id: string;
  createdAt: string;
  revision: number;
  schemaVersion: 1;
  kind: "setup-plan";
  previewOnly: true;
  configuration: SetupDraft;
  dataset: {
    workloadId: string;
    caseIds: string[];
    documentSetId: string;
    documentSetRevision: number;
    documents: string[];
  };
  embeddingModels: string[];
  thresholds: number[];
  plannedVariants: number;
  plannedQueries: number;
  loggingFields: string[];
  results: null;
};

export function createSetupPlan(
  draft: SetupDraft,
  id: string,
  createdAt: string,
  revision: number,
): SetupPlan {
  const workload = workloads.find((item) => item.id === draft.workloadId);
  const documents = documentSets.find(
    (item) => item.id === draft.documentSetId,
  );
  const validChoices = (
    values: readonly string[],
    allowed: readonly string[],
  ) =>
    values.length > 0 &&
    new Set(values).size === values.length &&
    values.every((value) => allowed.includes(value));
  if (!draft.name.trim() || draft.name.trim().length > 80)
    throw new Error("Tên thí nghiệm cần từ 1 đến 80 ký tự.");
  if (!workload || !documents)
    throw new Error("Chọn bộ câu hỏi và tài liệu thử nghiệm hợp lệ.");
  if (
    !validChoices(
      draft.modes,
      experimentModes.map((item) => item.value),
    )
  )
    throw new Error("Chọn ít nhất một Experiment Mode, không lặp lại.");
  if (!validChoices(draft.accessPolicies, accessPolicies))
    throw new Error("Chọn ít nhất một mô hình kiểm soát truy cập.");
  const hasCache = draft.modes.some((mode) => mode !== "none");
  if (hasCache && !validChoices(draft.evictionPolicies, evictionPolicies))
    throw new Error("Chọn ít nhất một chính sách eviction.");
  const embeddingModels = draft.embeddingModels
    .split(/\r?\n/)
    .map((item) => item.trim());
  if (
    embeddingModels.length > 8 ||
    !embeddingModels.every((item) => item.length > 0 && item.length <= 160) ||
    new Set(embeddingModels).size !== embeddingModels.length
  )
    throw new Error(
      "Nhập 1–8 ID/alias embedding khác nhau, mỗi dòng một model (tối đa 160 ký tự).",
    );
  const thresholdTokens = draft.thresholds
    .split(",")
    .map((item) => item.trim());
  const thresholds = hasCache ? thresholdTokens.map(Number) : [];
  if (
    hasCache &&
    (thresholds.length > 20 ||
      thresholdTokens.some(
        (item) => !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(item),
      ) ||
      thresholds.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 1,
      ) ||
      new Set(thresholds).size !== thresholds.length)
  )
    throw new Error(
      "Nhập 1–20 threshold khác nhau từ 0 đến 1, dùng dấu chấm thập phân và dấu phẩy phân tách.",
    );
  if (
    hasCache &&
    (!Number.isInteger(draft.ttlSeconds) ||
      draft.ttlSeconds < 60 ||
      draft.ttlSeconds > 86400)
  )
    throw new Error("TTL cần là số nguyên từ 60 đến 86.400 giây.");
  if (
    hasCache &&
    (!Number.isInteger(draft.capacity) ||
      draft.capacity < 1 ||
      draft.capacity > 100000)
  )
    throw new Error("Dung lượng cache cần từ 1 đến 100.000 mục.");
  if (
    !Number.isInteger(draft.repeats) ||
    draft.repeats < 1 ||
    draft.repeats > 100
  )
    throw new Error("Số lần lặp cần từ 1 đến 100.");
  if (
    !Number.isInteger(draft.seed) ||
    draft.seed < 0 ||
    draft.seed > 4294967295
  )
    throw new Error("Seed cần là số nguyên từ 0 đến 4.294.967.295.");
  if (
    !["cold", "warm"].includes(draft.phase) ||
    !["off", "fine-tuning", "fl-simulation"].includes(draft.localTraining) ||
    !["json", "csv"].includes(draft.exportFormat) ||
    typeof draft.requestLogging !== "boolean"
  )
    throw new Error("Lựa chọn điều kiện thí nghiệm không hợp lệ.");
  const cacheVariants = draft.modes.reduce(
    (total, mode) =>
      total +
      (mode === "none" ? 1 : thresholds.length * draft.evictionPolicies.length),
    0,
  );
  const plannedVariants =
    cacheVariants * embeddingModels.length * draft.accessPolicies.length;
  return {
    id,
    createdAt,
    revision,
    schemaVersion: 1,
    kind: "setup-plan",
    previewOnly: true,
    configuration: {
      ...draft,
      name: draft.name.trim(),
      modes: [...draft.modes],
      evictionPolicies: [...draft.evictionPolicies],
      accessPolicies: [...draft.accessPolicies],
    },
    dataset: {
      workloadId: workload.id,
      caseIds: [...workload.caseIds],
      documentSetId: documents.id,
      documentSetRevision: documents.revision,
      documents: [...documents.documents],
    },
    embeddingModels,
    thresholds,
    plannedVariants,
    plannedQueries: plannedVariants * workload.caseIds.length * draft.repeats,
    loggingFields: draft.requestLogging
      ? ["duration_ms", "llm_tokens", "cache_status", "authorization_decision"]
      : [],
    results: null,
  };
}
