import { simple } from "./exampleCode";
export const numberInputTemplate = {
  name: "NumberInput",
  source: "src/components/ui/forms/NumberInput.tsx",
  group: "controls",
  description: "Giá trị số có giới hạn",
  variants: "min · max · step · error",
  options: {
    label: "Giới hạn token",
    value: 2048,
    min: 256,
    max: 8192,
    step: 256,
    help: "256–8.192, bước 256.",
    error: "Nhập bội số của 256 trong khoảng 256–8.192.",
  },
  example: simple(
    "forms/NumberInput",
    "NumberInput",
    '<NumberInput label="Giới hạn token" defaultValue={2048} min={256} max={8192} step={256} required />',
  ),
} as const;
