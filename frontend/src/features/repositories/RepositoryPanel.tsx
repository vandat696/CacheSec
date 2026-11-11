"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";
import { RepositoryConnection } from "./RepositoryConnection";
import { useRepository } from "./useRepository";
import { CodeChangesPanel } from "../code-changes/CodeChangesPanel";
import { editablePath } from "../code-changes/changeWorkflowApi";

export function RepositoryPanel() {
  const repo = useRepository();
  const [snapshotId, setSnapshotId] = useState("");
  return <div className="repository-panel" data-connected={!!repo.repository} aria-busy={repo.busy}>
    <div className="dev-file-bar"><strong>Repository</strong><span>Snapshot và bản sửa</span></div>
    {!repo.repository ? <RepositoryConnection busy={repo.busy} onConnect={repo.connect} /> : <>
      <div className="repository-actions">
        <span>{repo.repository.repository_identity}</span>
        <Button id="repository-capture" onClick={() => repo.load()} disabled={repo.busy}>Tạo snapshot</Button>
        <Button variant="tertiary" onClick={repo.disconnect}>Ngắt kết nối</Button>
      </div>
      <details className="repository-open"><summary>Mở snapshot đã lưu</summary>
        <form onSubmit={(event) => { event.preventDefault(); void repo.load(snapshotId); }}>
          <TextInput id="repository-snapshot-id" label="Snapshot ID" value={snapshotId}
            required onChange={(event) => setSnapshotId(event.target.value)} />
          <Button type="submit" disabled={repo.busy || !snapshotId}>Mở</Button>
        </form>
      </details>
    </>}
    {repo.error && <div className="repository-error" role="alert">{repo.error}
      {repo.requestId && <small>Mã yêu cầu: {repo.requestId}</small>}</div>}
    {repo.busy && <p className="repository-notice" role="status">Đang tải…</p>}
    {repo.snapshot && <>
      <details className="repository-reference"><summary>Thông tin snapshot</summary>
        <dl><dt>ID</dt><dd>{repo.snapshot.snapshot_id}</dd>
          <dt>Manifest</dt><dd>{repo.snapshot.manifest_digest}</dd>
          <dt>Profile</dt><dd>{repo.snapshot.source_profile_digest}</dd></dl>
        <p>Bản lưu bất biến; source hiện tại có thể đã đổi. Chưa phải artifact đã kiểm thử.</p>
      </details>
      <div className="repository-source">
        <nav aria-label="Tệp snapshot">{repo.snapshot.files.map((file) =>
          <button key={file.file_id} type="button" disabled={repo.busy}
            aria-current={repo.selected?.file_id === file.file_id ? "true" : undefined}
            onClick={() => repo.select(file)}>{file.path}<small>{file.byte_size} B</small></button>)}</nav>
        <div className="repository-file">
          {repo.selected ? <>
            <div className="repository-file-heading">{repo.selected.path}</div>
            {repo.binary ? <p className="repository-notice">Tệp nhị phân hoặc không phải UTF-8; không hiển thị dạng văn bản.</p>
              : repo.changes && repo.repository && repo.selected.path === editablePath && repo.rawContent !== null
                ? <CodeChangesPanel key={repo.selected.file_id} api={repo.changes} snapshotId={repo.snapshot.snapshot_id}
                  original={repo.rawContent} repositoryIdentity={repo.repository.repository_identity} accessLost={repo.disconnect} />
                : <pre aria-label="Nội dung tệp snapshot"><code>{repo.content}</code></pre>}
          </> : <p className="repository-notice">Chọn tệp để đọc.</p>}
        </div>
      </div>
    </>}
    {repo.repository && !repo.snapshot && !repo.busy && !repo.error &&
      <p className="repository-notice">Tạo snapshot hoặc mở một bản đã lưu.</p>}
  </div>;
}
