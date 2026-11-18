"use client";

import { Button } from "@/components/ui/Button";
import { branchMetrics, branchPending, type Branch } from "./comparisonModel";

const labels: Record<string, string> = { ready: "Sẵn sàng", preparing: "Đang chuẩn bị", starting: "Đang bắt đầu", queued: "Đang chờ",
  generating: "Đang sinh mã", saving: "Đang lưu revision", testing: "Đang test", passed: "Test đạt", needs_input: "Cần bổ sung yêu cầu",
  exhausted: "Hết số lượt sửa", error: "Lỗi", timed_out: "Hết thời gian", cancelled: "Đã dừng", incomplete: "Chưa hoàn tất" };
const outcomes: Record<string, string> = { not_applicable: "Không dùng cache", miss: "Miss", hit: "Verified Hit", rejected: "Rejected", client_storage_error: "Lỗi storage local" };
const ms = (value: number | null | undefined) => value == null ? "Chưa có" : `${(value / 1000).toFixed(2)} s`;
export function ComparisonBranch({ branch, busy, onOpen, onCancel }: { branch: Branch; busy: boolean; onOpen: (id: string) => void; onCancel: () => void }) {
  const metrics = branchMetrics(branch);
  const revisions = branch.revisions ?? [];
  const current = revisions.at(-1);
  return <article className="comparison-branch" data-mode={branch.mode}>
    <header><strong>{branch.mode === "none" ? "Không cache" : "Context Cache"}</strong><span role="status">{labels[branch.status] ?? branch.status}</span></header>
    <p>{branch.context ? outcomes[branch.context.outcome] : "Chưa lookup"}</p>
    <dl className="comparison-metrics">
      <dt>Tokens vào / ra / tổng</dt><dd>{metrics.usage ? `${metrics.usage.input_tokens} / ${metrics.usage.output_tokens} / ${metrics.usage.total_tokens}` : "Chưa có usage"}</dd>
      <dt>Sinh mã</dt><dd>{ms(metrics.generationMs)}</dd><dt>Workflow server</dt><dd>{ms(branch.server_workflow_ms)}</dd>
      <dt>Context / embedding</dt><dd>{ms(branch.context?.resolution_ms)} / {ms(branch.context?.embedding_ms)}</dd>
      <dt>Chuẩn bị context</dt><dd>{ms(branch.context_request?.preparation_ms)}</dd>
      <dt>Lookup browser (client báo)</dt><dd>{branch.mode === "none" ? "Không dùng" : ms(branch.context?.client_report?.lookup_ms)}</dd>
      {branch.mode === "local" && <><dt>Ghi cache (client báo)</dt><dd>{branch.client_cache_io?.length ? `${branch.client_cache_io.at(-1)!.state} · ${ms(branch.client_cache_io.at(-1)!.elapsed_ms)}` : "Chưa ghi nhận"}</dd></>}
      <dt>Lượt sinh hoàn tất / embedding</dt><dd>{metrics.generationCalls} / {branch.context?.embedding_calls ?? "—"}</dd>
    </dl>
    {(branch.error_code || branch.run?.error_code) && <p role="alert">{branch.error_code ?? branch.run?.error_code}</p>}
    {branch.run?.answer && <details><summary>Phản hồi Agent</summary><p>{branch.run.answer}</p></details>}
    {revisions.map(item => <details key={item.revision} open={item === current}>
      <summary>Revision {item.revision} · {item.tests.find(test => test.artifact_digest === item.artifact_digest)?.status ?? "Chưa test"}</summary>
      <pre className="comparison-diff">{item.diff}</pre>
      <details><summary>Source / artifact / test</summary><code>{item.artifact_digest}</code><pre>{item.content}</pre>
        {item.tests.map(test => <p key={test.job_id}>{test.status} · {test.evidence_digest ?? "Chưa có evidence"}</p>)}</details>
    </details>)}
    {!!branch.context?.decisions.length && <details><summary>Xác minh cache</summary>{branch.context.decisions.map((item, index) => <p key={index}>{item.kind} · score {item.score == null ? "chưa ghi nhận" : item.score.toFixed(3)} · {item.reason ?? "Đã xác minh"}</p>)}</details>}
    {!!branch.assessments?.length && <details><summary>Đánh giá kỹ thuật</summary>{branch.assessments.map(item => <p key={item.assessment_id}>Lượt {item.turn}: {item.technical_test_status}. Acceptance nghiên cứu: chưa đánh giá.</p>)}</details>}
    {current && <Button variant="secondary" disabled={busy || branchPending(branch)} onClick={() => onOpen(current.proposal_id)}>Chọn bản sửa</Button>}
    {branchPending(branch) && <Button variant="tertiary" disabled={busy} onClick={onCancel}>Dừng nhánh</Button>}
  </article>;
}
