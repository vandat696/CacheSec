"use client";
import { type TextareaHTMLAttributes } from "react";
import type { FieldProps } from "./Field";
import { Field } from "./Field";
import { useField } from "./useField";
export function Textarea({
  label,
  help,
  error,
  id,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useField(id, error);
  return (
    <Field
      id={field.id}
      label={label}
      help={help}
      error={field.error}
      required={props.required}
    >
      <textarea {...field.controlProps} {...props} />
    </Field>
  );
}
