"use client";

import { useEffect, useRef, useState } from "react";
import { ChangeApiError, ChangeWorkflowClient, editorContent, pendingTest,
  type ChangeConfig, type Revision, type TestJob } from "./changeWorkflowApi";
import { saveRevision, submitCodeChange, type ChangeAttempts } from "./changeSubmission";

export function useCodeChanges(api: ChangeWorkflowClient | null, snapshotId: string, original: string,
  repositoryIdentity: string, accessLost: () => void) {
  const [config, setConfig] = useState<ChangeConfig | null>(null);
  const [draft, setDraft] = useState(original.replace(/\r\n?/g, "\n"));
  const [saved, setSaved] = useState<Revision | null>(null);
  const [jobs, setJobs] = useState<TestJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const [pollAttempt, setPollAttempt] = useState(0);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [opening, setOpening] = useState(false);
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
  const content = editorContent(draft, saved?.content ?? original);
  const dirty = content !== (saved?.content ?? original);
  function save() {
    if (!api || !dirty || !config?.can_propose || busy) return Promise.resolve(false);
    return run(async signal => {
      const value = await saveRevision(api, snapshotId, content, saved, attempts.current, signal);
      return () => { if (value) { setSaved(value); setJobs(value.tests); } };
    });
  }
  function open(proposalId: string) {
    if (!api || busy) return Promise.resolve(false);
    setOpening(true);
    return run(async signal => {
      const value = await api.open(proposalId, signal);
      return () => { setSaved(value); setDraft(value.content.replace(/\r\n?/g, "\n")); setJobs(value.tests);
        attempts.current = { save: null, test: null }; setDocumentVersion(v => v + 1); };
    }).finally(() => setOpening(false));
  }
  function test() {
    if (!api || !config?.can_test || busy) return Promise.resolve(false);
    return run(async signal => {
      const job = await submitCodeChange(api, snapshotId, content, saved, attempts.current, signal,
        value => { setSaved(value); setJobs(value.tests); });
      return () => { if (job) setJobs(previous => [job, ...previous.filter(j => j.job_id !== job.job_id)]); };
    });
  }
  function discard() { setDraft((saved?.content ?? original).replace(/\r\n?/g, "\n"));
    attempts.current.save = null; setDocumentVersion(v => v + 1); }
  return { config, draft, setDraft, saved, jobs, busy, opening, error, requestId, dirty, documentVersion,
    save, open, test, discard };
}
