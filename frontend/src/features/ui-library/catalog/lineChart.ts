import { simple } from "./exampleCode";
export const lineChartTemplate = {
  name: "LineChart",
  source: "src/components/ui/charts/LineChart.tsx",
  group: "charts",
  description: "Xu hướng theo thứ tự dữ liệu",
  variants: "data · empty",
  options: {
    title: "LineChart · Dữ liệu mẫu",
    unit: "lượt",
    data: [
      {
        label: "T2",
        value: 96,
      },
      {
        label: "T3",
        value: 104,
      },
      {
        label: "T4",
        value: 88,
      },
      {
        label: "T5",
        value: 132,
      },
      {
        label: "T6",
        value: 120,
      },
      {
        label: "T7",
        value: 140,
      },
      {
        label: "CN",
        value: 160,
      },
    ],
  },
  example: simple(
    "charts/LineChart",
    "LineChart",
    '<LineChart title="Dữ liệu mẫu" unit="lượt" data={[{ label: "T2", value: 96 }, { label: "T3", value: 104 }]} />',
  ),
} as const;
