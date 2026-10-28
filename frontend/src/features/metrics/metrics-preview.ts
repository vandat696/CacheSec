import type { ChatBranch } from "../chat/chat-state";
import type { getDemoMetricValues } from "../chat/chat-metrics-model";
import type { ComparisonRow } from "./metrics-comparison-model";
import type { BranchSummary, MetricsRow } from "./metrics-model";
import type { QueryTrendPoint, TrendMetric } from "./metrics-trend-model";

// UI fixtures only. Never write these records into Chat, cache or evaluation data.
type SampleMeasurement = { response: number; calls: number; tokens: number };
type SampleQuery = MetricsRow & {
  sample: Record<ChatBranch, SampleMeasurement>;
  cacheOutcome: "Hit" | "Miss" | "Rejected";
  qualityPassed: boolean;
};
export type CacheCounts = { hit: number; miss: number; rejected: number };
export type MetricsPreview = ReturnType<typeof summarizePreview>;

const prompts = [
  "Điều kiện sử dụng lại câu trả lời từ cache là gì?",
  "Hệ thống kiểm tra quyền tài liệu như thế nào?",
  "TTL ảnh hưởng đến tính hợp lệ của cache ra sao?",
  "Khi tài liệu thay đổi, cache được xử lý thế nào?",
  "Tóm tắt các bước xác minh cache hợp lệ.",
  "Vì sao độ tương đồng không thay thế kiểm tra quyền?",
  "Cache giúp giảm số lượt gọi LLM thế nào?",
  "Những tiêu chí nào dùng để đánh giá chất lượng trả lời?",
] as const;

export const previewConversations = [
  { id: "sample-performance", title: "Hiệu suất & tái sử dụng" },
  { id: "sample-permissions", title: "Quyền & tính hợp lệ" },
] as const;

export const previewQueries: readonly SampleQuery[] = Array.from({ length: 24 }, (_, index) => {
  const conversation = previewConversations[index < 16 ? 0 : 1];
  const cacheOutcome = index === 12 || index === 22 ? "Rejected" : index < 4 || index % 7 === 0 ? "Miss" : "Hit";
  const response = 1480 + (index * 137 % 610);
  const tokens = 820 + (index * 73 % 430);
  const hit = cacheOutcome === "Hit";
  return {
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    ordinal: index < 16 ? index + 1 : index - 15,
    turn: {
      id: `sample-query-${index + 1}`, sequence: index + 1,
      prompt: prompts[index % prompts.length], mode: "compare",
      branches: { "no-cache": { status: "complete" }, cache: { status: "complete" } },
    },
    cacheOutcome,
    qualityPassed: index !== 9,
    sample: {
      "no-cache": { response, calls: 1, tokens },
      cache: { response: hit ? 110 + (index * 29 % 170) : response + 85, calls: hit ? 0 : 1, tokens: hit ? 0 : tokens },
    },
  };
});

