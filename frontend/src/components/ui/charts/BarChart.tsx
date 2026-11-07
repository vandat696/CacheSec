"use client";
import type { ChartProps } from "./chartTypes";
import { ChartFrame } from "./ChartFrame";
export function BarChart(props: ChartProps) {
  return <ChartFrame {...props} kind="bar" />;
}
