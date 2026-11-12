"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";

export function QuotationConnection({ busy, onConnect }: {
  busy: boolean; onConnect: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const credential = token.trim();
    if (!credential) return;
    setToken("");
    await onConnect(credential);
  }
  return (
    <div className="quotation-connection">
      <p>{busy ? "Đang mở Báo giá…" : "Chạy npm run workspace trong frontend để mở phiên local."}</p>
      <details className="quotation-manual-connection"><summary>Kết nối bằng token</summary>
      <form onSubmit={submit} aria-label="Kết nối API báo giá">
      <TextInput id="quotation-token" label="Token fixture" type="password" value={token}
        autoComplete="off" spellCheck={false} required disabled={busy}
        help="Chỉ dùng cho kết nối thủ công."
        onChange={(event) => setToken(event.target.value)} />
      <Button type="submit" loading={busy} loadingLabel="Đang kết nối…" disabled={!token.trim()}>Kết nối</Button>
      </form></details>
    </div>
  );
}
