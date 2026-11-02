"use client";

import { useState, type Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/fields";
import { Icon } from "@/components/ui/icon";
import { exampleTests, previewDiff } from "./developer-preview-data";
import { canPreviewApproval, type DeveloperPreview, type PreviewAction, type PreviewRole } from "./developer-preview-model";

export type DeveloperTab = "diff" | "tests" | "approval" | "trace";
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
        <span><Icon name="file" /><code>quotation_demo/service.py</code></span>
        <span className="dev-diff-count">+7 <span>−0</span></span>
      </div>
      <div className="dev-diff-toolbar">
        <span>Đề xuất <code>demo-r{state.revision}</code></span>
        <div className="dev-segment" aria-label="Cách xem mã">
          <button type="button" aria-pressed={view === "diff"} onClick={() => setView("diff")}>Diff</button>
          <button type="button" aria-pressed={view === "original"} onClick={() => setView("original")}>Bản gốc</button>
        </div>
      </div>
      <div className="dev-code-scroll" tabIndex={0} role="region" aria-label="Mã nguồn minh họa, có thể cuộn ngang">
        <div className="dev-code-hunk">@@ validate_quotation · {view === "diff" ? "thêm kiểm tra ngày hết hạn" : "trước thay đổi"}</div>
        <pre className="dev-code"><code>{lines.map((line) => (
          <span key={line.line} className={`dev-code-line ${line.type}`}>
            <span className="dev-line-number" aria-hidden="true">{line.line}</span>
            <span className="dev-line-sign" aria-label={line.type === "added" ? "Dòng thêm" : undefined}>{line.type === "added" ? "+" : " "}</span>
            <span><CodeText code={line.code} /></span>{"\n"}
          </span>
        ))}</code></pre>
      </div>
      <div className="dev-change-summary">
        <span className="dev-small-icon"><Icon name="code" /></span>
        <div><h3>Một thay đổi, phạm vi rõ ràng</h3><p>Thêm cờ <code>expiration_review</code> để chuyển báo giá sang bước con người xem xét. Giữ các kiểm tra hiện có.</p></div>
      </div>
      <div className="dev-note"><Icon name="file" /><p>Mã minh họa, chưa áp dụng vào repository. Hàm <code>policy.is_valid_expiration</code> đại diện cho quy tắc ngày còn cần thống nhất.</p></div>
      <div className="dev-panel-footer">
        <span>1 file minh họa · chưa tạo artifact</span>
        <Button id="preview-revise" variant="tertiary" onClick={() => dispatch({ type: "revise" })}><Icon name="refresh" />Thử bản sửa khác</Button>
      </div>
    </div>
  );
}

export function TestsPanel({ state, dispatch }: PanelProps) {
  const shown = state.testRevision === state.revision;
  return (
    <div className="dev-panel-content">
      <div className="dev-panel-heading"><div><span className="dev-eyebrow">VALIDATION CHECKS</span><h2>Kiểm thử thay đổi</h2><p>Các ca mẫu cho <code>demo-r{state.revision}</code>.</p></div><span className={`dev-status ${shown ? "success" : "neutral"}`}>{shown ? "4/4 đạt · mẫu" : "Chưa có kết quả"}</span></div>
      <div className="dev-tests-table-wrap" tabIndex={0} role="region" aria-label="Bảng ca kiểm thử minh họa">
        <table className="dev-tests-table"><thead><tr><th>Trường hợp</th><th>Mong đợi</th><th>Kết quả</th></tr></thead><tbody>{exampleTests.map((test) => <tr key={test.id}><td><span className="dev-case-id">{test.id}</span>{test.input}</td><td>{test.expected}</td><td><span className={shown ? "dev-test-pass" : "muted"}>{shown ? <><Icon name="check" />Đạt · mẫu</> : "—"}</span></td></tr>)}</tbody></table>
      </div>
      <div className="dev-note"><Icon name="clock" /><p>Ngày đã hết hạn, múi giờ và ngày bằng mốc còn cần đặc tả. Bảng này chưa phải fixture đóng băng hoặc acceptance threshold.</p></div>
      <Button id="preview-tests" onClick={() => dispatch({ type: "tests" })} disabled={shown}><Icon name="terminal" />{shown ? "Đã mở kết quả mẫu" : "Xem kết quả mẫu"}</Button>
      <p className="dev-caption">Kết quả có sẵn để xem giao diện. Không thực thi code hoặc chạy test thật.</p>
    </div>
  );
}

