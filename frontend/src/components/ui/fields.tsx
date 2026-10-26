"use client";

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldProps = { label: string; help?: string; error?: string };
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function useField(id: string | undefined, error: string | undefined) {
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

function Field({
  id,
  label,
  help,
  error,
  required,
  children,
}: FieldProps & { id: string; required?: boolean; children: ReactNode }) {
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

export function NumberInput(props: Omit<TextInputProps, "type">) {
  return <TextInput {...props} type="number" />;
}

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

export type SelectOption = { value: string; label: string; disabled?: boolean };
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

export function Checkbox({
  label,
  ...props
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="nui nui-theme nui-check">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="nui nui-theme nui-switch"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="nui-switch-track" aria-hidden="true">
        <span className="nui-switch-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

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
