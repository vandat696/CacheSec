"use client";
export function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <article className="nui nui-theme nui-surface nui-stat">
      <span className="nui-help">{label}</span>
      <strong className="nui-value">{value}</strong>
      <span className="nui-help">{description}</span>
    </article>
  );
}
