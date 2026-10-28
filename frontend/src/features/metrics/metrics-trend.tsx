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

export function MetricsTrendPlot({ points, unit, selectedQuery, onSelect }: {
  points: readonly QueryTrendPoint[];
  unit: string;
  selectedQuery: number;
  onSelect?: (query: number) => void;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [activeQuery, setActiveQuery] = useState<number | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(240, Math.floor(element.clientWidth))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const left = 56, right = width - 16, top = 36, bottom = 320;
  const series = branches.map((branch) => ({ branch, segments: getTrendSegments(points, branch) }));
  const values = series.flatMap(({ segments }) => segments.flatMap((segment) => segment.map(({ value }) => value)));
  const hasData = values.length > 0;
  const peak = values.reduce((maximum, value) => Math.max(maximum, value), 1);
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const maximum = Math.ceil(peak * 1.1 / magnitude) * magnitude;
  const count = points.length;
  const x = (query: number) => left + query / Math.max(count, 1) * (right - left);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const ticks = [...new Set([0, ...Array.from({ length: width < 440 ? 3 : 5 }, (_, index) => Math.ceil(count * (index + 1) / (width < 440 ? 3 : 5)))])];
  const activePoint = points.find((point) => point.query === activeQuery);
  const cursorQuery = activePoint?.query ?? selectedQuery;
  return (
    <div className="metrics-trend-plot" ref={container}>
      <svg viewBox={`0 0 ${width} 376`} role="img" aria-labelledby={`${id}-title ${id}-description`}
        onPointerLeave={() => setActiveQuery(null)}
        onPointerMove={(event) => {
          if (!count || !hasData) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const position = (event.clientX - bounds.left) / bounds.width * width;
          const query = Math.max(1, Math.min(count, Math.round((position - left) / (right - left) * count)));
          setActiveQuery(query);
        }}
        onPointerDown={(event) => {
          if (!count || !hasData) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const position = (event.clientX - bounds.left) / bounds.width * width;
          const query = Math.max(1, Math.min(count, Math.round((position - left) / (right - left) * count)));
          setActiveQuery(query);
          onSelect?.(query);
        }}>
        <title id={`${id}-title`}>{`Hiệu suất theo ${count} truy vấn · ${unit}`}</title>
        <desc id={`${id}-description`}>Hai nhánh Không cache và Cache vẽ nét liền; đoạn trùng xen kẽ hai màu. Khoảng thiếu dữ liệu không được nối thành đường. Dùng thanh chọn truy vấn phía dưới để đọc giá trị.</desc>
        <defs>
          <linearGradient id={`${id}-shared-point`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="50%" stopColor="var(--metrics-baseline)" />
            <stop offset="50%" stopColor="var(--metrics-cache)" />
          </linearGradient>
          <mask id={`${id}-overlap`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height="376">
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
            {hasData && <text x={left - 10} y={top + tick * (bottom - top) / 4 + 4} textAnchor="end" className="metrics-axis-label">{(maximum * (1 - tick / 4)).toLocaleString("vi-VN", { notation: "compact", maximumFractionDigits: 1 })}</text>}
          </g>
        ))}
        {ticks.map((tick) => <text key={tick} x={x(tick)} y={bottom + 22} textAnchor="middle" className="metrics-axis-label">{tick}</text>)}
        <text x={left} y="15" className="metrics-axis-label">{unit} / truy vấn</text>
        <text x={(left + right) / 2} y="366" textAnchor="middle" className="metrics-axis-label">Số truy vấn</text>
        {cursorQuery > 0 && <line x1={x(cursorQuery)} x2={x(cursorQuery)} y1={top} y2={bottom} className="metrics-trend-cursor" />}
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
                    ? { fill: `url(#${id}-shared-point)` } : undefined}>
                  <title>{`${branchLabels[branch]} · truy vấn ${point.query}: ${point.value} ${unit}`}</title>
                </circle>)}
              </g>
            ))}
          </g>
        ))}
        {!hasData && <text x={(left + right) / 2} y={(top + bottom) / 2} textAnchor="middle" className="metrics-trend-empty">{count ? "Chưa có số đo" : "Chưa có truy vấn"}</text>}
      </svg>
      {activePoint && hasData && <div className="metrics-trend-tooltip" role="status"
        style={{ left: Math.max(4, Math.min(width - 224, x(activePoint.query) + 12)) }}>
        <span>Truy vấn {activePoint.query}</span>
        {branches.map((branch) => <div key={branch}>
          <i className={`metrics-key ${branch}`} /><span>{branchLabels[branch]}</span>
          <strong>{pointValue(activePoint, branch, unit)}</strong>
        </div>)}
      </div>}
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
      <MetricsTrendPlot points={points} unit={definition.unit} selectedQuery={selectedQuery} onSelect={setSelection} />
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
