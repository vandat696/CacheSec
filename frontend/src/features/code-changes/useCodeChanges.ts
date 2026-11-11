"use client";

import { useEffect, useRef, useState } from "react";
import { ChangeApiError, ChangeWorkflowClient, editorContent, pendingTest,
  type ChangeConfig, type Revision, type TestJob } from "./changeWorkflowApi";

export function useCodeChanges(api: ChangeWorkflowClient, snapshotId: string, original: string,
  repositoryIdentity: string, accessLost: () => void) {
  const [config, setConfig] = useState<ChangeConfig | null>(null);
  const [draft, setDraft] = useState(original.replace(/\r\n?/g, "\n"));
  const [saved, setSaved] = useState<Revision | null>(null);
  const [jobs, setJobs] = useState<TestJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const [pollAttempt, setPollAttempt] = useState(0);
  const current = useRef<AbortController | null>(null);
  const saveAttempt = useRef<{ payload: string; key: string } | null>(null);
  const testAttempt = useRef<{ revision: number; key: string } | null>(null);
  const access = useRef(accessLost);
  useEffect(() => { access.current = accessLost; }, [accessLost]);
  function failure(value: unknown) {
    setError(value instanceof ChangeApiError ? value.message : "Không kết nối được API. Có thể thử lại.");
    setRequestId(value instanceof ChangeApiError ? value.requestId : undefined);
    if (value instanceof ChangeApiError && [401, 403].includes(value.status)) access.current();
  }
  useEffect(() => {
    const controller = new AbortController();
    api.config(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (value.repository_identity !== repositoryIdentity) throw new ChangeApiError(502);
      setConfig(value);
    }).catch(value => { if (!controller.signal.aborted) failure(value); });
    return () => { controller.abort(); current.current?.abort(); };
  }, [api, repositoryIdentity]);

  useEffect(() => {
    if (!jobs.some(pendingTest)) return;
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
      if (!controller.signal.aborted) apply();
    } catch (value) { if (!controller.signal.aborted) failure(value); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const content = editorContent(draft, saved?.content ?? original);
  const dirty = content !== (saved?.content ?? original);
  function save() {
    const payload = JSON.stringify([saved?.proposal_id, saved?.revision, content]);
    if (saveAttempt.current?.payload !== payload) saveAttempt.current = { payload, key: crypto.randomUUID() };
    const key = saveAttempt.current.key;
    return run(async signal => {
      const value = await api.save(snapshotId, content, saved, key, signal);
      return () => { setSaved(value); setJobs(value.tests); saveAttempt.current = null; };
    });
  }
  function open(proposalId: string) {
    return run(async signal => {
      const value = await api.open(proposalId, signal);
      return () => { setSaved(value); setDraft(value.content.replace(/\r\n?/g, "\n")); setJobs(value.tests);
        saveAttempt.current = null; testAttempt.current = null; };
    });
  }
  function test() {
    if (!saved || dirty) return;
    if (testAttempt.current?.revision !== saved.revision)
      testAttempt.current = { revision: saved.revision, key: crypto.randomUUID() };
    const key = testAttempt.current.key;
    return run(async signal => {
      const job = await api.test(saved, key, signal);
      return () => { setJobs(previous => [job, ...previous.filter(j => j.job_id !== job.job_id)]);
        testAttempt.current = null; };
    });
  }
  return { config, draft, setDraft, saved, jobs, busy, error, requestId, dirty, save, open, test };
}
