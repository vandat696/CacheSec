import type { TemplateName } from "./catalog-data";

const simple = (module: string, name: string, jsx: string) =>
  `import { ${name} } from "@/components/ui/${module}";\n\nexport function Example() {\n  return (${jsx});\n}`;
const controlled = (module: string, name: string, state: string, jsx: string) =>
  `"use client";\n\nimport { useState } from "react";\nimport { ${name} } from "@/components/ui/${module}";\n\nexport function Example() {\n  ${state}\n  return (${jsx});\n}`;

export const catalogExamples: Record<TemplateName, string> = {
  Button: simple(
    "button",
    "Button",
    '<Button variant="primary">Lưu thay đổi</Button>',
  ),
  TextInput: simple(
    "fields",
    "TextInput",
    '<TextInput label="Tên hiển thị" placeholder="Nhập tên" help="Nhãn luôn hiển thị." />',
  ),
  Textarea: simple(
    "fields",
    "Textarea",
    '<Textarea label="Nội dung" placeholder="Nhập nội dung…" />',
  ),
  Select: simple(
    "fields",
    "Select",
    '<Select label="Ngôn ngữ" defaultValue="vi" options={[{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }]} />',
  ),
  NumberInput: simple(
    "fields",
    "NumberInput",
    '<NumberInput label="Giới hạn token" defaultValue={2048} min={256} max={8192} step={256} required />',
  ),
  Slider: controlled(
    "fields",
    "Slider",
    "const [value, setValue] = useState(0.7);",
    '<Slider label="Temperature" value={value} onChange={setValue} min={0} max={2} step={0.1} />',
  ),
  Checkbox: simple(
    "fields",
    "Checkbox",
    '<Checkbox label="Ghi nhớ lựa chọn" defaultChecked />',
  ),
  Switch: controlled(
    "fields",
    "Switch",
    "const [checked, setChecked] = useState(true);",
    '<Switch label="Cho phép thông báo" checked={checked} onChange={setChecked} />',
  ),
  Tabs: simple(
    "navigation",
    "Tabs",
    '<Tabs label="Nhóm nội dung" items={[{ id: "general", label: "Tổng quan", content: "Nội dung tổng quan." }, { id: "details", label: "Chi tiết", content: "Nội dung chi tiết." }]} />',
  ),
  Dropdown: controlled(
    "navigation",
    "Dropdown",
    'const [choice, setChoice] = useState("Chưa chọn");',
    '<Dropdown label={choice} items={[{ value: "duplicate", label: "Tạo bản sao" }]} onSelect={setChoice} />',
  ),
  Badge: simple("feedback", "Badge", '<Badge tone="success">Đã lưu</Badge>'),
  Alert: simple(
    "feedback",
    "Alert",
    '<Alert title="Thông tin mẫu">Nội dung do ứng dụng truyền vào.</Alert>',
  ),
  Dialog: controlled(
    "feedback",
    "Dialog",
    "const [open, setOpen] = useState(false);",
    '<><button type="button" onClick={() => setOpen(true)}>Mở Dialog</button><Dialog open={open} title="Lưu thay đổi?" onClose={() => setOpen(false)} onConfirm={() => setOpen(false)}>Ví dụ xác nhận tại giao diện.</Dialog></>',
  ),
  Toast: `"use client";\n\n// AppShell đã cung cấp ToastProvider.\nimport { useToast } from "@/components/ui/feedback";\nimport { Button } from "@/components/ui/button";\n\nexport function Example() {\n  const showToast = useToast();\n  return <Button onClick={() => showToast("Đã lưu thay đổi mẫu.")}>Hiển thị Toast</Button>;\n}`,
  StatCard: simple(
    "data-display",
    "StatCard",
    '<StatCard label="Tổng số bản ghi" value="840" description="Dữ liệu minh họa" />',
  ),
  ProgressBar: simple(
    "data-display",
    "ProgressBar",
    '<ProgressBar label="Mức sử dụng" value={42000} max={60000} unit="token" />',
  ),
  DataTable: simple(
    "data-display",
    "DataTable",
    '<DataTable caption="Dữ liệu minh họa" columns={[{ key: "name", label: "Tên" }, { key: "value", label: "Giá trị" }]} rows={[{ name: "Mục A", value: 120 }]} />',
  ),
  LineChart: simple(
    "charts",
    "LineChart",
    '<LineChart title="Dữ liệu mẫu" unit="lượt" data={[{ label: "T2", value: 96 }, { label: "T3", value: 104 }]} />',
  ),
  BarChart: simple(
    "charts",
    "BarChart",
    '<BarChart title="Dữ liệu mẫu" unit="token" data={[{ label: "A", value: 4800 }, { label: "B", value: 5200 }]} />',
  ),
  DonutChart: simple(
    "charts",
    "DonutChart",
    '<DonutChart title="Dữ liệu mẫu" unit="Bản ghi" data={[{ label: "Hoàn tất", value: 75 }, { label: "Đang mở", value: 25 }]} />',
  ),
  FlowDiagram: controlled(
    "data-display",
    "FlowDiagram",
    'const [selectedId, setSelectedId] = useState("input");',
    '<FlowDiagram selectedId={selectedId} onSelect={setSelectedId} nodes={[{ id: "input", label: "Đầu vào", description: "Tiếp nhận dữ liệu." }, { id: "output", label: "Đầu ra", description: "Trả kết quả." }]} />',
  ),
};
