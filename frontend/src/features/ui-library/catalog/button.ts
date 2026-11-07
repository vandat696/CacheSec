import { simple } from "./exampleCode";
export const buttonTemplate = {
  name: "Button",
  source: "src/components/ui/Button.tsx",
  group: "controls",
  description: "Hành động",
  variants: "primary · secondary · tertiary · danger",
  options: {
    label: "Lưu thay đổi",
    variant: "primary",
  },
  example: simple(
    "Button",
    "Button",
    '<Button variant="primary">Lưu thay đổi</Button>',
  ),
} as const;
