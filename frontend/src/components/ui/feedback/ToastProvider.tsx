"use client";
import {
  useState,
  type ReactNode,
  useEffect,
  useRef,
  createContext,
  useCallback,
  useContext,
} from "react";
const ToastContext = createContext<((message: string) => void) | null>(
  null,
);
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
