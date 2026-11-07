import { controlled } from "./exampleCode";
export const switchTemplate = {
  name: "Switch",
  source: "src/components/ui/forms/Switch.tsx",
  group: "controls",
  description: "Bật hoặc tắt một tùy chọn",
  variants: "on · off · disabled",
  options: {
    label: "Cho phép thông báo",
    checked: true,
  },
  example: controlled(
    "forms/Switch",
    "Switch",
    "const [checked, setChecked] = useState(true);",
    '<Switch label="Cho phép thông báo" checked={checked} onChange={setChecked} />',
  ),
} as const;
