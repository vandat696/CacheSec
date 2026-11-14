"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { AgentHttpClient } from "./agentApi";
import { AgentApiError } from "./agentApi";
import { pendingAgentRun, type AgentRun } from "./agentRunModel";

export function useAgentRun(api: AgentHttpClient | null, scope: { tenant_id: string; repo_id: string } | null,
  activeId: string | null, onFailure: (error: unknown) => void) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const failure = useRef(onFailure);
  const mutation = useRef<AbortController | null>(null);
  const attempt = useRef<{ snapshot: string; prompt: string; key: string } | null>(null);
  useEffect(() => { failure.current = onFailure; }, [onFailure]);
  const tenantId = scope?.tenant_id, repoId = scope?.repo_id;
  const [owner, setOwner] = useState({ api, tenantId, repoId });
  if (owner.api !== api || owner.tenantId !== tenantId || owner.repoId !== repoId) {
    setOwner({ api, tenantId, repoId }); setRun(null); setError(""); setBusy(false);
  }
  function bound(value: AgentRun) {
    if (value.tenant_id !== tenantId || value.repo_id !== repoId) throw new AgentApiError(502);
    return value;
  }
  function fail(value: unknown) {
    setError(value instanceof AgentApiError ? value.message : "Không tải được tiến trình Agent.");
    failure.current(value);
  }
  const reportFailure = useEffectEvent(fail);
  useEffect(() => {
    attempt.current = null;
    if (!api || !activeId) return;
    const controller = new AbortController();
    api.getRun(activeId, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        if (value.tenant_id !== tenantId || value.repo_id !== repoId) throw new AgentApiError(502);
        setRun(value);
      }
    }).catch(value => { if (!controller.signal.aborted) reportFailure(value); });
    return () => controller.abort();
  }, [api, activeId, tenantId, repoId]);
  useEffect(() => () => { mutation.current?.abort(); }, [api, tenantId, repoId]);
  const runId = run?.run_id;
  const pending = !!run && pendingAgentRun(run);
  useEffect(() => {
    if (!api || !runId || !pending) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await api!.getRun(runId!, controller.signal);
        if (controller.signal.aborted) return;
        if (value.tenant_id !== tenantId || value.repo_id !== repoId) throw new AgentApiError(502);
        setRun(value); setError("");
        if (pendingAgentRun(value)) timer = setTimeout(() => { void poll(); }, 800);
      } catch (value) { if (!controller.signal.aborted) reportFailure(value); }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, runId, pending, epoch, tenantId, repoId]);
  async function start(snapshot: string, prompt: string) {
    if (!api || busy || (run && pendingAgentRun(run))) return false;
    if (attempt.current?.snapshot !== snapshot || attempt.current.prompt !== prompt)
      attempt.current = { snapshot, prompt, key: crypto.randomUUID() };
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError("");
    try {
      const value = await api.startRun(snapshot, prompt, attempt.current.key, controller.signal);
      if (controller.signal.aborted) return false;
      setRun(bound(value)); attempt.current = null; return true;
    } catch (value) { if (!controller.signal.aborted) fail(value); return false; }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function cancel() {
    if (!api || !run || !pendingAgentRun(run) || busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError("");
    try {
      const value = await api.cancelRun(run.run_id, controller.signal);
      if (!controller.signal.aborted) { setRun(bound(value)); setEpoch(n => n + 1); }
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function refresh() {
    if (run && (!activeId || run.run_id === activeId)) { setEpoch(n => n + 1); return; }
    if (!api || !activeId || busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError("");
    try {
      const value = await api.getRun(activeId, controller.signal);
      if (!controller.signal.aborted) setRun(bound(value));
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return { run, error, busy, start, cancel, refresh: () => { void refresh(); } };
}