const number = (value: number) => value.toLocaleString("vi-VN");
const percent = (value: number) => `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

export function summarizePreview(rows: readonly SampleQuery[]) {
  const total = rows.length;
  const cacheCounts: CacheCounts = {
    hit: rows.filter((row) => row.cacheOutcome === "Hit").length,
    miss: rows.filter((row) => row.cacheOutcome === "Miss").length,
    rejected: rows.filter((row) => row.cacheOutcome === "Rejected").length,
  };
  const summarize = (branch: ChatBranch): BranchSummary => ({
    total, complete: total, pending: 0, error: 0,
    llmCalls: total ? rows.reduce((sum, row) => sum + row.sample[branch].calls, 0) : null,
    llmTokens: total ? rows.reduce((sum, row) => sum + row.sample[branch].tokens, 0) : null,
  });
  const summaries = { "no-cache": summarize("no-cache"), cache: summarize("cache") };
  const latency = (branch: ChatBranch) => total ? rows.reduce((sum, row) => sum + row.sample[branch].response, 0) / total : null;
  const latencies = { "no-cache": latency("no-cache"), cache: latency("cache") };
  const quality = rows.filter((row) => row.qualityPassed).length;
  const qualityText = total ? `${percent(quality / total * 100)} · ${quality}/${total}` : "—";
  const zeroCases = (size: number) => size ? `0/${size}` : "—";
  const qualityValues = [qualityText, zeroCases(cacheCounts.hit), zeroCases(cacheCounts.rejected), zeroCases(total)];
  const measured = (value: number | null) => ({ text: value === null ? "—" : number(Math.round(value)), value });
  const ratio = (count: number, size: number): ComparisonRow["values"]["cache"] => size ? {
    text: (count / size * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }),
    value: count / size * 100, samples: { count, total: size },
  } : { text: "—", value: null };
  const comparisonRow = (key: string, label: string, unit: ComparisonRow["unit"], left: ComparisonRow["values"]["cache"], right = left, preference: ComparisonRow["preference"] = null): ComparisonRow => ({
    key, label, unit, values: { "no-cache": left, cache: right }, preference,
    comparable: total > 0 && preference !== null,
  });
  const comparison: ComparisonRow[] = [
    comparisonRow("latency", "Độ trễ", "ms", measured(latencies["no-cache"]), measured(latencies.cache), "lower"),
    comparisonRow("llmCalls", "Lượt gọi LLM", "lượt", measured(summaries["no-cache"].llmCalls), measured(summaries.cache.llmCalls), "lower"),
    comparisonRow("llmTokens", "Token LLM", "token", measured(summaries["no-cache"].llmTokens), measured(summaries.cache.llmTokens), "lower"),
    comparisonRow("quality", "Câu trả lời đạt yêu cầu", "%", ratio(quality, total), undefined, "higher"),
    comparisonRow("disclosure", "Rò rỉ thông tin", "%", ratio(0, cacheCounts.rejected), undefined, "lower"),
    comparisonRow("falseDenial", "Từ chối nhầm", "%", ratio(0, total), undefined, "lower"),
  ];
  const trend = (metric: TrendMetric): QueryTrendPoint[] => [...rows].sort((left, right) => left.turn.sequence - right.turn.sequence).map((row, index) => ({
    query: index + 1, turnId: row.turn.id, branches: row.turn.branches,
    values: { "no-cache": row.sample["no-cache"][metric], cache: row.sample.cache[metric] },
  }));
  const details: Record<string, Record<ChatBranch, ReturnType<typeof getDemoMetricValues>>> = {};
  for (const row of rows) {
    const detail = (branch: ChatBranch): ReturnType<typeof getDemoMetricValues> => ({
      cacheStatus: branch === "cache" ? row.cacheOutcome : "Không áp dụng",
      responseTime: `${number(row.sample[branch].response)} ms`,
      llmCalls: number(row.sample[branch].calls), llmTokens: number(row.sample[branch].tokens),
      permission: branch === "cache" && row.cacheOutcome === "Rejected" ? "Chặn cache · sinh lại" : "Đã kiểm tra (mẫu)",
    });
    details[row.turn.id] = { "no-cache": detail("no-cache"), cache: detail("cache") };
  }
  return {
    rows, summaries, latencies, cacheCounts, comparison, qualityValues, details,
    trends: { response: trend("response"), calls: trend("calls"), tokens: trend("tokens") },
    overview: {
      hitRate: total ? percent(cacheCounts.hit / total * 100) : "—",
      latencyReduction: latencies["no-cache"] ? percent((1 - latencies.cache! / latencies["no-cache"]) * 100) : "—",
      callsSaved: total ? number(summaries["no-cache"].llmCalls! - summaries.cache.llmCalls!) : "—",
      tokensSaved: total ? number(summaries["no-cache"].llmTokens! - summaries.cache.llmTokens!) : "—",
      violations: total ? "0" : "—",
    },
  };
}

export function getMetricsPreview(conversationId: string) {
  return summarizePreview(previewQueries.filter((row) => conversationId === "all" || row.conversationId === conversationId));
}
