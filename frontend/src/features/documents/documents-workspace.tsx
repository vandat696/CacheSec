"use client";

import { useRef, useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Select, TextInput } from "@/components/ui/fields";
import { Icon } from "@/components/ui/icon";
import {
  documentCategories,
  acceptedExtensions,
  fileExtension,
  filterDocuments,
  formatFileSize,
  isDocumentCategory,
  type DocumentCategory,
} from "./document-model";
import { useDocuments } from "./documents-provider";

export function DocumentsWorkspace() {
  const { documents, issues, addFiles, categorize, remove, dismissIssues } =
    useDocuments();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [uploadCategory, setUploadCategory] =
    useState<DocumentCategory>("uncategorized");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const visible = filterDocuments(documents, query, category);

  return (
    <div className="content-page documents-workspace">
      <PageHeading title="Tài liệu" />
      <section className="document-intake" aria-label="Thêm tài liệu">
        <input
          ref={input}
          id="document-files"
          type="file"
          multiple
          accept={acceptedExtensions
            .map((extension) => `.${extension}`)
            .join(",")}
          hidden
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []), uploadCategory);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className={`upload-dropzone${dragging ? " dragging" : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(Array.from(event.dataTransfer.files), uploadCategory);
          }}
          aria-describedby="upload-formats"
        >
          <Icon name="upload" />
          <strong>Chọn hoặc thả tài liệu</strong>
          <span id="upload-formats">PDF, DOCX, TXT, MD · tối đa 20 MB/tệp</span>
        </button>
        <Select
          label="Phân loại khi thêm"
          value={uploadCategory}
          options={documentCategories}
          onChange={(event) => {
            if (isDocumentCategory(event.target.value))
              setUploadCategory(event.target.value);
          }}
        />
      </section>
      {issues.length > 0 && (
        <div className="document-issues" role="alert">
          <div>
            {issues.map((issue, index) => (
              <p key={index}>
                <strong>{issue.name}</strong>: {issue.message}
              </p>
            ))}
          </div>
          <Button
            variant="tertiary"
            className="icon-button"
            aria-label="Đóng thông báo tệp"
            onClick={dismissIssues}
          >
            <Icon name="close" />
          </Button>
        </div>
      )}
      <section className="document-library" aria-label="Danh sách tài liệu">
        <div className="document-toolbar">
          <TextInput
            label="Tìm tài liệu"
            type="search"
            placeholder="Tìm theo tên…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            label="Danh mục"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[
              { value: "all", label: "Tất cả danh mục" },
              ...documentCategories,
            ]}
          />
        </div>
        {documents.length > 0 && (
          <p className="document-pending-note" role="status">
            {documents.length} tệp đang trong phiên, chưa tải lên hệ thống.
          </p>
        )}
        {visible.length === 0 ? (
          <div className="documents-empty">
            <Icon name="file" />
            <p>
              {documents.length === 0
                ? "Chưa có tài liệu."
                : "Không tìm thấy tài liệu."}
            </p>
          </div>
        ) : (
          <div className="document-list" role="list">
            {visible.map((document) => (
              <article
                key={document.id}
                className="document-row"
                role="listitem"
              >
                <span className="document-file-icon">
                  <Icon name="file" />
                </span>
                <div className="document-name">
                  <strong>{document.file.name}</strong>
                  <span>
                    {fileExtension(document.file.name).toUpperCase()} ·{" "}
                    {formatFileSize(document.file.size)}
                  </span>
                </div>
                <Select
                  label={`Phân loại ${document.file.name}`}
                  value={document.category}
                  options={documentCategories}
                  onChange={(event) => {
                    if (isDocumentCategory(event.target.value))
                      categorize(document.id, event.target.value);
                  }}
                />
                <span className="document-status">Chờ tải lên</span>
                <Button
                  variant="tertiary"
                  className="icon-button"
                  aria-label={`Bỏ ${document.file.name} khỏi danh sách`}
                  onClick={() => remove(document.id)}
                >
                  <Icon name="close" />
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
