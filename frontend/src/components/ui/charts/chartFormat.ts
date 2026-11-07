export const format = new Intl.NumberFormat("vi-VN");
export const compact = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const percent = (value: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value * 100)}%`;
export const colors = [
  "var(--nui-primary)",
  "var(--nui-muted)",
  "var(--nui-danger)",
  "var(--nui-success)",
];
