import { simple } from "./exampleCode";
export const checkboxTemplate = {
  name: "Checkbox",
  source: "src/components/ui/forms/Checkbox.tsx",
  group: "controls",
  description: "Lựa chọn độc lập",
  variants: "checked · unchecked · disabled",
  options: {
    label: "Ghi nhớ lựa chọn",
    checked: true,
  },
  example: simple(
    "forms/Checkbox",
    "Checkbox",
    '<Checkbox label="Ghi nhớ lựa chọn" defaultChecked />',
  ),
} as const;
