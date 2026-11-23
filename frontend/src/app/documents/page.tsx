import type { Metadata } from "next";
import { DocumentsWorkspace } from "@/features/documents/DocumentsWorkspace";
import { RepositoryDocuments } from "@/features/documents/RepositoryDocuments";

export const metadata: Metadata = { title: "Tài liệu · CacheSec" };
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return (await searchParams).view === "preview" ? <DocumentsWorkspace /> : <RepositoryDocuments />;
}
