import { simple } from "./exampleCode";
export const selectTemplate = {
  name: "Select",
  source: "src/components/ui/forms/Select.tsx",
  group: "controls",
  description: "Danh sách lựa chọn",
  variants: "single select",
  options: {
    label: "Ngôn ngữ",
    value: "vi",
    options: [
      {
        value: "vi",
        label: "Tiếng Việt",
      },
      {
        value: "en",
        label: "English",
      },
    ],
  },
  example: simple(
    "forms/Select",
    "Select",
    '<Select label="Ngôn ngữ" defaultValue="vi" options={[{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }]} />',
  ),
} as const;
