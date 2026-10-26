import { useId } from "react";
import { DataTable } from "./data-display";

export type ChartDatum = { label: string; value: number };
export type ChartProps = {
  title: string;
  unit?: string;
  data: readonly ChartDatum[];
};
const format = new Intl.NumberFormat("vi-VN");
const compact = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = (value: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value * 100)}%`;
const colors = [
  "var(--nui-primary)",
  "var(--nui-muted)",
  "var(--nui-danger)",
  "var(--nui-success)",
];

function Donut({ data, unit }: { data: readonly ChartDatum[]; unit?: string }) {
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

function Cartesian({
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

function Chart({
  kind,
  title,
  unit,
  data,
}: ChartProps & { kind: "line" | "bar" | "donut" }) {
  const id = useId();
  const clean = data.filter(
    (row) => Number.isFinite(row.value) && row.value >= 0,
  );
  const empty =
    !clean.length ||
    (kind === "donut" && clean.every((row) => row.value === 0));
  const total = clean.reduce((sum, row) => sum + row.value, 0);
  return (
    <figure className="nui nui-theme nui-chart-shell">
      <figcaption className="nui-label">{title}</figcaption>
      {empty ? (
        <p className="nui-empty">Chưa có dữ liệu để vẽ biểu đồ.</p>
      ) : (
        <>
          <svg
            className="nui-chart"
            viewBox={kind === "donut" ? "0 0 480 300" : "0 0 640 280"}
            role="img"
            aria-labelledby={`${id}-title ${id}-description`}
          >
            <title id={`${id}-title`}>{title}</title>
            <desc id={`${id}-description`}>
              Số liệu đầy đủ có trong bảng dữ liệu phía dưới.
            </desc>
            {kind === "donut" ? (
              <Donut data={clean} unit={unit} />
            ) : (
              <Cartesian data={clean} kind={kind} />
            )}
          </svg>
          {kind === "donut" ? (
            <ul className="nui-chart-legend">
              {clean.map((row, index) => (
                <li key={index}>
                  <span
                    className="nui-key"
                    style={{ background: colors[index % colors.length] }}
                  />
                  {row.label}: {format.format(row.value)} ·{" "}
                  {percent(row.value / total)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="nui-help">
              {unit && `Đơn vị: ${unit}. `}Xem đầy đủ nhãn trong bảng dữ liệu.
            </p>
          )}
          <details>
            <summary>Xem dữ liệu</summary>
            <DataTable
              caption={title}
              columns={[
                { key: "label", label: "Nhãn" },
                { key: "value", label: unit ?? "Giá trị" },
              ]}
              rows={clean}
            />
          </details>
        </>
      )}
    </figure>
  );
}

export function LineChart(props: ChartProps) {
  return <Chart {...props} kind="line" />;
}
export function BarChart(props: ChartProps) {
  return <Chart {...props} kind="bar" />;
}
export function DonutChart(props: ChartProps) {
  return <Chart {...props} kind="donut" />;
}
