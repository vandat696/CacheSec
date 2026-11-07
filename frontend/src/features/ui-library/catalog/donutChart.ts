import { simple } from "./exampleCode";
export const donutChartTemplate = {
  name: "DonutChart",
  source: "src/components/ui/charts/DonutChart.tsx",
  group: "charts",
  description: "Tỷ trọng của các nhóm trong tổng",
  variants: "data · empty · straight separators",
  options: {
    title: "DonutChart · Dữ liệu mẫu",
    unit: "Bản ghi",
    data: [
      {
        label: "Hoàn tất",
        value: 630,
      },
      {
        label: "Đang mở",
        value: 168,
      },
      {
        label: "Cần hỗ trợ",
        value: 42,
      },
    ],
  },
  example: simple(
    "charts/DonutChart",
    "DonutChart",
    '<DonutChart title="Dữ liệu mẫu" unit="Bản ghi" data={[{ label: "Hoàn tất", value: 75 }, { label: "Đang mở", value: 25 }]} />',
  ),
} as const;
