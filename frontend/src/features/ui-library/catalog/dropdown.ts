import { controlled } from "./exampleCode";
export const dropdownTemplate = {
  name: "Dropdown",
  source: "src/components/ui/navigation/Dropdown.tsx",
  group: "navigation",
  description: "Menu thao tác",
  variants: "open · closed · keyboard",
  options: {
    label: "Tùy chọn",
    items: [
      {
        value: "duplicate",
        label: "Tạo bản sao",
      },
      {
        value: "details",
        label: "Xem chi tiết",
      },
    ],
  },
  example: controlled(
    "navigation/Dropdown",
    "Dropdown",
    'const [choice, setChoice] = useState("Chưa chọn");',
    '<Dropdown label={choice} items={[{ value: "duplicate", label: "Tạo bản sao" }]} onSelect={setChoice} />',
  ),
} as const;
