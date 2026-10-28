import type { ChatBranch, ChatTurn } from "../chat/chat-state";
import type { MetricsRow } from "./metrics-model";

export const trendMetrics = [
  { value: "response", label: "Độ trễ", unit: "ms" },
  { value: "calls", label: "Lượt gọi LLM", unit: "lượt gọi" },
  { value: "tokens", label: "Token LLM", unit: "token" },
] as const;
export type TrendMetric = (typeof trendMetrics)[number]["value"];
export type QueryTrendPoint = {
  query: number;
  turnId: string;
  branches: ChatTurn["branches"];
  values: Record<ChatBranch, number | null>;
};
export type TrendValue = { query: number; value: number };

// Query order is independent of conversation creation order. Failed/pending
// turns remain on the x axis; missing measurements are not converted to zero.
export function getDemoQueryTrend(rows: readonly MetricsRow[], metric: TrendMetric): QueryTrendPoint[] {
  return [...rows]
    .sort((left, right) => left.turn.sequence - right.turn.sequence)
    .map(({ turn }, index) => ({
      query: index + 1,
      turnId: turn.id,
      branches: turn.branches,
      values: {
        "no-cache": turn.branches["no-cache"] && metric !== "response" ? 0 : null,
        cache: turn.branches.cache && metric !== "response" ? 0 : null,
      },
    }));
}

export function getTrendSegments(points: readonly QueryTrendPoint[], branch: ChatBranch): TrendValue[][] {
  const segments: TrendValue[][] = [];
  let current: TrendValue[] = [];
  for (const point of points) {
    const value = point.values[branch];
    if (value === null || !Number.isFinite(value) || value < 0) {
      current = [];
      continue;
    }
    if (!current.length) segments.push(current);
    current.push({ query: point.query, value });
  }
  return segments;
}
