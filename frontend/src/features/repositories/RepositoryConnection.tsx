"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";

export function RepositoryConnection({ busy, onConnect }: {
  busy: boolean; onConnect: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const credential = token.trim(); setToken("");
    await onConnect(credential);
  }
  return <div className="repository-connection">
    <div className="repository-welcome"><h2>{busy ? "Đang mở project…" : "Mở project"}</h2>
      {!busy && <p>Chạy <code>npm run workspace</code> trong thư mục frontend để mở phiên local.</p>}</div>
    <details className="repository-manual-connection"><summary>Kết nối bằng token</summary>
    <form onSubmit={submit} aria-label="Kết nối repository">
    <TextInput id="repository-token" label="Token truy cập" type="password" value={token}
      autoComplete="off" spellCheck={false} required disabled={busy}
      help="Chỉ giữ trong phiên này."
      onChange={(event) => setToken(event.target.value)} />
    <Button type="submit" loading={busy} loadingLabel="Đang mở mã nguồn…" disabled={!token.trim()}>Mở Workspace</Button>
    <details className="repository-token-help"><summary>Lấy token ở đâu?</summary>
      <p>Mở <code>backend/.local/control-access.env</code>, chép giá trị của <code>CONTROL_REPOSITORY_READ_TOKEN</code>, bỏ dấu nháy nếu có.</p>
    </details>
    </form></details>
  </div>;
}
