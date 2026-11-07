import type { Metadata } from "next";
import { DocumentsWorkspace } from "@/features/documents/DocumentsWorkspace";

export const metadata: Metadata = { title: "Tài liệu · CacheSec" };
export default function DocumentsPage() {
  return <DocumentsWorkspace />;
}
