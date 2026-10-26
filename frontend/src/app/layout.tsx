import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { ChatProvider } from "@/features/chat/chat-provider";
import { DocumentsProvider } from "@/features/documents/documents-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CacheSec",
  description: "Chat nội bộ và quản lý tài liệu công ty",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="nui-theme">
      <body>
        <ChatProvider>
          <DocumentsProvider>
            <AppShell>{children}</AppShell>
          </DocumentsProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
