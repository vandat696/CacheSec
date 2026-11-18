"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { useRepository } from "../repositories/useRepository";
import { editablePath, type Revision } from "../code-changes/changeWorkflowApi";
import { ChangeApiError } from "../code-changes/changeWorkflowApi";
import { AgentApiError, type AgentConfig, type AgentMessage, type AgentModelId, type AgentReply } from "./agentApi";
import { AgentInformation } from "./AgentInformation";
import { AgentOptions } from "./AgentOptions";
import { AgentRunStatus } from "./AgentRunStatus";
import { pendingAgentRun } from "./agentRunModel";
import { useAgentRun } from "./useAgentRun";
import { ComparisonPanel } from "../comparisons/ComparisonPanel";
import { ComparisonSessions } from "../comparisons/ComparisonSessions";
import { ComparisonOptions } from "../comparisons/ComparisonOptions";
import type { ComparisonSummary } from "../comparisons/comparisonModel";
import type { useComparison } from "../comparisons/useComparison";

type Message = AgentMessage & { reply?: AgentReply };
export function AgentPanel({ repo, hidden, comparison, comparisonRun, cacheState, onCacheState, onToggleComparison, guardAction, onOpenProposal }: {
  repo: ReturnType<typeof useRepository>; hidden: boolean; comparison: boolean;
  comparisonRun: ReturnType<typeof useComparison>;
  cacheState: ComparisonSummary["cache_state"];
  onCacheState: (state: ComparisonSummary["cache_state"]) => void;
  onToggleComparison: () => void; guardAction: (action: () => void) => void;
  onOpenProposal: (id: string) => void;
}) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [chosenModel, setChosenModel] = useState<AgentModelId>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [composerVersion, setComposerVersion] = useState(0);
  const [saved, setSaved] = useState<{ reply: AgentReply; revision: Revision } | null>(null);
  const request = useRef<AbortController | null>(null);
  const attempts = useRef(new Map<AgentReply, string>());
  const log = useRef<HTMLDivElement>(null);
  const sessionsButton = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const comparisonComposer = useRef<HTMLTextAreaElement>(null);
  const api = repo.agent;
  const [configOwner, setConfigOwner] = useState(api);
  if (configOwner !== api) {
    setConfigOwner(api);
    setConfig(null);
    setChosenModel(undefined);
    setBusy(false);
    setError("");
  }
  const disconnected = useRef(repo.disconnect);
  useEffect(() => { disconnected.current = repo.disconnect; }, [repo.disconnect]);
  function fail(value: unknown) {
    setError(value instanceof ChangeApiError ? value.message : "Không kết nối được Agent. Có thể thử lại.");
    if (value instanceof ChangeApiError && [401, 403].includes(value.status)) disconnected.current();
  }
  const automation = useAgentRun(api, repo.repository, config?.automation?.active_run_id ?? null, value => {
    if (value instanceof ChangeApiError && [401, 403].includes(value.status)) disconnected.current();
  });
  const blocked = busy || automation.busy || !!(automation.run && pendingAgentRun(automation.run));
  const model = chosenModel && config?.models?.includes(chosenModel) ? chosenModel : config?.model;
  const requestModel = config?.models ? model : undefined;
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    api.config(controller.signal).then(value => { if (!controller.signal.aborted) setConfig(value); })
      .catch(value => { if (!controller.signal.aborted) fail(value); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [api]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "instant" }); }, [messages, busy]);

  async function refreshConfig() {
    if (!api || blocked) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setError(""); setBusy(true);
    try { const value = await api.config(controller.signal); if (!controller.signal.aborted) setConfig(value); }
    catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!api || !repo.snapshot || !config?.configured || blocked || !draft.trim()) return;
    const prompt = draft.trim(), snapshot = repo.contextSnapshot ?? repo.snapshot;
    if (automatic) {
      if (!config.automation?.can_start) return;
      if (await automation.start(snapshot.snapshot_id, prompt, requestModel)) setDraft("");
      return;
    }
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    const history = messages.slice(-12).map(({ role, content }) => ({ role, content }));
    // Keep each request bounded; old messages stay visible but are not all resent.
    while (history.reduce((size, item) => size + new TextEncoder().encode(item.content).length, 0) > 24000) history.shift();
    setBusy(true); setError("");
    try {
      const reply = await api.ask(snapshot.snapshot_id, prompt, history, controller.signal, requestModel);
      if (controller.signal.aborted) return;
      if (reply.repository_identity !== repo.repository?.repository_identity || reply.manifest_digest !== snapshot.manifest_digest
        || reply.editable_path !== editablePath) throw new AgentApiError(502);
      setMessages(previous => [...previous, { role: "user", content: prompt }, { role: "assistant", content: reply.answer, reply }]);
      setDraft("");
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function apply(reply: AgentReply) {
    if (!repo.changes || !repo.snapshot || reply.content === null || blocked) return;
    const controller = new AbortController(); request.current = controller;
    const key = attempts.current.get(reply) ?? crypto.randomUUID(); attempts.current.set(reply, key);
    setBusy(true); setError("");
    try {
      const revision = await repo.changes.save(reply.snapshot_id, reply.content, null, key, controller.signal);
      if (!controller.signal.aborted) { setSaved({ reply, revision }); onOpenProposal(revision.proposal_id); }
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function closeSessions() {
    setSessionsOpen(false);
    sessionsButton.current?.focus();
  }
  function finishSessionChange(resetDraft: boolean) {
    if (resetDraft) setComposerVersion(value => value + 1);
    setSessionsOpen(false);
    requestAnimationFrame(() => {
      const composer = comparisonComposer.current;
      if (composer && !composer.disabled) composer.focus();
      else sessionsButton.current?.focus();
    });
  }
  async function openSession(id: string) {
    if (id === comparisonRun.pair?.pair_id) finishSessionChange(false);
    else if (await comparisonRun.open(id)) finishSessionChange(true);
  }
  return <section id="workspace-agent" className="dev-assistant" hidden={hidden} aria-labelledby="dev-agent-title" data-agent-ready={!!config?.configured}>
    <header className="dev-agent-navbar">
      <div className="dev-agent-heading">
        <Icon name="spark" /><h2 id="dev-agent-title">Agent</h2>
        <Button id="agent-comparison-toggle" variant="tertiary" aria-pressed={comparison}
          disabled={blocked || comparisonRun.busy || comparisonRun.pending}
          onClick={() => { setSessionsOpen(false); onToggleComparison(); }}>
          Cả hai
        </Button>
        <div className="dev-agent-controls">
          {comparison && <Button ref={sessionsButton} id="agent-session-toggle" variant="tertiary" aria-label="Lịch sử phiên"
            title="Lịch sử phiên" aria-expanded={sessionsOpen} aria-controls={sessionsOpen ? "comparison-sessions" : undefined}
            disabled={!api} onClick={() => { optionsRef.current?.removeAttribute("open"); setSessionsOpen(value => !value); }}>
            <Icon name="clock" />
          </Button>}
          <AgentOptions optionsRef={optionsRef} config={config} model={model} onModel={setChosenModel}
            disabled={!api || !config?.configured || blocked || comparisonRun.busy || comparisonRun.pending}>
            {comparison && <ComparisonOptions comparison={comparisonRun} cacheState={cacheState} onCacheState={onCacheState} />}
          </AgentOptions>
          <AgentInformation config={config} modelId={model} connected={!!api} fileCount={repo.snapshot?.files.length ?? 0}
            busy={blocked} onRefresh={() => { void refreshConfig(); }} />
        </div>
      </div>
    </header>
    {comparison ? <>
      {sessionsOpen && <ComparisonSessions comparison={comparisonRun} onOpen={id => { void openSession(id); }}
        onNew={() => { if (comparisonRun.newSession()) finishSessionChange(true); }} onClose={closeSessions} />}
      <ComparisonPanel key={`${repo.repository?.repository_identity ?? "disconnected"}:${composerVersion}`}
        comparison={comparisonRun} snapshotId={(repo.contextSnapshot ?? repo.snapshot)?.snapshot_id ?? null}
        cacheState={cacheState} hidden={sessionsOpen} composerRef={comparisonComposer} model={requestModel}
        enabled={!!config?.configured && !!config.automation?.can_start}
        unavailable={error || (config ? !config.configured ? "Chưa cấu hình model." : !config.automation?.can_start ? "Phiên này chưa có quyền chạy hai nhánh." : undefined : undefined)} />
    </> : <>
    <div className="dev-messages" role="log" aria-label="Hội thoại với Agent" aria-live="polite" ref={log}>
      <AgentRunStatus run={automation.run} busy={automation.busy} error={automation.error}
        onCancel={() => { void automation.cancel(); }} onRefresh={automation.refresh}
        onOpen={id => guardAction(() => onOpenProposal(id))} />
      {messages.map((message, index) => <article key={index} className={`dev-message ${message.role === "user" ? "developer" : "assistant"}`}>
        <p>{message.content}</p>
        {message.reply?.content !== null && message.reply?.content !== undefined && <div className="agent-proposal">
          <details><summary>Xem đề xuất sửa</summary><pre>{message.reply.content}</pre></details>
          <Button variant="secondary" disabled={blocked || saved?.reply === message.reply}
            onClick={() => guardAction(() => { void apply(message.reply!); })}>
            {saved?.reply === message.reply ? "Đã áp dụng" : "Áp dụng bản sửa"}</Button>
          {saved?.reply === message.reply && <span>Xem diff bên trái, rồi chạy test.</span>}
        </div>}
      </article>)}
      {busy && <p className="agent-empty" role="status">Đang xử lý…</p>}
    </div>
    {error && <p className="dev-input-error agent-error" role="alert">{error}</p>}
    <form className="dev-composer" onSubmit={send}>
      <label className="agent-run-option"><input type="checkbox" checked={automatic}
        disabled={blocked || !config?.automation?.can_start} onChange={event => setAutomatic(event.target.checked)} />Tự sửa và test</label>
      {automatic && <p className="agent-information-note">Gửi 3 tệp source và kết quả test tới model; chỉ sửa bản riêng, tối đa 3 lượt / 10 phút.</p>}
      {config?.automation && !config.automation.can_start && <p className="agent-information-note">Phiên chưa có quyền chạy Agent tự động.</p>}
      <div><textarea id="agent-prompt" aria-label="Nhắn cho Agent" value={draft} maxLength={4000} rows={3} disabled={!config?.configured || blocked}
        placeholder="Hỏi về mã nguồn hoặc yêu cầu sửa…" onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <Button type="submit" aria-label="Gửi yêu cầu" disabled={!config?.configured || blocked || !draft.trim()}><Icon name="send" /></Button></div>
    </form>
    </>}
  </section>;
}
