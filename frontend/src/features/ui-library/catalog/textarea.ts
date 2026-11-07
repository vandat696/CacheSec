import { simple } from "./exampleCode";
export const textareaTemplate = {
  name: "Textarea",
  source: "src/components/ui/forms/Textarea.tsx",
  group: "controls",
  description: "Ô nhập nhiều dòng",
  variants: "default · disabled",
  options: {
    label: "Nội dung",
    placeholder: "Nhập nội dung…",
  },
  example: simple(
    "forms/Textarea",
    "Textarea",
    '<Textarea label="Nội dung" placeholder="Nhập nội dung…" />',
  ),
} as const;
