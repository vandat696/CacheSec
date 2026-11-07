import { controlled } from "./exampleCode";
export const flowDiagramTemplate = {
  name: "FlowDiagram",
  source: "src/components/ui/diagrams/FlowDiagram.tsx",
  group: "diagrams",
  description: "Các bước xử lý và thông tin từng bước",
  variants: "selected · empty",
  options: {
    nodes: [
      {
        id: "input",
        label: "Đầu vào",
        helper: "Tiếp nhận dữ liệu",
        description: "Nhận dữ liệu do ứng dụng cung cấp.",
      },
      {
        id: "process",
        label: "Xử lý",
        helper: "Áp dụng logic",
        description: "Thực hiện bước xử lý của app. Template không gọi API.",
      },
      {
        id: "output",
        label: "Đầu ra",
        helper: "Trả kết quả",
        description: "Hiển thị kết quả sau xử lý.",
      },
    ],
  },
  example: controlled(
    "diagrams/FlowDiagram",
    "FlowDiagram",
    'const [selectedId, setSelectedId] = useState("input");',
    '<FlowDiagram selectedId={selectedId} onSelect={setSelectedId} nodes={[{ id: "input", label: "Đầu vào", description: "Tiếp nhận dữ liệu." }, { id: "output", label: "Đầu ra", description: "Trả kết quả." }]} />',
  ),
} as const;