export function ApprovalPanel({ state, dispatch }: PanelProps) {
  const approved = state.approval === "approved";
  const requested = state.approval === "changes-requested";
  const checked = state.acknowledgedRevision === state.revision;
  return (
    <div className="dev-panel-content">
      <div className="dev-panel-heading"><div><span className="dev-eyebrow">HUMAN APPROVAL</span><h2>Duyệt đúng bản thay đổi</h2><p>Quyết định gắn với <code>demo-r{state.revision}</code>.</p></div><span className={`dev-status ${approved ? "success" : "warning"}`}>{approved ? "Đã duyệt mẫu" : requested ? "Cần chỉnh sửa" : "Chờ xem xét"}</span></div>
      <div className="dev-approval-identity"><span className="dev-small-icon"><Icon name="shield" /></span><div><strong>Phê duyệt thay đổi code</strong><p>Cache hit và test pass không thay thế quyết định của người duyệt.</p></div></div>
      <Select id="preview-role" label="Vai trò mô phỏng" value={state.role} onChange={(event) => dispatch({ type: "role", role: event.target.value as PreviewRole })} options={[{ value: "reviewer", label: "Reviewer mẫu · có thể duyệt trong demo" }, { value: "developer", label: "Developer mẫu · không có quyền duyệt" }]} />
      <dl className="dev-evidence"><div><dt>Thay đổi được xem xét</dt><dd><code>demo-r{state.revision}</code></dd></div><div><dt>Kết quả kiểm thử</dt><dd>{state.testRevision === state.revision ? "Đã xem mẫu · chưa chạy thật" : "Chưa xem kết quả mẫu"}</dd></div><div><dt>Artifact / hash xác minh</dt><dd>Chưa tạo</dd></div></dl>
      <Checkbox id="preview-acknowledge" label={`Tôi đã xem diff của demo-r${state.revision} trong bản mẫu.`} checked={checked} disabled={state.approval !== "pending" || state.role !== "reviewer"} onChange={(event) => dispatch({ type: "acknowledge", checked: event.target.checked })} />
      <div className="dev-approval-actions"><Button id="preview-approve" disabled={!canPreviewApproval(state)} onClick={() => dispatch({ type: "approve", revision: state.revision })}><Icon name="check" />Duyệt bản mẫu</Button><Button id="preview-request-changes" variant="secondary" disabled={state.role !== "reviewer" || state.approval !== "pending"} onClick={() => dispatch({ type: "request-changes", revision: state.revision })}>Yêu cầu chỉnh sửa</Button></div>
      <p className="dev-caption">Chọn reviewer, xem kết quả mẫu và xác nhận diff để thử duyệt. Thay đổi revision sẽ xóa quyết định mẫu cũ.</p>
      <div className="dev-deploy-boundary"><div><Icon name="lock" /><div><strong>Deployment control</strong><p>Chưa kết nối backend. Phê duyệt trong demo không có hiệu lực triển khai.</p></div></div><Button variant="secondary" disabled id="preview-deploy">Triển khai</Button></div>
    </div>
  );
}

export function TracePanel({ state }: { state: DeveloperPreview }) {
  return (
    <div className="dev-panel-content">
      <div className="dev-panel-heading"><div><span className="dev-eyebrow">DECISION TRACE</span><h2>Nhật ký bản xem trước</h2><p>Các thao tác trong phiên hiện tại. Tải lại trang để bắt đầu lại.</p></div><span className="dev-status neutral">{state.events.length} sự kiện</span></div>
      <ol className="dev-trace-list">{state.events.map((event) => <li key={event.id}><span className="dev-trace-number">{String(event.id).padStart(2, "0")}</span><div><code>demo-r{event.revision}</code><p>{event.text}</p></div></li>)}</ol>
      <p className="dev-caption">Nhật ký UI mô phỏng, chưa phải audit log từ backend hoặc bằng chứng thực nghiệm.</p>
    </div>
  );
}
