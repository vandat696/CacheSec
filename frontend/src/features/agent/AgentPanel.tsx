"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { useRepository } from "../repositories/useRepository";
import { editablePath, type Revision } from "../code-changes/changeWorkflowApi";
import { ChangeApiError } from "../code-changes/changeWorkflowApi";
import { AgentApiError, type AgentConfig, type AgentMessage, type AgentReply } from "./agentApi";
import { AgentInformation } from "./AgentInformation";

type Message = AgentMessage & { reply?: AgentReply };
export function AgentPanel({ repo, hidden, guardAction, onOpenProposal }: {
  repo: ReturnType<typeof useRepository>; hidden: boolean; guardAction: (action: () => void) => void;
  onOpenProposal: (id: string) => void;
}) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ reply: AgentReply; revision: Revision } | null>(null);
  const request = useRef<AbortController | null>(null);
  const attempts = useRef(new Map<AgentReply, string>());
  const log = useRef<HTMLDivElement>(null);
  const api = repo.agent;
  const disconnected = useRef(repo.disconnect);
  useEffect(() => { disconnected.current = repo.disconnect; }, [repo.disconnect]);
  function fail(value: unknown) {
    setError(value instanceof ChangeApiError ? value.message : "Không kết nối được Agent. Có thể thử lại.");
    if (value instanceof ChangeApiError && [401, 403].includes(value.status)) disconnected.current();
  }
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    api.config(controller.signal).then(value => { if (!controller.signal.aborted) setConfig(value); })
      .catch(value => { if (!controller.signal.aborted) fail(value); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [api]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "instant" }); }, [messages, busy]);

  async function refreshConfig() {
    if (!api || busy) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setError(""); setBusy(true);
    try { const value = await api.config(controller.signal); if (!controller.signal.aborted) setConfig(value); }
    catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!api || !repo.snapshot || !config?.configured || busy || !draft.trim()) return;
    const prompt = draft.trim(), snapshot = repo.snapshot;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    const history = messages.slice(-12).map(({ role, content }) => ({ role, content }));
    // Keep each request bounded; old messages stay visible but are not all resent.
    while (history.reduce((size, item) => size + new TextEncoder().encode(item.content).length, 0) > 24000) history.shift();
    setBusy(true); setError("");
    try {
      const reply = await api.ask(snapshot.snapshot_id, prompt, history, controller.signal);
      if (controller.signal.aborted) return;
      if (reply.repository_identity !== repo.repository?.repository_identity || reply.manifest_digest !== snapshot.manifest_digest
        || reply.editable_path !== editablePath) throw new AgentApiError(502);
      setMessages(previous => [...previous, { role: "user", content: prompt }, { role: "assistant", content: reply.answer, reply }]);
      setDraft("");
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function apply(reply: AgentReply) {
    if (!repo.changes || !repo.snapshot || reply.content === null || busy) return;
    const controller = new AbortController(); request.current = controller;
    const key = attempts.current.get(reply) ?? crypto.randomUUID(); attempts.current.set(reply, key);
    setBusy(true); setError("");
    try {
      const revision = await repo.changes.save(repo.snapshot.snapshot_id, reply.content, null, key, controller.signal);
      if (!controller.signal.aborted) { setSaved({ reply, revision }); onOpenProposal(revision.proposal_id); }
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="dev-assistant" hidden={hidden} aria-labelledby="dev-agent-title" data-agent-ready={!!config?.configured}>
    <div className="dev-agent-heading"><Icon name="spark" /><h2 id="dev-agent-title">Agent</h2>
      <AgentInformation config={config} connected={!!api} fileCount={repo.snapshot?.files.length ?? 0}
        busy={busy} onRefresh={() => { void refreshConfig(); }} />
    </div>
    <div className="dev-messages" role="log" aria-label="Hội thoại với Agent" aria-live="polite" ref={log}>
      {messages.map((message, index) => <article key={index} className={`dev-message ${message.role === "user" ? "developer" : "assistant"}`}>
        <p>{message.content}</p>
        {message.reply?.content !== null && message.reply?.content !== undefined && <div className="agent-proposal">
          <details><summary>Xem đề xuất sửa</summary><pre>{message.reply.content}</pre></details>
          <Button variant="secondary" disabled={busy || saved?.reply === message.reply}
            onClick={() => guardAction(() => { void apply(message.reply!); })}>
            {saved?.reply === message.reply ? "Đã áp dụng" : "Áp dụng bản sửa"}</Button>
          {saved?.reply === message.reply && <span>Xem diff bên trái, rồi chạy test.</span>}
        </div>}
      </article>)}
      {busy && <p className="agent-empty" role="status">Đang xử lý…</p>}
    </div>
    {error && <p className="dev-input-error agent-error" role="alert">{error}</p>}
    <form className="dev-composer" onSubmit={send}>
      <div><textarea id="agent-prompt" aria-label="Nhắn cho Agent" value={draft} maxLength={4000} rows={3} disabled={!config?.configured || busy}
        placeholder="Hỏi về mã nguồn hoặc yêu cầu sửa…" onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <Button type="submit" aria-label="Gửi yêu cầu" disabled={!config?.configured || busy || !draft.trim()}><Icon name="send" /></Button></div>
    </form>
  </section>;
}
