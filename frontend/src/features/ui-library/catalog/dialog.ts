import { controlled } from "./exampleCode";
export const dialogTemplate = {
  name: "Dialog",
  source: "src/components/ui/feedback/Dialog.tsx",
  group: "feedback",
  description: "Hộp thoại cần xác nhận",
  variants: "open · close · confirm",
  options: {
    title: "Lưu thay đổi?",
    description: "Ví dụ hộp thoại với hành động xác nhận và đường quay lại.",
    confirmLabel: "Lưu",
  },
  example: controlled(
    "feedback/Dialog",
    "Dialog",
    "const [open, setOpen] = useState(false);",
    '<><button type="button" onClick={() => setOpen(true)}>Mở Dialog</button><Dialog open={open} title="Lưu thay đổi?" onClose={() => setOpen(false)} onConfirm={() => setOpen(false)}>Ví dụ xác nhận tại giao diện.</Dialog></>',
  ),
} as const;
