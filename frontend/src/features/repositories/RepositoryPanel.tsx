"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";
import { RepositoryConnection } from "./RepositoryConnection";
import { RepositoryWorkspace, type RepositoryWorkspaceHandle } from "./RepositoryWorkspace";
import { useRepository } from "./useRepository";

export function RepositoryPanel({ ref, repo }: { ref?: Ref<RepositoryWorkspaceHandle>; repo: ReturnType<typeof useRepository> }) {
  const [snapshotId, setSnapshotId] = useState("");
  const workspace = useRef<RepositoryWorkspaceHandle>(null);
  function requestLeave(action: () => void) { if (workspace.current) workspace.current.requestLeave(action); else action(); }
  useImperativeHandle(ref, () => ({ requestLeave, openProposal: id => workspace.current?.openProposal(id) }));
  return <div className="repository-panel" data-connected={!!repo.repository} aria-busy={repo.busy}>
    {!repo.repository ? <RepositoryConnection busy={repo.busy} onConnect={repo.connect} /> : <>
      <div className="repository-project-menu">
        <details className="repository-open"><summary>Project</summary>
          <div className="repository-project-options">
            <Button variant="tertiary" id="repository-capture" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); requestLeave(() => { void repo.load(); }); }} disabled={repo.busy}>Mở lại mã nguồn</Button>
            <form onSubmit={event => { event.preventDefault(); event.currentTarget.closest("details")?.removeAttribute("open"); requestLeave(() => { void repo.load(snapshotId); }); }}>
              <TextInput id="repository-snapshot-id" label="Mở snapshot đã lưu" value={snapshotId}
                required onChange={event => setSnapshotId(event.target.value)} />
              <Button type="submit" variant="secondary" disabled={repo.busy || !snapshotId}>Mở</Button>
            </form>
          </div>
        </details>
        <details className="repository-reference"><summary>Thông tin project</summary>
          <dl>{repo.snapshot && <><dt>ID</dt><dd>{repo.snapshot.snapshot_id}</dd></>}
            <dt>Repository</dt><dd>{repo.repository.repository_identity}</dd>
            {repo.snapshot && <><dt>Manifest</dt><dd>{repo.snapshot.manifest_digest}</dd>
              <dt>Profile</dt><dd>{repo.snapshot.source_profile_digest}</dd></>}</dl>
        </details>
        <Button variant="tertiary" id="repository-disconnect" onClick={() => requestLeave(repo.disconnect)}>Ngắt kết nối</Button>
      </div>
    </>}
    {repo.error && <div className="repository-error" role="alert">{repo.error}
      {repo.requestId && <small>Mã yêu cầu: {repo.requestId}</small>}</div>}
    {repo.snapshot && repo.repository
      ? <RepositoryWorkspace key={repo.snapshot.snapshot_id} repo={repo} ref={workspace} />
      : repo.busy && <p className="repository-notice" role="status">Đang mở project…</p>}
  </div>;
}
