export const toastTemplate = {
  name: "Toast",
  source: "src/components/ui/feedback/ToastProvider.tsx",
  group: "feedback",
  description: "Phản hồi ngắn sau thao tác",
  variants: "show · dismiss · timeout",
  options: {
    message: "Đã lưu thay đổi mẫu.",
    duration: 4000,
  },
  example: `"use client";\n\n// AppShell đã cung cấp ToastProvider.\nimport { useToast } from "@/components/ui/feedback/ToastProvider";\nimport { Button } from "@/components/ui/Button";\n\nexport function Example() {\n  const showToast = useToast();\n  return <Button onClick={() => showToast("Đã lưu thay đổi mẫu.")}>Hiển thị Toast</Button>;\n}`,
} as const;
