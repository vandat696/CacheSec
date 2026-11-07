"use client";
import type { ChartDatum } from "./chartTypes";
import { format } from "./chartFormat";
import { percent } from "./chartFormat";
import { colors } from "./chartFormat";
export function DonutPlot({
  data,
  unit,
}: {
  data: readonly ChartDatum[];
  unit?: string;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  // Trigonometric results can differ slightly between Node and the browser.
  // Stable SVG coordinates keep server and client markup identical.
  const point = (radius: number, angle: number) => [
    Number((240 + radius * Math.cos(angle)).toFixed(4)),
    Number((150 + radius * Math.sin(angle)).toFixed(4)),
  ];
  const slices = data.map((row, index) => {
    const start =
      -Math.PI / 2 +
      data
        .slice(0, index)
        .reduce((sum, item) => sum + (item.value / total) * Math.PI * 2, 0);
    const share = row.value / total;
    return {
      ...row,
      share,
      start,
      end: start + share * Math.PI * 2,
      mid: start + share * Math.PI,
      color: colors[index % colors.length],
    };
  });
  return (
    <>
      {slices
        .filter((slice) => slice.share > 0)
        .map((slice, index) => {
          const { start, end, mid, share } = slice;
          const large = share > 0.5 ? 1 : 0;
          const path = `M ${point(110, start)} A 110 110 0 ${large} 1 ${point(110, end)} L ${point(64, end)} A 64 64 0 ${large} 0 ${point(64, start)} Z`;
          return (
            <g key={index}>
              {share === 1 ? (
                <circle
                  cx="240"
                  cy="150"
                  r="87"
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="46"
                />
              ) : (
                <path d={path} fill={slice.color}>
                  <title>{`${slice.label}: ${format.format(slice.value)} (${percent(share)})`}</title>
                </path>
              )}
              {share >= 0.12 && (
                <text
                  x={point(87, mid)[0]}
                  y={point(87, mid)[1] + 5}
                  textAnchor="middle"
                  className="nui-slice-number"
                >
                  {percent(share)}
                </text>
              )}
            </g>
          );
        })}
      {slices
        .filter((slice) => slice.share > 0 && slice.share < 1)
        .map((slice, index) => (
          <line
            key={index}
            x1={point(64, slice.start)[0]}
            y1={point(64, slice.start)[1]}
            x2={point(110, slice.start)[0]}
            y2={point(110, slice.start)[1]}
            stroke="var(--nui-surface)"
            strokeWidth="2"
          />
        ))}
      {[-1, 1].flatMap((side) => {
        const labels = slices
          .filter(
            (slice) =>
              slice.share > 0 &&
              slice.share < 0.12 &&
              (Math.cos(slice.mid) >= 0 ? 1 : -1) === side,
          )
          .sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
        return labels.map((slice, index) => {
          const p = point(111, slice.mid),
            q = point(124, slice.mid);
          const y =
            labels.length === 1
              ? Math.max(40, Math.min(260, q[1]))
              : 40 + (index * 220) / (labels.length - 1);
          const x = side === 1 ? 384 : 96;
          return (
            <g key={`${side}-${index}`}>
              <polyline
                points={`${p} ${q} ${side === 1 ? 376 : 104},${y}`}
                fill="none"
                stroke="var(--nui-muted)"
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={y - 4}
                textAnchor={side === 1 ? "start" : "end"}
                className="nui-callout-value"
              >
                {format.format(slice.value)}
              </text>
              <text
                x={x}
                y={y + 16}
                textAnchor={side === 1 ? "start" : "end"}
                className="nui-callout-percent"
              >
                {percent(slice.share)}
              </text>
            </g>
          );
        });
      })}
      <text x="240" y="149" textAnchor="middle" className="nui-center-number">
        {format.format(total)}
      </text>
      <text x="240" y="174" textAnchor="middle">
        {unit ?? "Tổng"}
      </text>
    </>
  );
}
