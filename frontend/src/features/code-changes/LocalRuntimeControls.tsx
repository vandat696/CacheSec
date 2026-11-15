"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ChangeApiError, type ChangeWorkflowClient, type Revision, type TestJob } from "./changeWorkflowApi";
import { ReviewAndRunDialog } from "./ReviewAndRunDialog";
import type { WorkspaceConfig, WorkspaceOperation } from "./workspaceRuntimeModel";
import { waitForOperation } from "./workspaceOperations";

export function LocalRuntimeControls({ api, config, revision, jobs, dirty, disabled }: {
  api: ChangeWorkflowClient | null; config: WorkspaceConfig | null; revision: Revision | null;
  jobs: TestJob[]; dirty: boolean; disabled: boolean;
}) {
  const [review, setReview] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<WorkspaceOperation | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const attempts = useRef<{ artifact: string; approveKey: string; activateKey: string; approvalId?: string; version?: number } | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  if (!config?.can_read) return null;
  const passed = jobs.find(job => job.status === "passed" && job.artifact_digest === revision?.artifact_digest && job.revision === revision?.revision);
  const canRun = !!api && !!revision && !!passed && !dirty && !disabled && !busy
    && config.configured && config.can_review && config.can_activate && !config.pending_id;
  async function activate() {
    const selected = review;
    setReview(null);
    if (!selected || !api || !passed || dirty || revision?.artifact_digest !== selected.artifact_digest || busy) return;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setBusy(true); setError("");
    try {
      if (attempts.current?.artifact !== selected.artifact_digest) attempts.current = {
        artifact: selected.artifact_digest, approveKey: crypto.randomUUID(), activateKey: crypto.randomUUID(),
      };
      const attempt = attempts.current;
      if (!attempt.approvalId) {
        const current = await api.workspaceConfig(controller.signal);
        if (current.target_version === null) throw new ChangeApiError(503);
        const approval = await api.approve(selected, passed, attempt.approveKey, controller.signal);
        attempt.approvalId = approval.id; attempt.version = current.target_version;
      }
      const started = await api.activate(attempt.approvalId, attempt.version!, attempt.activateKey, controller.signal);
      const finished = await waitForOperation(api, started, controller.signal, setOperation);
      if (!controller.signal.aborted) { setOperation(finished); setVersion(attempt.version! + 1); }
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof ChangeApiError ? value.message : "Không kết nối được bộ chạy ứng dụng.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="workspace-runtime-controls">
    <Button id="workspace-run" variant="secondary" disabled={!canRun} loading={busy}
      title={!passed ? "Cần test đạt cho bản sửa hiện tại" : "Xem diff, phê duyệt rồi chạy đúng artifact"}
      onClick={() => setReview(revision)}>Chạy ứng dụng</Button>
    {busy && <span role="status">{operation?.status === "queued" ? "Chờ worker…" : "Đang chạy bản mới…"}</span>}
    {operation?.status === "succeeded" && <Link href="/quotations">Đang chạy bản {version} · Mở Báo giá</Link>}
    {!operation && config.active_artifact && <Link href="/quotations">Ứng dụng · Bản {config.target_version}</Link>}
    {!operation && config.pending_id && <span role="status">Ứng dụng đang chờ worker hoặc đối soát.</span>}
    {error && <span role="alert" className="repository-error">{error}</span>}
    <ReviewAndRunDialog revision={review} onCancel={() => setReview(null)} onApprove={() => { void activate(); }} />
  </div>;
}
