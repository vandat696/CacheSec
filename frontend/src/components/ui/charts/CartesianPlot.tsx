"use client";
import type { ChartDatum } from "./chartTypes";
import { compact } from "./chartFormat";
export function CartesianPlot({
  data,
  kind,
}: {
  data: readonly ChartDatum[];
  kind: "line" | "bar";
}) {
  const max = Math.max(...data.map((row) => row.value), 1);
  const step = 10 ** Math.floor(Math.log10(max));
  const ceiling = Math.ceil(max / step) * step;
  const left = 80,
    right = 616,
    top = 24,
    bottom = 216,
    slot = (right - left) / data.length;
  const points = data.map((row, index) => [
    kind === "bar"
      ? left + slot * (index + 0.5)
      : data.length === 1
        ? (left + right) / 2
        : left + (index * (right - left)) / (data.length - 1),
    bottom - (row.value / ceiling) * (bottom - top),
  ]);
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => {
        const y = bottom - (index * (bottom - top)) / 4;
        return (
          <g key={index}>
            <line x1={left} y1={y} x2={right} y2={y} className="nui-gridline" />
            <text x={left - 12} y={y + 5} textAnchor="end">
              {compact.format((ceiling * index) / 4)}
            </text>
          </g>
        );
      })}
      {kind === "line" && (
        <polyline
          points={points.map((point) => point.join(",")).join(" ")}
          className="nui-data-line"
        />
      )}
      {data.map((row, index) => {
        const [x, y] = points[index];
        const title = <title>{`${row.label}: ${row.value}`}</title>;
        const label =
          data.length <= 8 && row.label.length <= 10
            ? row.label
            : String(index + 1);
        return (
          <g key={index}>
            {kind === "line" ? (
              <circle cx={x} cy={y} r="4" className="nui-chart-point">
                {title}
              </circle>
            ) : (
              <rect
                x={x - slot * 0.3}
                y={y}
                width={slot * 0.6}
                height={bottom - y}
                className="nui-data-bar"
              >
                {title}
              </rect>
            )}
            {(data.length <= 8 ||
              index % Math.ceil(data.length / 8) === 0 ||
              index === data.length - 1) && (
              <text x={x} y="248" textAnchor="middle">
                {label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
