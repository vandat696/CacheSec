"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { AgentConfig } from "./agentApi";

export function AgentInformation({ config, connected, fileCount, busy, onRefresh }: {
  config: AgentConfig | null; connected: boolean; fileCount: number; busy: boolean; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); setOpen(false); trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="agent-information" ref={root} onKeyDown={event => {
    if (event.key === "Tab") requestAnimationFrame(() => {
      if (!root.current?.contains(document.activeElement)) setOpen(false);
    });
  }}>
    <Button ref={trigger} className="agent-information-trigger" variant="tertiary" aria-label="Thông tin Agent"
      title="Thông tin Agent" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Icon name="info" />
    </Button>
    <div id={id} className="agent-information-panel" hidden={!open} role="region" aria-label="Thông tin Agent">
      <strong>GPT-6.1 Sol</strong>
      {!connected ? <p>Mở project để bắt đầu.</p> : <>
        <p>{config ? config.configured ? "Đã cấu hình API key." : "Chưa cấu hình API key OpenAI." : "Đang đọc cấu hình…"}</p>
        {config && !config.configured && <p>Đặt <code>OPENAI_API_KEY</code> trong <code>backend/.local/agent-config/openai.env</code>, rồi tải lại cấu hình.</p>}
        <p>Source gốc · {fileCount} tệp</p>
        <Button variant="secondary" onClick={onRefresh} disabled={busy} aria-label="Tải lại cấu hình Agent">
          <Icon name="refresh" />Tải lại cấu hình
        </Button>
      </>}
      <p className="agent-information-note">AI có thể mắc lỗi, hãy kiểm tra lại.</p>
    </div>
  </div>;
}
