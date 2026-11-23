import { branchMetrics, type Branch } from "../comparisons/comparisonModel.ts";

const states: Record<string, string> = {
  ready: "Sẵn sàng", preparing: "Đang chuẩn bị", starting: "Đang bắt đầu", queued: "Đang chờ",
  generating: "Đang sinh mã", saving: "Đang lưu", testing: "Đang test", passed: "Test đạt",
  needs_input: "Cần xem xét", exhausted: "Hết lượt sửa", error: "Lỗi", timed_out: "Hết thời gian",
  cancelled: "Đã dừng", incomplete: "Chưa hoàn tất",
};
const outcomes: Record<string, string> = {
  not_applicable: "Không dùng", miss: "Miss", hit: "Verified Hit", rejected: "Rejected",
  client_storage_error: "Lỗi storage",
};
const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("vi-VN");
const duration = (value: number | null | undefined) => value == null ? "—" : `${(value / 1000).toFixed(2)} s`;

export function workspaceMetricValues(branch: Branch): string[] {
  const metrics = branchMetrics(branch);
  return [
    states[branch.status] ?? branch.status,
    branch.error_code ?? branch.run?.error_code ?? "—",
    branch.context ? outcomes[branch.context.outcome] ?? branch.context.outcome : "—",
    duration(branch.server_workflow_ms),
    duration(branch.context_request?.preparation_ms),
    duration(branch.context?.resolution_ms),
    duration(branch.context?.embedding_ms),
    duration(metrics.generationMs),
    branch.run ? number(metrics.generationAttempts) : "—",
    number(branch.context?.embedding_calls),
    number(metrics.usage?.input_tokens), number(metrics.usage?.output_tokens),
  ];
}

export const workspaceMetricLabels = [
  "Trạng thái", "Mã lỗi", "Context Cache", "Workflow server", "Chuẩn bị context",
  "Resolve context", "Embedding", "Sinh mã", "Lần thử sinh mã", "Lượt embedding",
  "Token vào · phản hồi đã ghi", "Token ra · phản hồi đã ghi",
];
