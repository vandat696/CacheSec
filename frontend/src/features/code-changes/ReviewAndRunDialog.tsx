"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { Revision } from "./changeWorkflowApi";

export function ReviewAndRunDialog({ revision, onCancel, onApprove, sourceLabel }: {
  revision: Revision | null; onCancel: () => void; onApprove: () => void;
  sourceLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!revision || !dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, [revision]);
  return <dialog ref={ref} className="nui nui-theme nui-dialog workspace-review-dialog" aria-labelledby={title}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id={title}>Duyệt bản sửa và chạy ứng dụng</h2>
    {revision && <>
      {sourceLabel && <p data-review-source={sourceLabel}>{sourceLabel} · Bản {revision.revision}</p>}
      <p>Áp dụng bản {revision.revision} đã kiểm thử cho ứng dụng Báo giá.</p>
      <pre aria-label="Diff cần phê duyệt"><code>{revision.diff || "Không đổi source so với snapshot gốc."}</code></pre>
      <details><summary>Artifact</summary><code>{revision.artifact_digest}</code></details>
    </>}
    <div className="nui-row">
      <Button variant="secondary" onClick={onCancel}>Hủy</Button>
      <Button id={sourceLabel ? "comparison-approve-run" : "workspace-approve-run"} onClick={onApprove}>Phê duyệt và chạy bản này</Button>
    </div>
  </dialog>;
}
