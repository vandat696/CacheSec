"use client";
import type { ChartProps } from "./chartTypes";
import { ChartFrame } from "./ChartFrame";
export function LineChart(props: ChartProps) {
  return <ChartFrame {...props} kind="line" />;
}
