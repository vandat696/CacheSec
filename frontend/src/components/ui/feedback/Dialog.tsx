"use client";
import { useId, type ReactNode, useEffect, useRef } from "react";
import { Button } from "../Button";
export function Dialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Xác nhận",
  cancelLabel = "Đóng",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="nui nui-theme nui-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="nui-stack">
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="nui-help" id={`${id}-description`}>
          {children}
        </p>
        <div className="nui-row">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
