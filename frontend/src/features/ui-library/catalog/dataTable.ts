import { simple } from "./exampleCode";
export const dataTableTemplate = {
  name: "DataTable",
  source: "src/components/ui/data/DataTable.tsx",
  group: "data",
  description: "Bảng dữ liệu có nhãn cột",
  variants: "data · empty",
  options: {
    caption: "Dữ liệu minh họa",
    columns: [
      {
        key: "name",
        label: "Tên",
      },
      {
        key: "value",
        label: "Giá trị",
      },
      {
        key: "status",
        label: "Trạng thái",
      },
    ],
    rows: [
      {
        name: "Mục A",
        value: 120,
        status: "Hoàn tất",
      },
      {
        name: "Mục B",
        value: 80,
        status: "Đang xử lý",
      },
    ],
  },
  example: simple(
    "data/DataTable",
    "DataTable",
    '<DataTable caption="Dữ liệu minh họa" columns={[{ key: "name", label: "Tên" }, { key: "value", label: "Giá trị" }]} rows={[{ name: "Mục A", value: 120 }]} />',
  ),
} as const;
