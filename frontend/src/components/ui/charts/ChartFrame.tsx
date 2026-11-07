"use client";
import { useId } from "react";
import { DataTable } from "../data/DataTable";
import type { ChartProps } from "./chartTypes";
import { format } from "./chartFormat";
import { percent } from "./chartFormat";
import { colors } from "./chartFormat";
import { DonutPlot } from "./DonutPlot";
import { CartesianPlot } from "./CartesianPlot";
export function ChartFrame({
  kind,
  title,
  unit,
  data,
}: ChartProps & {
  kind: "line" | "bar" | "donut";
}) {
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
              <DonutPlot data={clean} unit={unit} />
            ) : (
              <CartesianPlot data={clean} kind={kind} />
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
