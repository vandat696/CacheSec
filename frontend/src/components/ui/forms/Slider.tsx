"use client";
import { useId, useState } from "react";
import type { FieldProps } from "./Field";
import { Field } from "./Field";
import { useField } from "./useField";
export function Slider({
  label,
  help,
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onChange,
}: FieldProps & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  // Keep a draft so clearing or typing an invalid number does not reset the input.
  const [draft, setDraft] = useState({ text: String(value), baseValue: value });
  const field = useField(id, `Nhập số từ ${min} đến ${max}, bước ${step}.`);
  return (
    <Field id={id} label={label} help={help} error={field.error}>
      <div className="nui-slider-controls">
        <input
          id={id}
          className="nui-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-describedby={`${id}-help`}
          onChange={(event) => {
            setDraft({
              text: event.target.value,
              baseValue: event.target.valueAsNumber,
            });
            onChange(event.target.valueAsNumber);
          }}
        />
        <input
          {...field.controlProps}
          id={`${id}-number`}
          aria-label={`${label} · giá trị`}
          type="number"
          required
          min={min}
          max={max}
          step={step}
          value={draft.baseValue === value ? draft.text : String(value)}
          disabled={disabled}
          onChange={(event) => {
            setDraft({ text: event.target.value, baseValue: value });
            if (event.target.validity.valid)
              onChange(event.target.valueAsNumber);
          }}
        />
      </div>
    </Field>
  );
}
