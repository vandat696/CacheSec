import { simple } from "./exampleCode";
export const textInputTemplate = {
  name: "TextInput",
  source: "src/components/ui/forms/TextInput.tsx",
  group: "controls",
  description: "Ô nhập một dòng",
  variants: "default · required · error",
  options: {
    label: "Tên hiển thị",
    placeholder: "Nhập tên",
    help: "Nhãn luôn hiển thị.",
  },
  example: simple(
    "forms/TextInput",
    "TextInput",
    '<TextInput label="Tên hiển thị" placeholder="Nhập tên" help="Nhãn luôn hiển thị." />',
  ),
} as const;
