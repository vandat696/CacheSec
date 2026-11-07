import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ChatProvider } from "@/features/chat/ChatProvider";
import { DocumentsProvider } from "@/features/documents/DocumentsProvider";
import { ExperimentConfigProvider } from "@/features/experiment-config/ExperimentConfigProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CacheSec",
  description: "Secure Local Semantic Cache cho quy trình phát triển phần mềm có AI hỗ trợ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="nui-theme">
      <body>
        <ChatProvider>
          <DocumentsProvider>
            <ExperimentConfigProvider><AppShell>{children}</AppShell></ExperimentConfigProvider>
          </DocumentsProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
