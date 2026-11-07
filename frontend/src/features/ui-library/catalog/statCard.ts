import { simple } from "./exampleCode";
export const statCardTemplate = {
  name: "StatCard",
  source: "src/components/ui/data/StatCard.tsx",
  group: "data",
  description: "Một chỉ số và chú thích",
  variants: "value · unit · description",
  options: {
    label: "Tổng số bản ghi",
    value: "840",
    description: "Dữ liệu minh họa",
  },
  example: simple(
    "data/StatCard",
    "StatCard",
    '<StatCard label="Tổng số bản ghi" value="840" description="Dữ liệu minh họa" />',
  ),
} as const;
