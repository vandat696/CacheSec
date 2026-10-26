"use client";

import { Fragment, useId } from "react";

export function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <article className="nui nui-theme nui-surface nui-stat">
      <span className="nui-help">{label}</span>
      <strong className="nui-value">{value}</strong>
      <span className="nui-help">{description}</span>
    </article>
  );
}

export function ProgressBar({
  label,
  value,
  max = 100,
  unit,
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
}) {
  const id = useId();
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const current = Number.isFinite(value)
    ? Math.max(0, Math.min(value, limit))
    : 0;
  const format = new Intl.NumberFormat("vi-VN");
  return (
    <div className="nui nui-theme nui-field">
      <label htmlFor={id}>{label}</label>
      <progress className="nui-progress" id={id} value={current} max={limit}>
        {Math.round((current / limit) * 100)}%
      </progress>
      <span className="nui-help">
        {format.format(current)} / {format.format(limit)} {unit} ·{" "}
        {Math.round((current / limit) * 100)}%
      </span>
    </div>
  );
}

export type TableColumn<T> = { key: keyof T; label: string };
export function DataTable<T extends object>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
}) {
  return (
    <div
      className="nui nui-theme nui-table-wrap"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="nui-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column, columnIndex) =>
                  columnIndex === 0 ? (
                    <th key={String(column.key)} scope="row">
                      {String(row[column.key] ?? "—")}
                    </th>
                  ) : (
                    <td key={String(column.key)}>
                      {String(row[column.key] ?? "—")}
                    </td>
                  ),
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="nui-empty">
                Chưa có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type FlowNode = {
  id: string;
  label: string;
  helper?: string;
  description?: string;
};
export function FlowDiagram({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: readonly FlowNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  return (
    <div className="nui nui-theme nui-flow">
      {nodes.length ? (
        <>
          <div className="nui-flow-track">
            {nodes.map((node, index) => (
              <Fragment key={node.id}>
                {index > 0 && (
                  <span className="nui-arrow" aria-hidden="true">
                    →
                  </span>
                )}
                <button
                  className="nui-node"
                  type="button"
                  aria-pressed={selected?.id === node.id}
                  onClick={() => onSelect(node.id)}
                >
                  <strong>{node.label}</strong>
                  <span>{node.helper}</span>
                </button>
              </Fragment>
            ))}
          </div>
          <div className="nui-flow-detail" role="status">
            <strong>{selected?.label}</strong>
            <p className="nui-help">{selected?.description}</p>
          </div>
        </>
      ) : (
        <p className="nui-empty">Chưa có bước xử lý.</p>
      )}
    </div>
  );
}
