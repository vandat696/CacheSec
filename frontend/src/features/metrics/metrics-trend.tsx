"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Select } from "@/components/ui/fields";
import type { ChatBranch } from "../chat/chat-state";
import { branches, branchLabels, BranchLegend } from "./metrics-charts";
import type { MetricsRow } from "./metrics-model";
import { getDemoQueryTrend, getTrendSegments, trendMetrics, type QueryTrendPoint, type TrendMetric } from "./metrics-trend-model";

function pointValue(point: QueryTrendPoint | undefined, branch: ChatBranch, unit: string) {
  if (!point) return "—";
  const result = point.branches[branch];
  if (!result) return "Không chạy";
  const value = point.values[branch];
  if (value !== null) return `${value} ${unit}`;
  if (result.status === "error") return "Lỗi phản hồi";
  if (result.status === "pending") return "Đang chờ";
  return "Chưa đo";
}

export function MetricsTrendPlot({ points, unit, selectedQuery }: {
  points: readonly QueryTrendPoint[];
  unit: string;
  selectedQuery: number;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(240, Math.floor(element.clientWidth))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const left = 48, right = width - 20, top = 28, bottom = 234;
  const series = branches.map((branch) => ({ branch, segments: getTrendSegments(points, branch) }));
  const values = series.flatMap(({ segments }) => segments.flatMap((segment) => segment.map(({ value }) => value)));
  const hasData = values.length > 0;
  const maximum = values.reduce((maximum, value) => Math.max(maximum, value), 1);
  const count = points.length;
  const x = (query: number) => left + query / Math.max(count, 1) * (right - left);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const ticks = [...new Set([0, ...Array.from({ length: width < 440 ? 3 : 5 }, (_, index) => Math.ceil(count * (index + 1) / (width < 440 ? 3 : 5)))])];
  return (
    <div className="metrics-trend-plot" ref={container}>
      <svg viewBox={`0 0 ${width} 290`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{`Hiệu suất theo ${count} truy vấn · ${unit}`}</title>
        <desc id={`${id}-description`}>Hai nhánh Không cache và Cache vẽ nét liền; đoạn trùng xen kẽ hai màu. Khoảng thiếu dữ liệu không được nối thành đường. Dùng thanh chọn truy vấn phía dưới để đọc giá trị.</desc>
        <defs>
          <linearGradient id={`${id}-shared-point`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="50%" stopColor="var(--metrics-baseline)" />
            <stop offset="50%" stopColor="var(--metrics-cache)" />
          </linearGradient>
          <mask id={`${id}-overlap`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height="290">
            <g fill="none" stroke="white" strokeWidth="2">
              {series[0].segments.filter((segment) => segment.length > 1).map((segment, index) => (
                <polyline key={index} points={segment.map((point) => `${x(point.query)},${y(point.value)}`).join(" ")} />
              ))}
            </g>
          </mask>
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={right} y1={top + tick * (bottom - top) / 4} y2={top + tick * (bottom - top) / 4} className="metrics-gridline" />
            {hasData && <text x={left - 10} y={top + tick * (bottom - top) / 4 + 4} textAnchor="end" className="metrics-axis-label">{Number((maximum * (1 - tick / 4)).toFixed(2))}</text>}
          </g>
        ))}
        {ticks.map((tick) => <text key={tick} x={x(tick)} y={bottom + 22} textAnchor="middle" className="metrics-axis-label">{tick}</text>)}
        <text x={left} y="15" className="metrics-axis-label">{unit} / truy vấn</text>
        <text x={(left + right) / 2} y="281" textAnchor="middle" className="metrics-axis-label">Số truy vấn</text>
        {selectedQuery > 0 && <line x1={x(selectedQuery)} x2={x(selectedQuery)} y1={top} y2={bottom} className="metrics-trend-cursor" />}
        {series.map(({ branch, segments }) => (
          <g className={`metrics-trend-series ${branch}`} key={branch} data-trend-branch={branch}>
            {segments.map((segment, index) => (
              <g key={index}>
                {segment.length > 1 && <polyline points={segment.map((point) => `${x(point.query)},${y(point.value)}`).join(" ")} />}
                {branch === "cache" && segment.length > 1 && (
                  <polyline className="metrics-trend-overlap" aria-hidden="true" mask={`url(#${id}-overlap)`}
                    points={segment.map((point) => `${x(point.query)},${y(point.value)}`).join(" ")} />
                )}
                {segment.map((point) => <circle key={point.query} cx={x(point.query)} cy={y(point.value)} r={4} data-query={point.query}
                  style={branch === "cache" && points.some((item) => item.query === point.query && item.values["no-cache"] === point.value)
                    ? { stroke: `url(#${id}-shared-point)` } : undefined}>
                  <title>{`${branchLabels[branch]} · truy vấn ${point.query}: ${point.value} ${unit}`}</title>
                </circle>)}
              </g>
            ))}
          </g>
        ))}
        {!hasData && <text x={(left + right) / 2} y={(top + bottom) / 2} textAnchor="middle" className="metrics-trend-empty">{count ? "Chưa có số đo" : "Chưa có truy vấn"}</text>}
      </svg>
    </div>
  );
}

export function MetricsTrend({ rows, trends }: { rows: readonly MetricsRow[]; trends?: Record<TrendMetric, QueryTrendPoint[]> }) {
  const id = useId();
  const [metric, setMetric] = useState<TrendMetric>("response");
  const [selection, setSelection] = useState<number | null>(null);
  const points = trends?.[metric] ?? getDemoQueryTrend(rows, metric);
  const definition = trendMetrics.find((item) => item.value === metric)!;
  const selectedQuery = selection === null ? points.length : Math.min(selection, points.length);
  const point = points[selectedQuery - 1];
  return (
    <section className="metrics-panel metrics-trend" aria-labelledby={`${id}-title`}>
      <div className="metrics-panel-heading">
        <h2 id={`${id}-title`}>Hiệu suất theo số truy vấn</h2>
        <Select id="metrics-chart-kind" label="Chỉ số biểu đồ" value={metric} options={trendMetrics}
          onChange={(event) => {
            const next = trendMetrics.find((item) => item.value === event.target.value);
            if (next) setMetric(next.value);
          }} />
      </div>
      <BranchLegend />
      <MetricsTrendPlot points={points} unit={definition.unit} selectedQuery={selectedQuery} />
      <div className="metrics-trend-inspector">
        <label htmlFor="metrics-query-index">{point ? `Truy vấn ${selectedQuery} / ${points.length}` : "Truy vấn"}</label>
        <input id="metrics-query-index" type="range" min={points.length ? 1 : 0} max={points.length || 0}
          step={1} value={selectedQuery} disabled={!points.length}
          onChange={(event) => setSelection(Number(event.target.value))} />
        <dl aria-live="polite">
          {branches.map((branch) => <div key={branch}><dt>{branchLabels[branch]}</dt><dd>{pointValue(point, branch, definition.unit)}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}
