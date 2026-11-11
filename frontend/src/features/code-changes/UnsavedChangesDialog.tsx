"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: {
  open: boolean; onSave: () => Promise<boolean>; onDiscard: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current, trigger = document.activeElement;
    element.showModal();
    return () => { element.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, [open]);
  async function save() {
    setBusy(true); setError(false);
    try { if (!await onSave()) setError(true); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="nui nui-theme nui-dialog" aria-labelledby="unsaved-title"
    onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault(); event.stopPropagation(); if (!busy) void save(); } }}
    onCancel={event => { event.preventDefault(); if (!busy) { setError(false); onCancel(); } }}>
    <h2 id="unsaved-title">Lưu thay đổi trước khi tiếp tục?</h2>
    <p className="nui-help">quotation_validation.py có thay đổi chưa lưu.</p>
    {error && <p role="alert">Chưa lưu được. Bản đang sửa vẫn được giữ.</p>}
    <div className="nui-row">
      <Button variant="tertiary" disabled={busy} onClick={() => { setError(false); onCancel(); }}>Hủy</Button>
      <Button variant="secondary" disabled={busy} onClick={() => { setError(false); onDiscard(); }}>Không lưu</Button>
      <Button loading={busy} onClick={() => { void save(); }}>Lưu</Button>
    </div>
  </dialog>;
}
