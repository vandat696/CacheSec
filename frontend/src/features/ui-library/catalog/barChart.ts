import { simple } from "./exampleCode";
export const barChartTemplate = {
  name: "BarChart",
  source: "src/components/ui/charts/BarChart.tsx",
  group: "charts",
  description: "So sánh giá trị giữa các nhóm",
  variants: "data · empty",
  options: {
    title: "BarChart · Dữ liệu mẫu",
    unit: "token",
    data: [
      {
        label: "A",
        value: 4800,
      },
      {
        label: "B",
        value: 5200,
      },
      {
        label: "C",
        value: 4400,
      },
      {
        label: "D",
        value: 6600,
      },
    ],
  },
  example: simple(
    "charts/BarChart",
    "BarChart",
    '<BarChart title="Dữ liệu mẫu" unit="token" data={[{ label: "A", value: 4800 }, { label: "B", value: 5200 }]} />',
  ),
} as const;
