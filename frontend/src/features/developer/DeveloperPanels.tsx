"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/forms/Checkbox";
import { Select } from "@/components/ui/forms/Select";
import { Icon } from "@/components/ui/Icon";
import { exampleTests, previewDiff } from "./developerPreviewData";
import { canPreviewApproval, type DeveloperPreview, type PreviewAction, type PreviewRole } from "./developerPreviewModel";

type PanelProps = { state: DeveloperPreview; dispatch: Dispatch<PreviewAction> };

function CodeText({ code }: { code: string }) {
  return code.split(/("[^"]*"|\b(?:def|if|not|return|True)\b)/g).map((part, index) => (
    <span key={index} className={part.startsWith('"') ? "dev-code-string" : /^(def|if|not|return|True)$/.test(part) ? "dev-code-keyword" : undefined}>{part}</span>
  ));
}

export function DiffPanel({ state, dispatch }: PanelProps) {
  const [view, setView] = useState<"diff" | "original">("diff");
  const lines = previewDiff(state.revision).filter((line) => view === "diff" || line.type !== "added");
  return (
    <div className="dev-diff-panel">
      <div className="dev-file-bar">
        <span title="quotation_demo/service.py"><Icon name="file" /><code>service.py</code></span>
        <span className="dev-language">Python</span>
      </div>
      <div className="dev-diff-toolbar">
        <span><code>demo-r{state.revision}</code><span className="dev-diff-count">+7 <span>−0</span></span></span>
        <div className="dev-segment" aria-label="Cách xem mã">
          <button type="button" aria-pressed={view === "diff"} onClick={() => setView("diff")}>Diff</button>
          <button type="button" aria-pressed={view === "original"} onClick={() => setView("original")}>Bản gốc</button>
        </div>
      </div>
      <div className="dev-code-scroll" tabIndex={0} role="region" aria-label="Mã nguồn minh họa, có thể cuộn ngang">
        <pre className="dev-code"><code>{lines.map((line) => (
          <span key={line.line} className={`dev-code-line ${line.type}`}>
            <span className="dev-line-number" aria-hidden="true">{line.line}</span>
            <span className="dev-line-sign" aria-label={line.type === "added" ? "Dòng thêm" : undefined}>{line.type === "added" ? "+" : " "}</span>
            <span><CodeText code={line.code} /></span>{"\n"}
          </span>
        ))}</code></pre>
      </div>
      <details className="dev-code-details"><summary>Mã mẫu · Chỉ đọc</summary><div><p>Chưa áp dụng vào repository. Quy tắc ngày hợp lệ chưa chốt.</p><Button id="preview-revise" variant="tertiary" onClick={() => dispatch({ type: "revise" })}><Icon name="refresh" />Thử bản sửa khác</Button></div></details>
    </div>
  );
}

export function TestsPanel({ state, dispatch }: PanelProps) {
  const shown = state.testRevision === state.revision;
  return (
    <div className="dev-panel-content">
      <div className="dev-panel-heading"><h2><code>demo-r{state.revision}</code></h2><span className={`dev-status ${shown ? "success" : "neutral"}`}>{shown ? "4/4 đạt · mẫu" : "Chưa có kết quả"}</span></div>
      <div className="dev-tests-table-wrap" tabIndex={0} role="region" aria-label="Bảng ca kiểm thử minh họa">
        <table className="dev-tests-table"><thead><tr><th>Trường hợp</th><th>Mong đợi</th><th>Kết quả</th></tr></thead><tbody>{exampleTests.map((test) => <tr key={test.id}><td><span className="dev-case-id">{test.id}</span>{test.input}</td><td>{test.expected}</td><td><span className={shown ? "dev-test-pass" : "muted"}>{shown ? <><Icon name="check" />Đạt · mẫu</> : "—"}</span></td></tr>)}</tbody></table>
      </div>
      <details className="dev-extra"><summary>Ghi chú</summary><p>Chưa chạy test thật. Ngày hết hạn, múi giờ và ngưỡng nghiệm thu chưa chốt.</p></details>
      <Button id="preview-tests" onClick={() => dispatch({ type: "tests" })} disabled={shown}><Icon name="terminal" />{shown ? "Đã mở kết quả mẫu" : "Xem kết quả mẫu"}</Button>
    </div>
  );
}

