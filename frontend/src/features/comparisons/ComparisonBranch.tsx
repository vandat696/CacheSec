"use client";

import { Button } from "@/components/ui/Button";
import type { ReactNode } from "react";
import type { ContextMode } from "../context-cache/contextCacheModel";
import { branchLabel, branchMetrics, branchPending, revisionTest, testLabel, type Branch } from "./comparisonModel";

const labels: Record<string, string> = { ready: "Sẵn sàng", preparing: "Đang chuẩn bị", starting: "Đang bắt đầu", queued: "Đang chờ",
  generating: "Đang phân tích và sửa mã", saving: "Đang lưu bản sửa", testing: "Đang chạy test Docker", passed: "Test đạt", needs_input: "Cần bạn xem xét",
  exhausted: "Hết số lượt sửa", error: "Lỗi", timed_out: "Hết thời gian", cancelled: "Đã dừng", incomplete: "Chưa hoàn tất" };
const outcomes: Record<string, string> = { not_applicable: "Không dùng cache", miss: "Miss", hit: "Verified Hit", rejected: "Rejected", client_storage_error: "Lỗi storage local" };
const ms = (value: number | null | undefined) => value == null ? "Chưa có" : `${(value / 1000).toFixed(2)} s`;
function BranchDetails({ branch, busy, onCancel }: { branch: Branch; busy: boolean; onCancel: () => void }) {
  const metrics = branchMetrics(branch);
  const revisions = branch.revisions ?? [];
  const turn = branch.run?.turn;
  return <div className="comparison-branch-details">
    {branch.mode === "local" && branch.context && <p>{outcomes[branch.context.outcome]}</p>}
    {(branch.error_code || branch.run?.error_code) && <p role="alert">{branch.error_code ?? branch.run?.error_code}</p>}
    <details><summary>Chi tiết</summary>
    {branch.run && turn !== undefined && turn > 0 && <p>Lượt {turn}/{branch.run.max_turns}</p>}
    {metrics.lastProviderFailure && <p>
      {metrics.lastProviderFailure.provider_http_status == null ? "Lỗi kết nối model" : `Lỗi gọi model · HTTP ${metrics.lastProviderFailure.provider_http_status}`}
      {metrics.retry && " · Có bước thử lại"}
    </p>}
    <dl className="comparison-metrics">
      <dt>Tokens vào / ra / tổng</dt><dd>{metrics.usage ? `${metrics.usage.input_tokens} / ${metrics.usage.output_tokens} / ${metrics.usage.total_tokens}` : "Chưa có usage"}</dd>
      <dt>Sinh mã</dt><dd>{ms(metrics.generationMs)}</dd><dt>Workflow server</dt><dd>{ms(branch.server_workflow_ms)}</dd>
      <dt>Context / embedding</dt><dd>{ms(branch.context?.resolution_ms)} / {ms(branch.context?.embedding_ms)}</dd>
      <dt>Chuẩn bị context</dt><dd>{ms(branch.context_request?.preparation_ms)}</dd>
      <dt>Lookup browser (client báo)</dt><dd>{branch.mode === "none" ? "Không dùng" : ms(branch.context?.client_report?.lookup_ms)}</dd>
      {branch.mode === "local" && <><dt>Ghi cache (client báo)</dt><dd>{branch.client_cache_io?.length ? `${branch.client_cache_io.at(-1)!.state} · ${ms(branch.client_cache_io.at(-1)!.elapsed_ms)}` : "Chưa ghi nhận"}</dd></>}
      <dt>Lượt sinh hoàn tất / embedding</dt><dd>{metrics.generationCalls} / {branch.context?.embedding_calls ?? "—"}</dd>
      {metrics.retry && <><dt>Lần thử gọi model</dt><dd>{metrics.generationAttempts}</dd></>}
    </dl>
    {revisions.map(item => {
      const test = revisionTest(item);
      const failed = test?.result?.checks.filter(check => !check.passed) ?? [];
      return <details key={item.revision}>
        <summary>Bản sửa {item.revision} · <span className="comparison-test-state" data-status={test?.status}>{testLabel(test?.status)}</span></summary>
        {!!failed.length && <ul aria-label="Các kiểm tra chưa đạt">{failed.map(check => <li key={check.name}><code>{check.name}</code></li>)}</ul>}
        <p>Artifact <code>{item.artifact_digest}</code></p>
        {test?.evidence_digest && <p>Bằng chứng test <code>{test.evidence_digest}</code></p>}
      </details>;
    })}
    {!!branch.context?.decisions.length && <details><summary>Xác minh cache</summary>{branch.context.decisions.map((item, index) => <p key={index}>{item.kind} · score {item.score == null ? "chưa ghi nhận" : item.score.toFixed(3)} · {item.reason ?? "Đã xác minh"}</p>)}</details>}
    {!!branch.assessments?.length && <details><summary>Đánh giá kỹ thuật</summary>{branch.assessments.map(item => <p key={item.assessment_id}>Lượt {item.turn}: {item.technical_test_status}. Acceptance nghiên cứu: chưa đánh giá.</p>)}</details>}
    </details>
    {branchPending(branch) && <Button variant="tertiary" disabled={busy} onClick={onCancel}>Dừng nhánh</Button>}
  </div>;
}

export function ComparisonBranch({ mode, branch, busy, onCancel, children }: {
  mode: ContextMode; branch?: Branch; busy: boolean; onCancel: () => void; children: ReactNode;
}) {
  const status = branch?.status;
  const repairing = status === "generating" && (branch?.run?.turn ?? 0) > 1;
  return <section className="comparison-review-branch" data-mode={mode} aria-label={branchLabel(mode)}>
    <header className="comparison-review-branch-heading">
      <h3>{branchLabel(mode)}</h3>
      <span className="comparison-test-state" data-status={status ?? "idle"} role="status">
        {repairing ? "Đang sửa theo kết quả test" : status ? labels[status] ?? status : "Chưa chạy"}
      </span>
    </header>
    {branch && <BranchDetails branch={branch} busy={busy} onCancel={onCancel} />}
    {children}
  </section>;
}
