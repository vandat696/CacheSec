"use client";
import { type SelectHTMLAttributes } from "react";
import type { FieldProps } from "./Field";
import { Field } from "./Field";
import { useField } from "./useField";
export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export function Select({
  label,
  help,
  error,
  id,
  options,
  ...props
}: FieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: readonly SelectOption[];
  }) {
  const field = useField(id, error);
  return (
    <Field
      id={field.id}
      label={label}
      help={help}
      error={field.error}
      required={props.required}
    >
      <select {...field.controlProps} {...props}>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
