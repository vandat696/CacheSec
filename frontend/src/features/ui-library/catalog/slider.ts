import { controlled } from "./exampleCode";
export const sliderTemplate = {
  name: "Slider",
  source: "src/components/ui/forms/Slider.tsx",
  group: "controls",
  description: "Thanh trượt và ô số đồng bộ",
  variants: "range · number · validation",
  options: {
    label: "Temperature",
    value: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
    help: "Dải giá trị minh họa, đối chiếu API trước khi dùng.",
  },
  example: controlled(
    "forms/Slider",
    "Slider",
    "const [value, setValue] = useState(0.7);",
    '<Slider label="Temperature" value={value} onChange={setValue} min={0} max={2} step={0.1} />',
  ),
} as const;
