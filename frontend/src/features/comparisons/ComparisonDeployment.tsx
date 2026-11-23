"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ChangeWorkflowClient, Revision } from "../code-changes/changeWorkflowApi";
import { ChangeApiError } from "../code-changes/changeWorkflowApi";
import { LocalRuntimeControls } from "../code-changes/LocalRuntimeControls";
import type { WorkspaceConfig } from "../code-changes/workspaceRuntimeModel";

export function ComparisonDeployment({ api, revision, label, onBusyChange }: {
  api: ChangeWorkflowClient; revision: Revision; label: string; onBusyChange: (value: boolean) => void;
}) {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api.workspaceConfig(controller.signal).then(value => { if (!controller.signal.aborted) setConfig(value); })
      .catch(value => { if (!controller.signal.aborted) setError(value instanceof ChangeApiError ? value.message : "Chưa đọc được cấu hình triển khai."); });
    return () => controller.abort();
  }, [api]);
  return <section className="comparison-deployment" aria-label="Bản chọn để chạy">
    <p><strong>Bản chạy: {label} · Bản {revision.revision}</strong></p>
    {error && <p role="alert">{error}</p>}
    {!config && !error && <p role="status">Đang kiểm tra quyền triển khai…</p>}
    {config && <LocalRuntimeControls api={api} config={config} revision={revision} jobs={revision.tests}
      dirty={false} disabled={false} sourceLabel={label} onBusyChange={onBusyChange} />}
    <Link href="/quotations">Mở ứng dụng Báo giá</Link>
  </section>;
}
