import type { ChatBranch } from "../chat/chat-state";
import type { BranchSummary } from "./metrics-model";

export type ComparisonValue = { text: string; value: number | null };
export type ComparisonRow = {
  key: string;
  label: string;
  preference: "lower" | "higher" | null;
  // Presentation eligibility, not proof of comparable runs or an API contract.
  // The caller must establish equivalent measurements before enabling this.
  comparable: boolean;
  values: Record<ChatBranch, ComparisonValue>;
};

export function getBetterBranch(row: ComparisonRow): ChatBranch | null {
  const left = row.values["no-cache"].value;
  const right = row.values.cache.value;
  if (!row.comparable || !row.preference || left === null || right === null ||
      !Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right < 0 || left === right) {
    return null;
  }
  const lower = row.preference === "lower";
  return (lower ? left < right : left > right) ? "no-cache" : "cache";
}

export function getDemoComparisonRows(summaries: Record<ChatBranch, BranchSummary>): ComparisonRow[] {
  const unknown = (text: string): ComparisonValue => ({ text, value: null });
  const usage = (value: number | null): ComparisonValue => ({ text: value === null ? "—" : String(value), value });
  const row = (
    key: string,
    label: string,
    left: ComparisonValue,
    right: ComparisonValue = left,
    preference: ComparisonRow["preference"] = null,
  ): ComparisonRow => ({
    key, label, preference, comparable: false,
    values: { "no-cache": left, cache: right },
  });
  // Demo usage is known to be zero, but it is not a comparable AI/cache run.
  return [
    row("latency", "Độ trễ", unknown("Chưa đo"), unknown("Chưa đo"), "lower"),
    row("llmCalls", "Lượt gọi LLM", usage(summaries["no-cache"].llmCalls), usage(summaries.cache.llmCalls), "lower"),
    row("llmTokens", "Token LLM", usage(summaries["no-cache"].llmTokens), usage(summaries.cache.llmTokens), "lower"),
    row("cacheStatus", "Cache Status", unknown("Không áp dụng"), unknown("Chưa xác định")),
    row("permission", "Kiểm tra quyền", unknown("Chưa xác minh")),
    row("quality", "Chất lượng câu trả lời", unknown("Chưa chấm"), unknown("Chưa chấm"), "higher"),
    row("falseHit", "Semantic false hit", unknown("Không áp dụng"), unknown("Chưa chấm")),
    row("disclosure", "Rò rỉ thông tin", unknown("Chưa kiểm thử"), unknown("Chưa kiểm thử"), "lower"),
    row("falseDenial", "Từ chối nhầm", unknown("Chưa kiểm thử"), unknown("Chưa kiểm thử"), "lower"),
  ];
}
