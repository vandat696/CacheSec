// Local intake only. A category organizes files; it never grants access.
export const documentCategories = [
  { value: "uncategorized", label: "Chưa phân loại" },
  { value: "hr", label: "Nhân sự" },
  { value: "policy", label: "Quy định" },
  { value: "technical", label: "Kỹ thuật" },
  { value: "procedure", label: "Quy trình" },
  { value: "other", label: "Khác" },
] as const;

export type DocumentCategory = (typeof documentCategories)[number]["value"];
export const acceptedExtensions = ["pdf", "docx", "txt", "md"] as const;
export const maxFileBytes = 20 * 1024 * 1024;

export type FileInfo = Pick<File, "name" | "size" | "lastModified">;
export type QueuedDocument = {
  id: string;
  file: File;
  category: DocumentCategory;
  status: "pending";
};
export type DocumentIssue = { name: string; message: string };

export function isDocumentCategory(value: string): value is DocumentCategory {
  return documentCategories.some((category) => category.value === value);
}

export function fileExtension(name: string): string {
  return name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
    : "";
}

export function fileKey(file: FileInfo): string {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}

export function validateDocument(file: FileInfo): string | null {
  if (
    !(acceptedExtensions as readonly string[]).includes(
      fileExtension(file.name),
    )
  )
    return "Chỉ nhận PDF, DOCX, TXT hoặc MD.";
  if (!Number.isFinite(file.size) || file.size <= 0)
    return "Tệp trống hoặc kích thước không hợp lệ.";
  if (file.size > maxFileBytes) return "Tệp vượt quá 20 MB.";
  return null;
}

export function queueDocuments(
  current: readonly QueuedDocument[],
  files: readonly File[],
  category: DocumentCategory,
  createId: (file: File) => string,
): { documents: QueuedDocument[]; issues: DocumentIssue[] } {
  if (!isDocumentCategory(category)) throw new Error("Danh mục không hợp lệ.");
  const seen = new Set(current.map((document) => fileKey(document.file)));
  const documents = [...current];
  const issues: DocumentIssue[] = [];
  for (const file of files) {
    const invalid = validateDocument(file);
    const key = fileKey(file);
    if (invalid || seen.has(key)) {
      issues.push({
        name: file.name,
        message: invalid ?? "Tệp đã có trong danh sách.",
      });
      continue;
    }
    seen.add(key);
    documents.push({ id: createId(file), file, category, status: "pending" });
  }
  return { documents, issues };
}

export function filterDocuments(
  documents: readonly QueuedDocument[],
  query: string,
  category: string,
): QueuedDocument[] {
  const search = query.trim().toLocaleLowerCase("vi");
  return documents.filter(
    (document) =>
      (category === "all" || document.category === category) &&
      document.file.name.toLocaleLowerCase("vi").includes(search),
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
