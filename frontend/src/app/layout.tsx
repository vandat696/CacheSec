import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CacheSec",
  description: "Nghiên cứu chatbot RAG và semantic cache có phân quyền",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
