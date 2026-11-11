import { type TestJob } from "./changeWorkflowApi";

const labels: Record<string, string> = { queued: "Đang chờ chạy", preparing: "Đang chuẩn bị",
  running: "Đang kiểm thử", passed: "Đạt", failed: "Không đạt", error: "Lỗi thực thi",
  timed_out: "Hết thời gian", blocked: "Đã chặn", unknown: "Chưa xác định" };
const checks: Record<string, string> = { identity_required: "Yêu cầu danh tính",
  record_round_trip: "Tạo và đọc báo giá", reader_write_denied: "Chặn reader ghi dữ liệu",
  idempotent_retry: "Thử lại không tạo trùng", validation_contract: "API validation" };
const reasons: Record<string, string> = { CHECK_FAILED: "Có kiểm tra chưa đạt.",
  APP_START_FAILED: "Bản sửa không khởi động được.", APP_START_TIMEOUT: "Bản sửa khởi động quá lâu.",
  HTTP_TIMEOUT: "Bản sửa phản hồi quá lâu.", TEST_DEADLINE: "Đã hết thời gian kiểm thử.",
  OUTPUT_LIMIT: "Bản sửa xuất quá nhiều dữ liệu.", SANDBOX_UNAVAILABLE: "Chưa tạo được môi trường kiểm thử.",
  PROFILE_MISMATCH: "Cấu hình kiểm thử không còn khớp.", WORKER_INTERRUPTED: "Tiến trình kiểm thử đã bị ngắt.",
  EXECUTOR_ERROR: "Không chạy được kiểm thử. Xem chi tiết để đối chiếu.",
  CLEANUP_UNCERTAIN: "Chưa xác nhận dọn xong môi trường kiểm thử.",
  REQUESTER_ACCESS_DENIED: "Quyền chạy kiểm thử không còn hiệu lực.",
  REQUESTER_OR_SOURCE_CHANGED: "Quyền hoặc mã nguồn đã thay đổi. Hãy mở bản mới." };
export function TestRunPanel({ jobs, revision, dirty = false }: { jobs: TestJob[]; revision: number; dirty?: boolean }) {
  return <div className="change-test-runs" aria-live="polite">{jobs.map(job =>
    <details key={job.job_id} className="change-test-run" data-status={job.status}
      open={job.job_id === jobs[0]?.job_id && job.revision === revision}>
      <summary>{labels[job.status]} · Bản {job.revision}
        {job.revision !== revision && " · Bản cũ"}
        {job.result && ` · ${(job.result.elapsed_ms / 1000).toFixed(1)} s`}</summary>
      {dirty && job.revision === revision && <p>Áp dụng cho bản đã lưu; mã đang sửa chưa được kiểm thử.</p>}
      {job.result && <>{job.result.reason !== "COMPLETED" && <p>{reasons[job.result.reason] ?? "Chưa xác minh được kết quả kiểm thử."}</p>}
        <ul>{job.result.checks.map(check =>
        <li key={check.name}>{check.passed ? "✓" : "✕"} {checks[check.name] ?? check.name}</li>)}</ul></>}
      <details className="change-test-reference"><summary>Chi tiết kỹ thuật</summary>
        <dl><dt>Job</dt><dd>{job.job_id}</dd><dt>Artifact</dt><dd>{job.artifact_digest}</dd>
          {job.result && <><dt>Mã kết quả</dt><dd>{job.result.reason}</dd></>}
          {job.evidence_digest && <><dt>Evidence</dt><dd>{job.evidence_digest}</dd></>}</dl>
      </details>
    </details>)}</div>;
}
