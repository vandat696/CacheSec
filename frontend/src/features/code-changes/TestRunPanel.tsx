import { type TestJob } from "./changeWorkflowApi";

const labels: Record<string, string> = { queued: "Chờ worker", preparing: "Chuẩn bị sandbox",
  running: "Đang chạy", passed: "Đạt", failed: "Không đạt", error: "Lỗi thực thi",
  timed_out: "Hết thời gian", blocked: "Đã chặn", unknown: "Chưa xác định" };
const checks: Record<string, string> = { identity_required: "Yêu cầu danh tính",
  record_round_trip: "Tạo và đọc báo giá", reader_write_denied: "Chặn reader ghi dữ liệu",
  idempotent_retry: "Thử lại không tạo trùng", validation_contract: "API validation" };
export function TestRunPanel({ jobs, revision }: { jobs: TestJob[]; revision: number }) {
  return <div className="change-test-runs" aria-live="polite">{jobs.map(job =>
    <details key={job.job_id} className="change-test-run" data-status={job.status}>
      <summary>r{job.revision} · {labels[job.status]}
        {job.revision !== revision && " · Bản cũ"}
        {job.result && ` · ${(job.result.elapsed_ms / 1000).toFixed(1)} s`}</summary>
      {job.result && <><p>{job.result.reason}</p><ul>{job.result.checks.map(check =>
        <li key={check.name}>{check.passed ? "✓" : "✕"} {checks[check.name] ?? check.name}</li>)}</ul></>}
      <dl><dt>Job</dt><dd>{job.job_id}</dd><dt>Artifact</dt><dd>{job.artifact_digest}</dd>
        {job.evidence_digest && <><dt>Evidence</dt><dd>{job.evidence_digest}</dd></>}</dl>
    </details>)}</div>;
}
