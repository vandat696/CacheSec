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
    <form className="quotation-connection" onSubmit={submit} aria-label="Kết nối API báo giá">
      <TextInput id="quotation-token" label="Token fixture" type="password" value={token}
        autoComplete="off" spellCheck={false} required disabled={busy}
        help="Chỉ giữ trong bộ nhớ trang. Rời trang cần kết nối lại."
        onChange={(event) => setToken(event.target.value)} />
      <Button type="submit" loading={busy} loadingLabel="Đang kết nối…" disabled={!token.trim()}>Kết nối</Button>
    </form>
  );
}
