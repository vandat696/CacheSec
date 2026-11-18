"use client";

import { Button } from "@/components/ui/Button";
import { branchLabel, branchMetrics, branchPending, revisionTest, testLabel, type Branch } from "./comparisonModel";

const labels: Record<string, string> = { ready: "Sẵn sàng", preparing: "Đang chuẩn bị", starting: "Đang bắt đầu", queued: "Đang chờ",
  generating: "Đang phân tích và sửa mã", saving: "Đang lưu bản sửa", testing: "Đang chạy test Docker", passed: "Test đạt", needs_input: "Cần bạn xem xét",
  exhausted: "Hết số lượt sửa", error: "Lỗi", timed_out: "Hết thời gian", cancelled: "Đã dừng", incomplete: "Chưa hoàn tất" };
const outcomes: Record<string, string> = { not_applicable: "Không dùng cache", miss: "Miss", hit: "Verified Hit", rejected: "Rejected", client_storage_error: "Lỗi storage local" };
const ms = (value: number | null | undefined) => value == null ? "Chưa có" : `${(value / 1000).toFixed(2)} s`;
export function ComparisonBranch({ branch, busy, onCancel }: { branch: Branch; busy: boolean; onCancel: () => void }) {
  const metrics = branchMetrics(branch);
  const revisions = branch.revisions ?? [];
  const turn = branch.run?.turn;
  const repairing = branch.status === "generating" && turn !== undefined && turn > 1;
  return <article className="comparison-branch" data-mode={branch.mode}>
    <header><strong>{branchLabel(branch.mode)}</strong><span className="comparison-test-state" data-status={branch.status} role="status">
      {repairing ? "Đang sửa theo kết quả test" : labels[branch.status] ?? branch.status}
    </span></header>
    <p>{branch.mode === "none" ? outcomes.not_applicable : branch.context ? outcomes[branch.context.outcome] : "Chưa tra cache"}
      {branch.run && turn ? ` · Lượt ${turn}/${branch.run.max_turns}` : ""}
    </p>
    <details><summary>Số liệu</summary><dl className="comparison-metrics">
      <dt>Tokens vào / ra / tổng</dt><dd>{metrics.usage ? `${metrics.usage.input_tokens} / ${metrics.usage.output_tokens} / ${metrics.usage.total_tokens}` : "Chưa có usage"}</dd>
      <dt>Sinh mã</dt><dd>{ms(metrics.generationMs)}</dd><dt>Workflow server</dt><dd>{ms(branch.server_workflow_ms)}</dd>
      <dt>Context / embedding</dt><dd>{ms(branch.context?.resolution_ms)} / {ms(branch.context?.embedding_ms)}</dd>
      <dt>Chuẩn bị context</dt><dd>{ms(branch.context_request?.preparation_ms)}</dd>
      <dt>Lookup browser (client báo)</dt><dd>{branch.mode === "none" ? "Không dùng" : ms(branch.context?.client_report?.lookup_ms)}</dd>
      {branch.mode === "local" && <><dt>Ghi cache (client báo)</dt><dd>{branch.client_cache_io?.length ? `${branch.client_cache_io.at(-1)!.state} · ${ms(branch.client_cache_io.at(-1)!.elapsed_ms)}` : "Chưa ghi nhận"}</dd></>}
      <dt>Lượt sinh hoàn tất / embedding</dt><dd>{metrics.generationCalls} / {branch.context?.embedding_calls ?? "—"}</dd>
    </dl></details>
    {(branch.error_code || branch.run?.error_code) && <p role="alert">{branch.error_code ?? branch.run?.error_code}</p>}
    {branch.run?.answer && <details><summary>Phản hồi Agent</summary><p>{branch.run.answer}</p></details>}
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
    {branchPending(branch) && <Button variant="tertiary" disabled={busy} onClick={onCancel}>Dừng nhánh</Button>}
  </article>;
}
