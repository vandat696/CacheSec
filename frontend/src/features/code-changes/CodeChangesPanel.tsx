"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";
import { TestRunPanel } from "./TestRunPanel";
import type { useCodeChanges } from "./useCodeChanges";

type ConsoleTab = "tests" | "diff" | "details";
export function CodeChangesPanel({ change, tab, onTab }: {
  change: ReturnType<typeof useCodeChanges>; tab: ConsoleTab; onTab: (tab: ConsoleTab) => void;
}) {
  const [proposalId, setProposalId] = useState("");
  return <section className="code-changes repository-console" aria-label="Bảng kết quả">
    <div className="repository-console-tabs" role="tablist" aria-label="Bảng công cụ">
      {([["tests", "Kiểm thử"], ["diff", "Thay đổi"], ["details", "Chi tiết"]] as const).map(([key, label]) =>
        <button type="button" role="tab" key={key} data-console-tab={key} aria-selected={key === tab} onClick={() => onTab(key)}>{label}
          {key === "tests" && change.jobs.length > 0 && <span>{change.jobs.length}</span>}</button>)}
    </div>
    <div className="repository-console-content" role="tabpanel">
      {change.error && <p role="alert" className="repository-error">{change.error}
        {change.requestId && <small>Mã yêu cầu: {change.requestId}</small>}</p>}
      <div hidden={tab !== "tests"}>
        {change.saved ? <TestRunPanel jobs={change.jobs} revision={change.saved.revision} dirty={change.dirty} /> : null}
        {!change.jobs.length && <p className="repository-notice">Chưa chạy kiểm thử.</p>}
      </div>
      <div className="change-diff" hidden={tab !== "diff"}>
        {change.saved ? <><p>Thay đổi đã lưu · Bản {change.saved.revision}{change.dirty && " · Còn thay đổi chưa lưu"}</p>
          {change.saved.diff ? <pre aria-label="Diff bản sửa"><code>{change.saved.diff}</code></pre>
            : <p>Không có thay đổi so với bản gốc.</p>}</>
          : <p className="repository-notice">Lưu tệp để xem thay đổi.</p>}
      </div>
      <div hidden={tab !== "details"}>
        {change.saved && <dl className="repository-reference change-reference">
          <dt>Proposal</dt><dd>{change.saved.proposal_id}</dd><dt>Base snapshot</dt><dd>{change.saved.base_snapshot_id}</dd>
          <dt>Artifact</dt><dd>{change.saved.artifact_digest}</dd></dl>}
        <form className="change-open" onSubmit={event => { event.preventDefault(); void change.open(proposalId); }}>
          <TextInput id="change-proposal-id" label="Mở bản sửa bằng Proposal ID" value={proposalId}
            onChange={event => setProposalId(event.target.value)} required />
          <Button type="submit" variant="secondary" disabled={change.busy || !proposalId || change.dirty}>Mở</Button>
        </form>
      </div>
    </div>
  </section>;
}
