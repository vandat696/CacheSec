"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChangeWorkflowClient } from "../code-changes/changeWorkflowApi";
import type { WorkspaceConfig } from "../code-changes/workspaceRuntimeModel";
import { initializeLocalWorkspace, localSessionEnded } from "../local-workspace/localWorkspaceClient";

export function QuotationRuntimeStatus({ onChanged }: { onChanged: () => void }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const previous = useRef<string | null>(null);
  const changed = useEffectEvent(onChanged);
  useEffect(() => {
    if (pathname !== "/quotations") return;
    const controller = new AbortController();
    const ended = () => { controller.abort(); previous.current = null; setConfig(null); setUnavailable(false); };
    window.addEventListener(localSessionEnded, ended);
    async function refresh() {
      try {
        if (!await initializeLocalWorkspace()) return;
        const result = await new ChangeWorkflowClient("/api/local-control", null).workspaceConfig(controller.signal);
        if (controller.signal.aborted) return;
        const identity = JSON.stringify([result.target_version, result.active_artifact, result.pending_id]);
        if (previous.current !== null && previous.current !== identity) changed();
        previous.current = identity; setConfig(result); setUnavailable(false);
      } catch {
        if (!controller.signal.aborted) { setConfig(null); setUnavailable(true); changed(); }
      }
    }
    void refresh();
    return () => { controller.abort(); window.removeEventListener(localSessionEnded, ended); };
  }, [pathname]);
  if (unavailable) return <p role="status" className="quotation-note">Chưa đọc được trạng thái triển khai. Mở lại Workspace để kiểm tra kết nối.</p>;
  if (!config?.can_read) return null;
  return <div className="quotation-runtime-status">
    <span>{config.pending_id ? "Đang chuyển bản triển khai" : `Bản triển khai ${config.target_version ?? "—"}`}</span>
    <Link href="/workspace">Mở Workspace</Link>
    {config.active_artifact && <details><summary>Artifact đã triển khai</summary><code>{config.active_artifact}</code></details>}
  </div>;
}
