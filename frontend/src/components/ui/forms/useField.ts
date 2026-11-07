"use client";
import { useId, useState } from "react";
type Control =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export function useField(id: string | undefined, error: string | undefined) {
  const generatedId = useId();
  const [invalid, setInvalid] = useState(false);
  const fieldId = id ?? generatedId;
  return {
    id: fieldId,
    error: invalid
      ? (error ?? "Kiểm tra giá trị và giới hạn của trường này.")
      : undefined,
    controlProps: {
      id: fieldId,
      className: "nui-input",
      "aria-describedby": `${fieldId}-help ${fieldId}-error`,
      "aria-invalid": invalid,
      onBlur: (event: React.FocusEvent<Control>) =>
        setInvalid(!event.currentTarget.validity.valid),
      onInvalid: () => setInvalid(true),
      onInput: (event: React.FormEvent<Control>) => {
        if (invalid) setInvalid(!event.currentTarget.validity.valid);
      },
    },
  };
}
