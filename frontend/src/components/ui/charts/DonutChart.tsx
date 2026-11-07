"use client";
import type { ChartProps } from "./chartTypes";
import { ChartFrame } from "./ChartFrame";
export function DonutChart(props: ChartProps) {
  return <ChartFrame {...props} kind="donut" />;
}
