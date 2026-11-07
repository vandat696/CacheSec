"use client";
import { type InputHTMLAttributes } from "react";
export function Checkbox({
  label,
  ...props
}: {
  label: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="nui nui-theme nui-check">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
