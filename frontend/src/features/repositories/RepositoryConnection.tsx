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
    const credential = token; setToken("");
    await onConnect(credential);
  }
  return <form className="repository-connection" onSubmit={submit} aria-label="Kết nối repository">
    <TextInput id="repository-token" label="Token control" type="password" value={token}
      autoComplete="off" spellCheck={false} required disabled={busy}
      help="Chỉ giữ trong bộ nhớ trang. Token báo giá không dùng ở đây."
      onChange={(event) => setToken(event.target.value)} />
    <Button type="submit" loading={busy} disabled={!token}>Kết nối</Button>
  </form>;
}
