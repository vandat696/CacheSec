"use client";

import { useEffect, useRef, useState } from "react";
import {
  RepositoryApiError, RepositoryHttpClient, sourceText,
  type Repository, type RepositorySnapshot, type SnapshotFile,
} from "./repositoryApi";

const apiUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL ?? "http://127.0.0.1:8000";

export function useRepository() {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selected, setSelected] = useState<SnapshotFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [binary, setBinary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const client = useRef<RepositoryHttpClient | null>(null);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => { current.current?.abort(); client.current = null; }, []);

  function clearFile() { setSelected(null); setContent(null); setBinary(false); }
  function clearSource() { setSnapshot(null); clearFile(); }
  function disconnect() {
    current.current?.abort(); current.current = null; client.current = null;
    setRepository(null); clearSource(); setError(""); setRequestId(undefined); setBusy(false);
  }
  function begin() {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setBusy(true); setError(""); setRequestId(undefined);
    return controller;
  }
  function active(controller: AbortController) {
    return current.current === controller && !controller.signal.aborted;
  }
  async function run(work: (signal: AbortSignal) => Promise<() => void>) {
    const controller = begin();
    try {
      const apply = await work(controller.signal);
      if (active(controller)) apply();
    } catch (failure) {
      if (!active(controller)) return;
      // Fail closed in the view too; an old file must not remain presented after denial/outage.
      clearSource();
      if (failure instanceof RepositoryApiError && [401, 403, 404].includes(failure.status)) {
        client.current = null; setRepository(null);
      }
      setError(failure instanceof RepositoryApiError ? failure.message : "Không kết nối được API control.");
      setRequestId(failure instanceof RepositoryApiError ? failure.requestId : undefined);
    } finally { if (active(controller)) setBusy(false); }
  }
  async function connect(token: string) {
    client.current = null; setRepository(null); clearSource();
    const api = new RepositoryHttpClient(apiUrl, token);
    await run(async (signal) => {
      const data = await api.describe(signal);
      return () => { client.current = api; setRepository(data); };
    });
  }
  async function load(snapshotId?: string) {
    const api = client.current, identity = repository?.repository_identity;
    if (!api || !identity) return;
    clearSource();
    await run(async (signal) => {
      const data = await (snapshotId ? api.get(snapshotId, signal) : api.capture(signal));
      if (data.repository_identity !== identity) throw new RepositoryApiError(502);
      return () => setSnapshot(data);
    });
  }
  async function select(file: SnapshotFile) {
    const api = client.current, saved = snapshot;
    if (!api || !saved) return;
    clearFile();
    await run(async (signal) => {
      const bytes = await api.readFile(saved.snapshot_id, file, signal);
      const text = sourceText(bytes);
      return () => { setSelected(file); setContent(text); setBinary(text === null); };
    });
  }
  return { repository, snapshot, selected, content, binary, busy, error, requestId,
    connect, disconnect, load, select };
}
