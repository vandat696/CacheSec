import type { ChatBranch, ChatTurn } from "./chat-state";

export const chatMetricDefinitions = [
  { key: "cacheStatus", label: "Cache Status", hint: "Hit / Miss / Rejected khi có kết quả cache thật" },
  { key: "responseTime", label: "Thời gian phản hồi" },
  { key: "llmCalls", label: "Lượt gọi LLM" },
  { key: "llmTokens", label: "Token LLM" },
  { key: "permission", label: "Kiểm tra quyền", hint: "ALLOW / DENY từ backend" },
] as const;

type MetricValues = Record<(typeof chatMetricDefinitions)[number]["key"], string>;

// Presentation for the current demo only, not an API or authorization result.
// The demo never calls an LLM; its delay is not real response-time telemetry.
export function getDemoMetricValues(
  turn: ChatTurn | undefined,
  branch: ChatBranch,
): MetricValues {
  const placeholder = turn ? "Không chạy" : "—";
  if (!turn?.branches[branch]) {
    return {
      cacheStatus: placeholder,
      responseTime: placeholder,
      llmCalls: placeholder,
      llmTokens: placeholder,
      permission: placeholder,
    };
  }
  return {
    cacheStatus: branch === "no-cache" ? "Không áp dụng" : "Chưa xác định",
    responseTime: "Chưa đo",
    llmCalls: "0",
    llmTokens: "0",
    permission: "Chưa xác minh",
  };
}
