"use client";

import { Button } from "@/components/ui/Button";
import { pendingAgentRun, type AgentRun } from "./agentRunModel";

const labels: Record<string, string> = {
  queued: "Đang chuẩn bị", generating: "Đang phân tích và sửa", saving: "Đang lưu bản riêng",
  testing: "Đang chạy test Docker", passed: "Test kỹ thuật đạt", needs_input: "Cần bạn xem xét",
  exhausted: "Đã hết lượt sửa", cancelled: "Đã dừng", timed_out: "Hết thời gian", error: "Lượt Agent bị lỗi",
};
const errors: Record<string, string> = {
  AGENT_ACCESS_REVOKED: "Quyền đã thay đổi; Agent đã dừng.", STALE_SNAPSHOT: "Source đã đổi; cần mở snapshot mới.",
  MODEL_RATE_LIMIT: "Đã chạm hạn mức model.", MODEL_UNAVAILABLE: "Model tạm thời chưa khả dụng.",
  AGENT_BINDING_MISMATCH: "Bản sửa hoặc kết quả test không còn khớp.",
  STALE_REVISION: "Bản sửa đã đổi bên ngoài lượt Agent.", STORAGE_UNAVAILABLE: "Chưa xác định đủ kết quả thao tác lưu.",
};
export function AgentRunStatus({ run, busy, error, onCancel, onRefresh, onOpen }: {
  run: AgentRun | null; busy: boolean; error: string; onCancel: () => void;
  onRefresh: () => void; onOpen: (id: string) => void;
}) {
  if (!run && !error) return null;
  const pending = run ? pendingAgentRun(run) : false;
  const cancelling = run?.events.some(event => event.state === "cancel_requested");
  return <div className="agent-proposal agent-run" role="region" aria-label="Tiến trình Agent" data-status={run?.status}>
    {run && <>
      <strong role="status">{labels[run.status]} · {run.turn}/{run.max_turns}</strong>
      {run.answer && <p>{run.answer}</p>}
      {run.error_code && <p role="alert">{errors[run.error_code] ?? "Không hoàn tất được lượt Agent. Xem bản sửa và kết quả đã lưu."}</p>}
      {run.test_may_continue && !pending && <p>Job Docker đã nhận có thể tiếp tục trong giới hạn riêng.</p>}
      <details><summary>Các bước</summary><ol>{run.events.map(event => <li key={event.sequence}>
        {({ read_source: "Đọc source", generate: "Model", save_revision: "Lưu bản sửa", test: "Test", storage: "Lưu trữ", run: "Agent" } as Record<string, string>)[event.tool]}
        {" · "}{({ started: "bắt đầu", accepted: "đã nhận", completed: "hoàn tất", passed: "đạt", failed: "chưa đạt", cancel_requested: "yêu cầu dừng", effect_unknown: "kết quả chưa rõ" } as Record<string, string>)[event.state] ?? labels[event.state] ?? "đã dừng"}
      </li>)}</ol></details>
      {pending && <Button variant="secondary" onClick={onCancel} disabled={busy || cancelling}>{cancelling ? "Đang dừng…" : "Dừng Agent"}</Button>}
      {!pending && run.proposal_id && <Button variant="secondary" onClick={() => onOpen(run.proposal_id!)}>Xem bản sửa</Button>}
    </>}
    {error && <><p role="alert">{error}</p><Button variant="secondary" onClick={onRefresh}>Tải lại tiến trình</Button></>}
  </div>;
}
