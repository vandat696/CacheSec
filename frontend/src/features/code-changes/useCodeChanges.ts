"use client";

import { useEffect, useRef, useState } from "react";
import { ChangeApiError, ChangeWorkflowClient, editorContent, pendingTest,
  type ChangeConfig, type Revision, type TestJob } from "./changeWorkflowApi";
import { saveRevision, submitCodeChange, type ChangeAttempts } from "./changeSubmission";
import type { WorkspaceConfig, WorkspaceOperation } from "./workspaceRuntimeModel";
import { waitForOperation } from "./workspaceOperations";

export function useCodeChanges(api: ChangeWorkflowClient | null, snapshotId: string, original: string,
  repositoryIdentity: string, accessLost: () => void, initialRevision: Revision | null = null,
  onSourceSaved: (revision: Revision) => Promise<void> = async () => {}) {
  const [config, setConfig] = useState<ChangeConfig | null>(null);
  const [draft, setDraft] = useState((initialRevision?.content ?? original).replace(/\r\n?/g, "\n"));
  const [saved, setSaved] = useState<Revision | null>(initialRevision);
  const latestSaved = useRef<Revision | null>(initialRevision);
  const [jobs, setJobs] = useState<TestJob[]>(initialRevision?.tests ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const [pollAttempt, setPollAttempt] = useState(0);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [opening, setOpening] = useState(false);
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig | null>(null);
  const [sourceContent, setSourceContent] = useState(original);
  const [restoredBase, setRestoredBase] = useState<string | null>(null);
  const [sourceOperation, setSourceOperation] = useState<WorkspaceOperation | null>(null);
  const sourceSnapshot = useRef(snapshotId);
  const sourceAttempt = useRef<{ identity: string; key: string } | null>(null);
  const current = useRef<AbortController | null>(null);
  const attempts = useRef<ChangeAttempts>({ save: null, test: null });
  const access = useRef(accessLost);
  useEffect(() => { access.current = accessLost; }, [accessLost]);
  function failure(value: unknown) {
    setError(value instanceof ChangeApiError ? value.message : "Không kết nối được API. Có thể thử lại.");
    setRequestId(value instanceof ChangeApiError ? value.requestId : undefined);
    if (value instanceof ChangeApiError && [401, 403].includes(value.status)) access.current();
  }
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    api.config(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (value.repository_identity !== repositoryIdentity) throw new ChangeApiError(502);
      setConfig(value);
    }).catch(value => { if (!controller.signal.aborted) failure(value); });
    api.workspaceConfig(controller.signal).then(value => {
      if (!controller.signal.aborted) setWorkspaceConfig(value);
    }).catch(value => {
      if (!controller.signal.aborted && !(value instanceof ChangeApiError && value.status === 404)) failure(value);
    });
    return () => { controller.abort(); current.current?.abort(); };
  }, [api, repositoryIdentity]);

  useEffect(() => {
    if (!api || !jobs.some(pendingTest)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const updates = await Promise.all(jobs.filter(pendingTest).map(j => api.job(j, controller.signal)));
        if (!controller.signal.aborted) setJobs(previous => previous.map(j => updates.find(u => u.job_id === j.job_id) ?? j));
      } catch (value) { if (!controller.signal.aborted) { failure(value); setPollAttempt(v => v + 1); } }
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, jobs, pollAttempt]);

  async function run(action: (signal: AbortSignal) => Promise<() => void>) {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setBusy(true); setError(""); setRequestId(undefined);
    try {
      const apply = await action(controller.signal);
      if (!controller.signal.aborted) { apply(); return true; }
    } catch (value) { if (!controller.signal.aborted) failure(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
    return false;
  }
  const content = restoredBase !== null && draft === restoredBase.replace(/\r\n?/g, "\n")
    ? restoredBase : editorContent(draft, restoredBase ?? saved?.content ?? original);
  const revisionDirty = content !== (saved?.content ?? original);
  const sourceDirty = content !== sourceContent;
  const dirty = workspaceConfig?.can_write ? sourceDirty : revisionDirty;
  const canRestoreBase = !!config?.can_propose && !!saved && !busy && content !== saved.base_text;
  function restoreBase(base: string) {
    setRestoredBase(base);
    setDraft(base.replace(/\r\n?/g, "\n"));
    setError(""); setRequestId(undefined);
    setDocumentVersion(value => value + 1);
  }
  function save() {
    if (!api || !dirty || !config?.can_propose || busy) return Promise.resolve(false);
    return run(async signal => {
      const value = !saved || content !== saved.content
        ? await saveRevision(api, snapshotId, content, saved, attempts.current, signal) : saved;
      const revision = value ?? saved;
      if (!revision) throw new ChangeApiError(409);
      // Persist the revision acknowledgement even if the later host write fails.
      latestSaved.current = revision; setSaved(revision); setJobs(revision.tests);
      if (workspaceConfig?.can_write) {
        const identity = revision.artifact_digest + ":" + sourceSnapshot.current;
        if (sourceAttempt.current?.identity !== identity) sourceAttempt.current = { identity, key: crypto.randomUUID() };
        const operation = await api.source(revision, sourceSnapshot.current, sourceAttempt.current.key, signal);
        await waitForOperation(api, operation, signal, setSourceOperation);
        if (signal.aborted) return () => {};
        setSourceContent(content); sourceSnapshot.current = revision.candidate_snapshot_id;
        await onSourceSaved(revision);
      }
      return () => {};
    });
  }
  function open(proposalId: string) {
    if (!api || busy) return Promise.resolve(false);
    setOpening(true);
    return run(async signal => {
      const value = await api.open(proposalId, signal);
      return () => { latestSaved.current = value; setSaved(value); setDraft(value.content.replace(/\r\n?/g, "\n")); setJobs(value.tests); setRestoredBase(null);
        attempts.current = { save: null, test: null }; setDocumentVersion(v => v + 1); };
    }).finally(() => setOpening(false));
  }
  async function test() {
    if (!api || !config?.can_test || busy) return Promise.resolve(false);
    if (workspaceConfig?.can_write && sourceDirty && !await save()) return false;
    return run(async signal => {
      const job = await submitCodeChange(api, snapshotId, content, latestSaved.current, attempts.current, signal,
        value => { latestSaved.current = value; setSaved(value); setJobs(value.tests); });
      return () => { if (job) setJobs(previous => [job, ...previous.filter(j => j.job_id !== job.job_id)]); };
    });
  }
  function discard() { setDraft((workspaceConfig?.can_write ? sourceContent : saved?.content ?? original).replace(/\r\n?/g, "\n")); setRestoredBase(null);
    attempts.current.save = null; setDocumentVersion(v => v + 1); }
  return { config, draft, setDraft, saved, jobs, busy, opening, error, requestId, dirty, revisionDirty, documentVersion,
    workspaceConfig, sourceDirty, sourceOperation, save, open, test, discard, canRestoreBase, restoreBase };
}
