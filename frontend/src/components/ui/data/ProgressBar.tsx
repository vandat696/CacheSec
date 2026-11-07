"use client";
import { useId } from "react";
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
