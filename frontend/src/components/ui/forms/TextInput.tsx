"use client";
import { type InputHTMLAttributes } from "react";
import type { FieldProps } from "./Field";
import { Field } from "./Field";
import { useField } from "./useField";
export type TextInputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;
export function TextInput({
  label,
  help,
  error,
  id,
  ...props
}: TextInputProps) {
  const field = useField(id, error);
  return (
    <Field
      id={field.id}
      label={label}
      help={help}
      error={field.error}
      required={props.required}
    >
      <input {...field.controlProps} {...props} />
    </Field>
  );
}
