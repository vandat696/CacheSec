import { simple } from "./exampleCode";
export const progressBarTemplate = {
  name: "ProgressBar",
  source: "src/components/ui/data/ProgressBar.tsx",
  group: "data",
  description: "Giá trị hiện tại so với giới hạn",
  variants: "value · max · unit",
  options: {
    label: "Mức sử dụng",
    value: 42000,
    max: 60000,
    unit: "token",
  },
  example: simple(
    "data/ProgressBar",
    "ProgressBar",
    '<ProgressBar label="Mức sử dụng" value={42000} max={60000} unit="token" />',
  ),
} as const;
