import { simple } from "./exampleCode";
export const badgeTemplate = {
  name: "Badge",
  source: "src/components/ui/feedback/Badge.tsx",
  group: "feedback",
  description: "Nhãn trạng thái ngắn",
  variants: "primary · success · danger · neutral",
  options: {
    label: "Đã lưu",
    tone: "success",
  },
  example: simple(
    "feedback/Badge",
    "Badge",
    '<Badge tone="success">Đã lưu</Badge>',
  ),
} as const;
