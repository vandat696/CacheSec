import { simple } from "./exampleCode";
export const alertTemplate = {
  name: "Alert",
  source: "src/components/ui/feedback/Alert.tsx",
  group: "feedback",
  description: "Thông báo trong ngữ cảnh",
  variants: "status · alert",
  options: {
    title: "Thông tin mẫu",
    description:
      "Nội dung do app truyền vào. Không chứa logic nghiệp vụ cố định.",
  },
  example: simple(
    "feedback/Alert",
    "Alert",
    '<Alert title="Thông tin mẫu">Nội dung do ứng dụng truyền vào.</Alert>',
  ),
} as const;
