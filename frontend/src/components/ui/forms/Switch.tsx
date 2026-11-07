"use client";
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
