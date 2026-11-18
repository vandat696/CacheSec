"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ChangeApiError } from "../code-changes/changeWorkflowApi";
import type { AgentHttpClient, AgentModelId } from "../agent/agentApi";
import { getBrowserContextCache } from "../context-cache/dexieContextCache";
import type { ContextMode, LookupReport } from "../context-cache/contextCacheModel";
import { readViewReference, writeViewReference } from "../workbench/viewReferences";
import { branchPending, type ComparisonPair, type ComparisonSummary } from "./comparisonModel";

export function useComparison(api: AgentHttpClient | null, onDenied: () => void) {
  const [pair, setPair] = useState<ComparisonPair | null>(null);
  const [history, setHistory] = useState<ComparisonSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutation = useRef<AbortController | null>(null);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [owner, setOwner] = useState(api);
  if (owner !== api) { setOwner(api); setPair(null); setHistory([]); setBusy(false); setError(""); setNotice(""); }
  function fail(value: unknown) {
    setError(value instanceof ChangeApiError ? value.message : "Chưa hoàn tất thao tác so sánh. Tải lại để kiểm tra trạng thái.");
    if (value instanceof ChangeApiError && [401, 403].includes(value.status)) {
      setPair(null); setHistory([]);
      if (value.status === 401) onDenied();
    }
  }
  const report = useEffectEvent(fail);
  useEffect(() => {
    attempt.current = null;
    const controller = new AbortController();
    if (api) {
      api.listComparisons(controller.signal).then(items => { if (!controller.signal.aborted) setHistory(items); })
        .catch(value => { if (!controller.signal.aborted) report(value); });
      const id = readViewReference("comparison");
      if (id) api.comparison(id, controller.signal).then(value => {
        if (!controller.signal.aborted && readViewReference("comparison") === id) setPair(value);
      }).catch(value => {
        if (!controller.signal.aborted && readViewReference("comparison") === id) report(value);
      });
    }
    return () => { controller.abort(); mutation.current?.abort(); };
  }, [api]);
  const pairId = pair?.pair_id;
  const pending = !!pair && Object.values(pair.branches).some(branchPending);
  useEffect(() => {
    if (!api || !pairId || !pending) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await api!.comparison(pairId!, controller.signal);
        if (controller.signal.aborted) return;
        setPair(value);
        if (Object.values(value.branches).some(branchPending)) timer = setTimeout(() => { void poll(); }, 1000);
      } catch (value) { if (!controller.signal.aborted) report(value); }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, pairId, pending]);

  async function open(id: string) {
    if (!api || busy || (pending && id !== pair?.pair_id)) return false;
    const controller = new AbortController(); mutation.current?.abort(); mutation.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const value = await api.comparison(id, controller.signal);
      if (!controller.signal.aborted) {
        if (pair?.pair_id !== id) attempt.current = null;
        setPair(value);
        writeViewReference("comparison", id);
        return true;
      }
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
    return false;
  }
  function newSession() {
    if (!api || busy || pending) return false;
    mutation.current?.abort();
    attempt.current = null;
    setPair(null);
    setError("");
    setNotice("");
    writeViewReference("comparison", null);
    return true;
  }
  async function start(snapshot: string, prompt: string, state: "cold" | "warm" | "preload", model?: AgentModelId) {
    if (!api || busy || pending) return false;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError(""); setNotice("");
    const fingerprint = JSON.stringify({ snapshot, prompt, state, model });
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const cache = getBrowserContextCache();
      let cacheEpoch: string | undefined;
      try { if (state === "cold") await cache.clear(); cacheEpoch = await cache.begin(); }
      catch { setNotice("Không mở được cache local; sẽ ghi nhận lỗi storage."); }
      const created = await api.createComparison(snapshot, prompt, state, attempt.current!.key, controller.signal, model);
      if (controller.signal.aborted) return false;
      setPair(created); writeViewReference("comparison", created.pair_id);
      // Resolve browser candidates before either branch starts; None cannot warm Local.
      let lookup: { report: LookupReport; epoch: string } = { report: { kind: "client_storage_error" }, epoch: "" };
      if (created.branches.local.context_request && cacheEpoch !== undefined) {
        try { const began = performance.now(); const found = await cache.lookup(created.branches.local.context_request, cacheEpoch);
          lookup = { ...found, report: { ...found.report, client_state: found.state, lookup_ms: performance.now() - began } }; }
        catch { setNotice("Lookup local lỗi; backend sẽ kiểm quyền và đọc source lại."); }
      }
      if (controller.signal.aborted) return false;
      const results = await Promise.allSettled((["none", "local"] as const).map(async mode => {
        const result = await api.startComparison(created.pair_id, mode, mode === "none" ? { kind: "not_applicable" } : lookup.report, controller.signal);
        if (mode === "local" && result.admission && !controller.signal.aborted) {
          const began = performance.now(); let state: "written" | "session_changed" | "storage_error";
          try { state = await cache.admit(result.admission, lookup.epoch) ? "written" : "session_changed";
            if (state === "session_changed") setNotice("Context chưa được lưu: phiên cache đã đổi hoặc entry hết hạn."); }
          catch { state = "storage_error"; setNotice("Không ghi được Context Cache; kết quả Agent vẫn được giữ."); }
          if (!controller.signal.aborted) {
            try { await api.recordCacheIo(created.pair_id, { report_id: crypto.randomUUID(), entry_id: result.admission.entry_id, state, elapsed_ms: performance.now() - began }, controller.signal); }
            catch { if (!controller.signal.aborted) setNotice("Chưa ghi được trạng thái cache local vào lịch sử; kết quả Agent vẫn ở backend."); }
          }
        }
      }));
      if (controller.signal.aborted) return false;
      for (const result of results) if (result.status === "rejected") fail(result.reason);
      const updated = await api.comparison(created.pair_id, controller.signal);
      if (controller.signal.aborted) return false;
      setPair(updated);
      const savedHistory = await api.listComparisons(controller.signal);
      if (controller.signal.aborted) return false;
      setHistory(savedHistory);
      attempt.current = null;
      return results.every(result => result.status === "fulfilled");
    } catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
    return false;
  }
  async function cancel(mode: ContextMode) {
    if (!api || !pair || busy) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true);
    try { const value = await api.cancelComparison(pair.pair_id, mode, controller.signal); if (!controller.signal.aborted) setPair(value); }
    catch (value) { if (!controller.signal.aborted) fail(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return { pair, history, busy, pending, error, notice, start, open, newSession, cancel };
}