export function ApprovalPanel({ state, dispatch }: PanelProps) {
  const approved = state.approval === "approved";
  const requested = state.approval === "changes-requested";
  const checked = state.acknowledgedRevision === state.revision;
  return (
    <div className="dev-panel-content">
      <div className="dev-panel-heading"><h2>Duyệt thay đổi</h2><span className={`dev-status ${approved ? "success" : "warning"}`}>{approved ? "Đã duyệt mẫu" : requested ? "Cần chỉnh sửa" : "Chờ duyệt"}</span></div>
      <Select id="preview-role" label="Vai trò mô phỏng" value={state.role} onChange={(event) => dispatch({ type: "role", role: event.target.value as PreviewRole })} options={[{ value: "reviewer", label: "Reviewer" }, { value: "developer", label: "Developer" }]} />
      <dl className="dev-evidence"><div><dt>Phiên bản</dt><dd><code>demo-r{state.revision}</code></dd></div><div><dt>Kết quả kiểm thử</dt><dd>{state.testRevision === state.revision ? "Đã xem mẫu" : "Chưa xem kết quả mẫu"}</dd></div><div><dt>Artifact</dt><dd>Chưa tạo</dd></div></dl>
      <Checkbox id="preview-acknowledge" label={`Đã xem diff demo-r${state.revision}.`} checked={checked} disabled={state.approval !== "pending" || state.role !== "reviewer"} onChange={(event) => dispatch({ type: "acknowledge", checked: event.target.checked })} />
      <div className="dev-approval-actions"><Button id="preview-approve" disabled={!canPreviewApproval(state)} onClick={() => dispatch({ type: "approve", revision: state.revision })}><Icon name="check" />Duyệt bản mẫu</Button><Button id="preview-request-changes" variant="secondary" disabled={state.role !== "reviewer" || state.approval !== "pending"} onClick={() => dispatch({ type: "request-changes", revision: state.revision })}>Yêu cầu chỉnh sửa</Button></div>
      <p className="dev-caption">Cần reviewer, kết quả kiểm thử và xác nhận diff.</p>
      <div className="dev-deploy-boundary"><div><Icon name="lock" /><strong>Chưa kết nối triển khai</strong></div><Button variant="secondary" disabled id="preview-deploy">Triển khai</Button></div>
    </div>
  );
}

export function TracePanel({ state }: { state: DeveloperPreview }) {
  return (
    <div className="dev-panel-content">
      <div className="dev-panel-heading"><h2>Phiên hiện tại</h2><span className="dev-status neutral">{state.events.length} sự kiện</span></div>
      <ol className="dev-trace-list">{state.events.map((event) => <li key={event.id}><span className="dev-trace-number">{String(event.id).padStart(2, "0")}</span><div><code>demo-r{event.revision}</code><p>{event.text}</p></div></li>)}</ol>
    </div>
  );
}

export function DeveloperReviewDialog({ panel, onClose, state, dispatch }: PanelProps & {
  panel: "tests" | "approval" | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = panel !== null;

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    element.querySelector<HTMLButtonElement>(".dev-dialog-close")?.focus();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [open]);

  return (
    <dialog ref={dialog} id="developer-review-dialog" className="nui nui-theme nui-dialog dev-review-dialog" aria-labelledby="developer-review-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="dev-dialog-heading"><h2 id="developer-review-title">{panel === "tests" ? "Kiểm thử" : "Phê duyệt"}<span className="dev-demo-label">Mô phỏng</span></h2><Button className="dev-dialog-close" variant="tertiary" aria-label="Đóng chi tiết" onClick={onClose}><Icon name="close" /></Button></header>
      {panel === "tests" && <TestsPanel state={state} dispatch={dispatch} />}
      {panel === "approval" && <><ApprovalPanel state={state} dispatch={dispatch} /><details className="dev-trace-details"><summary>Nhật ký phiên</summary><TracePanel state={state} /></details></>}
    </dialog>
  );
}
