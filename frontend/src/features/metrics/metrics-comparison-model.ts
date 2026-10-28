import type { ChatBranch } from "../chat/chat-state";
import type { BranchSummary } from "./metrics-model";

export type ComparisonValue = { text: string; value: number | null; samples?: { count: number; total: number } };
export type ComparisonRow = {
  key: string;
  label: string;
  unit: "ms" | "lượt" | "token" | "%";
  preference: "lower" | "higher" | null;
  // Presentation eligibility, not proof of comparable runs or an API contract.
  // The caller must establish equivalent measurements before enabling this.
  comparable: boolean;
  values: Record<ChatBranch, ComparisonValue>;
};

export function isValidComparisonValue(unit: ComparisonRow["unit"], item: ComparisonValue): item is ComparisonValue & { value: number } {
  if (item.value === null || !Number.isFinite(item.value) || item.value < 0) return false;
  if (unit !== "%") return true;
  const samples = item.samples;
  return !!samples && Number.isInteger(samples.total) && samples.total > 0 &&
    Number.isInteger(samples.count) && samples.count >= 0 && samples.count <= samples.total &&
    item.value <= 100 && Math.abs(item.value - samples.count / samples.total * 100) < 1e-9;
}

export function getBetterBranch(row: ComparisonRow): ChatBranch | null {
  const left = row.values["no-cache"];
  const right = row.values.cache;
  if (!row.comparable || !row.preference || !isValidComparisonValue(row.unit, left) || !isValidComparisonValue(row.unit, right) ||
      left.value === right.value || formatComparisonValue(row, left) === formatComparisonValue(row, right)) {
    return null;
  }
  if (row.unit === "%" && left.samples?.total !== right.samples?.total) return null;
  const lower = row.preference === "lower";
  return (lower ? left.value < right.value : left.value > right.value) ? "no-cache" : "cache";
}

export function formatComparisonValue(row: ComparisonRow, value: ComparisonValue) {
  if (value.value === null) return value.text;
  if (!isValidComparisonValue(row.unit, value)) return "—";
  return `${value.text}${row.unit === "%" ? "" : " "}${row.unit}`;
}

export function getDemoComparisonRows(summaries: Record<ChatBranch, BranchSummary>): ComparisonRow[] {
  const unknown = (text: string): ComparisonValue => ({ text, value: null });
  const usage = (value: number | null): ComparisonValue => ({ text: value === null ? "—" : String(value), value });
  const row = (
    key: string,
    label: string,
    unit: ComparisonRow["unit"],
    left: ComparisonValue,
    right: ComparisonValue = left,
    preference: ComparisonRow["preference"] = null,
  ): ComparisonRow => ({
    key, label, unit, preference, comparable: false,
    values: { "no-cache": left, cache: right },
  });
  // Demo usage is known to be zero, but it is not a comparable AI/cache run.
  return [
    row("latency", "Độ trễ", "ms", unknown("Chưa đo"), unknown("Chưa đo"), "lower"),
    row("llmCalls", "Lượt gọi LLM", "lượt", usage(summaries["no-cache"].llmCalls), usage(summaries.cache.llmCalls), "lower"),
    row("llmTokens", "Token LLM", "token", usage(summaries["no-cache"].llmTokens), usage(summaries.cache.llmTokens), "lower"),
    row("quality", "Câu trả lời đạt yêu cầu", "%", unknown("Chưa chấm"), unknown("Chưa chấm"), "higher"),
    row("disclosure", "Rò rỉ thông tin", "%", unknown("Chưa kiểm thử"), unknown("Chưa kiểm thử"), "lower"),
    row("falseDenial", "Từ chối nhầm", "%", unknown("Chưa kiểm thử"), unknown("Chưa kiểm thử"), "lower"),
  ];
}
