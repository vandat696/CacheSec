import { simple } from "./exampleCode";
export const tabsTemplate = {
  name: "Tabs",
  source: "src/components/ui/navigation/Tabs.tsx",
  group: "navigation",
  description: "Chuyển nội dung trong cùng ngữ cảnh",
  variants: "selected · keyboard",
  options: {
    label: "Nhóm nội dung",
    items: [
      {
        id: "general",
        label: "Tổng quan",
        content: "Nội dung tổng quan của template.",
      },
      {
        id: "details",
        label: "Chi tiết",
        content: "Nội dung chi tiết. Dùng phím mũi tên để chuyển tab.",
      },
    ],
  },
  example: simple(
    "navigation/Tabs",
    "Tabs",
    '<Tabs label="Nhóm nội dung" items={[{ id: "general", label: "Tổng quan", content: "Nội dung tổng quan." }, { id: "details", label: "Chi tiết", content: "Nội dung chi tiết." }]} />',
  ),
} as const;
