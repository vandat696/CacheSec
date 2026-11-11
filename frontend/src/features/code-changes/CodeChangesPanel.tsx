"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";
import { ChangeWorkflowClient, pendingTest } from "./changeWorkflowApi";
import { TestRunPanel } from "./TestRunPanel";
import { useCodeChanges } from "./useCodeChanges";

export function CodeChangesPanel({ api, snapshotId, original, repositoryIdentity, accessLost }: {
  api: ChangeWorkflowClient; snapshotId: string; original: string; repositoryIdentity: string;
  accessLost: () => void;
}) {
  const change = useCodeChanges(api, snapshotId, original, repositoryIdentity, accessLost);
  const [editing, setEditing] = useState(false);
  const [proposalId, setProposalId] = useState("");
  return <section className="code-changes" aria-label="Bản sửa riêng">
    <div className="change-actions">
      <Button variant="tertiary" onClick={() => setEditing(value => !value)}>
        {editing ? "Xem source" : "Sửa bản riêng"}</Button>
      {change.saved && <strong>Revision {change.saved.revision}</strong>}
    </div>
    {editing ? <><textarea aria-label="Mã bản sửa" spellCheck={false} value={change.draft}
      onChange={event => change.setDraft(event.target.value)} disabled={change.busy || !change.config?.can_propose} />
      <div className="change-actions">
        <Button id="change-save" onClick={() => change.save()}
          disabled={change.busy || !change.config?.can_propose || !change.dirty}>Lưu revision</Button>
        <Button id="change-test" onClick={() => change.test()}
          disabled={change.busy || !change.config?.can_test || !change.saved || change.dirty
            || change.jobs.some(job => job.revision === change.saved?.revision && pendingTest(job))}>Chạy test Docker</Button>
        {change.dirty && <span>Chưa lưu</span>}
      </div><p className="repository-notice">Test kỹ thuật · Không cấp quyền triển khai</p>
    </> : <pre aria-label={change.saved ? "Source bản sửa" : "Nội dung tệp snapshot"}>
      <code>{(change.saved?.content ?? original).replace(/\r\n?/g, "\n")}</code></pre>}
    {change.error && <p role="alert" className="repository-error">{change.error}
      {change.requestId && <small>Mã yêu cầu: {change.requestId}</small>}</p>}
    {change.saved && <>
      <TestRunPanel jobs={change.jobs} revision={change.saved.revision} />
      <details className="change-diff" open><summary>Diff · r{change.saved.revision}</summary>
        <pre aria-label="Diff bản sửa"><code>{change.saved.diff}</code></pre></details>
      <details className="repository-reference"><summary>Tham chiếu bản sửa</summary>
        <dl><dt>Proposal</dt><dd>{change.saved.proposal_id}</dd>
          <dt>Base snapshot</dt><dd>{change.saved.base_snapshot_id}</dd>
          <dt>Artifact</dt><dd>{change.saved.artifact_digest}</dd></dl></details>
    </>}
    <details className="repository-open"><summary>Mở bản sửa đã lưu</summary>
      <form onSubmit={event => { event.preventDefault(); void change.open(proposalId); }}>
        <TextInput id="change-proposal-id" label="Proposal ID" value={proposalId}
          onChange={event => setProposalId(event.target.value)} required />
        <Button type="submit" disabled={change.busy || !proposalId}>Mở bản sửa</Button>
      </form></details>
  </section>;
}
