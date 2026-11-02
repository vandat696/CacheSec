import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { ChatProvider } from "@/features/chat/chat-provider";
import { DocumentsProvider } from "@/features/documents/documents-provider";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";
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
            <WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider>
          </DocumentsProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
