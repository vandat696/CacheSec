"use client";
import { type ReactNode } from "react";
export type FieldProps = {
  label: string;
  help?: string;
  error?: string;
};
export function Field({
  id,
  label,
  help,
  error,
  required,
  children,
}: FieldProps & {
  id: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="nui nui-theme nui-field">
      <label htmlFor={id}>
        {label}
        {required && " *"}
      </label>
      {children}
      <span className="nui-help" id={`${id}-help`}>
        {help}
      </span>
      <span
        className="nui-error"
        id={`${id}-error`}
        aria-live="polite"
        hidden={!error}
      >
        {error}
      </span>
    </div>
  );
}
