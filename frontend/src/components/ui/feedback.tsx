"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./button";

export type BadgeTone = "primary" | "success" | "danger" | "neutral";
export function Badge({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className="nui nui-theme nui-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function Alert({
  title,
  children,
  tone,
}: {
  title: string;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <div
      className="nui nui-theme nui-alert"
      role={tone === "danger" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <p className="nui-help">{children}</p>
    </div>
  );
}

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

const ToastContext = createContext<((message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="app-toast nui nui-theme nui-toast-area"
        role="status"
        aria-live="polite"
      >
        {message && (
          <div className="nui-toast">
            <span>{message}</span>
            <button
              type="button"
              onClick={() => {
                clearTimeout(timer.current);
                setMessage("");
              }}
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast phải nằm trong ToastProvider.");
  return showToast;
}
