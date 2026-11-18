"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { useComparison } from "./useComparison";

export function ComparisonSessions({ comparison, onOpen, onNew, onClose }: {
  comparison: ReturnType<typeof useComparison>;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { pair, history, busy, pending, error } = comparison;
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  const sessions = pair && !history.some(item => item.pair_id === pair.pair_id) ? [pair, ...history] : history;
  return <section id="comparison-sessions" className="comparison-sessions" aria-labelledby="comparison-sessions-title"
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }}>
    <header>
      <h3 ref={title} id="comparison-sessions-title" tabIndex={-1}>Phiên</h3>
      <Button id="comparison-new-session" variant="secondary" disabled={busy || pending} onClick={onNew}><Icon name="plus" />Phiên mới</Button>
      <Button variant="tertiary" aria-label="Về khung chat" title="Về khung chat" onClick={onClose}><Icon name="close" /></Button>
    </header>
    {pending && <p role="status">Chờ hai nhánh chạy xong để đổi phiên.</p>}
    {busy && <p role="status">Đang tải phiên…</p>}
    {error && <p role="alert">{error}</p>}
    {sessions.length > 0 ? <ul>
      {sessions.map(item => <li key={item.pair_id}>
        <button type="button" className="comparison-session-item" data-pair-id={item.pair_id}
          aria-current={pair?.pair_id === item.pair_id || undefined} disabled={busy || pending}
          onClick={() => onOpen(item.pair_id)}>
          <strong>{item.prompt.trim().replace(/\s+/g, " ").slice(0, 100)}</strong>
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</time>
        </button>
      </li>)}
    </ul> : !busy && <p>Chưa có phiên đã lưu.</p>}
  </section>;
}
