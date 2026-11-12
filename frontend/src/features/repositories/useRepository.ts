"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { clearLocalBootstrap, closeLocalWorkspace, initializeLocalWorkspace, localSessionEnded } from "../local-workspace/localWorkspaceClient";
import { ChangeApiError, ChangeWorkflowClient, editablePath, type Revision } from "../code-changes/changeWorkflowApi";
import { readViewReference, writeViewReference } from "../workbench/viewReferences";
import { AgentHttpClient } from "../agent/agentApi";
import {
  RepositoryApiError, RepositoryHttpClient, sourceText,
  type Repository, type RepositorySnapshot, type SnapshotFile,
} from "./repositoryApi";

const apiUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL ?? "http://127.0.0.1:8000";
export type RepositoryFileContent = { text: string | null; raw: string | null; binary: boolean };

function decodeFile(bytes: Uint8Array): RepositoryFileContent {
  const text = sourceText(bytes);
  return { text, binary: text === null,
    raw: text === null ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
}

export function useRepository() {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selected, setSelected] = useState<SnapshotFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [binary, setBinary] = useState(false);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeWorkflowClient | null>(null);
  const [agent, setAgent] = useState<AgentHttpClient | null>(null);
  const [restoredRevision, setRestoredRevision] = useState<Revision | null>(null);
  const [openedFiles, setOpenedFiles] = useState<Record<string, RepositoryFileContent>>({});
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const client = useRef<RepositoryHttpClient | null>(null);
  const current = useRef<AbortController | null>(null);
  const localSession = useRef(false);
  useEffect(() => () => { current.current?.abort(); client.current = null; }, []);
  const endSession = useEffectEvent(() => { if (localSession.current) { localSession.current = false; clearConnection(); } });
  useEffect(() => {
    const ended = () => endSession(); window.addEventListener(localSessionEnded, ended);
    return () => window.removeEventListener(localSessionEnded, ended);
  }, []);

  const openSession = useEffectEvent(() => connect(null));
  useEffect(() => {
    let cancelled = false;
    initializeLocalWorkspace().then(async connected => {
      if (!cancelled && connected) await openSession();
    }).catch(() => { if (!cancelled) setError("Không mở được phiên local. Hãy chạy lại npm run workspace."); })
      .finally(() => { if (!cancelled) { clearLocalBootstrap(); setCheckingSession(false); } });
    return () => { cancelled = true; };
  }, []);

  function clearFile() { setSelected(null); setContent(null); setRawContent(null); setBinary(false); }
  function clearSource() { setSnapshot(null); setOpenedFiles({}); setRestoredRevision(null); clearFile(); }
  function clearConnection() {
    current.current?.abort(); current.current = null; client.current = null;
    setChanges(null); setAgent(null);
    setRepository(null); clearSource(); setError(""); setRequestId(undefined); setBusy(false);
  }
  function disconnect() {
    clearConnection();
    if (localSession.current) {
      localSession.current = false;
      void closeLocalWorkspace().catch(() => setError("Chưa đóng được phiên local. Hãy đóng trình duyệt và thử lại."));
    }
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
      if ((failure instanceof RepositoryApiError || failure instanceof ChangeApiError) && [401, 403, 404].includes(failure.status)) {
        client.current = null; setRepository(null);
        setChanges(null); setAgent(null);
      }
      setError(failure instanceof RepositoryApiError || failure instanceof ChangeApiError ? failure.message : "Không kết nối được API control.");
      setRequestId(failure instanceof RepositoryApiError || failure instanceof ChangeApiError ? failure.requestId : undefined);
    } finally { if (active(controller)) setBusy(false); }
  }
  async function connect(token: string | null) {
    client.current = null; setRepository(null); clearSource();
    setChanges(null); setAgent(null);
    localSession.current = token === null;
    const baseUrl = token === null ? "/api/local-control" : apiUrl;
    const api = new RepositoryHttpClient(baseUrl, token);
    const workflow = new ChangeWorkflowClient(baseUrl, token);
    await run(async (signal) => {
      const data = await api.describe(signal);
      const proposalId = readViewReference("proposal");
      const revision = proposalId ? await workflow.open(proposalId, signal) : null;
      const opened = await prepareSnapshot(api, data.repository_identity, signal, revision?.base_snapshot_id);
      return () => { client.current = api; setRepository(data); setChanges(workflow);
        setAgent(new AgentHttpClient(baseUrl, token)); setRestoredRevision(revision); opened(); };
    });
  }
  async function prepareSnapshot(api: RepositoryHttpClient, identity: string, signal: AbortSignal, snapshotId?: string) {
    const data = await (snapshotId ? api.get(snapshotId, signal) : api.capture(signal));
    if (data.repository_identity !== identity) throw new RepositoryApiError(502);
    const file = data.files.find(item => item.path === editablePath);
    const bytes = file ? await api.readFile(data.snapshot_id, file, signal) : null;
    const content = bytes ? decodeFile(bytes) : null;
    return () => { setSnapshot(data);
      if (file && content) { setSelected(file); setContent(content.text); setBinary(content.binary);
        setRawContent(content.raw); setOpenedFiles({ [file.file_id]: content }); }
    };
  }
  async function load(snapshotId?: string) {
    const api = client.current, identity = repository?.repository_identity;
    if (!api || !identity) return;
    writeViewReference("proposal", null);
    clearSource();
    await run(signal => prepareSnapshot(api, identity, signal, snapshotId));
  }
  async function select(file: SnapshotFile) {
    const api = client.current, saved = snapshot;
    if (!api || !saved || selected?.file_id === file.file_id) return;
    clearFile();
    await run(async (signal) => {
      const bytes = await api.readFile(saved.snapshot_id, file, signal);
      const content = decodeFile(bytes);
      return () => { setSelected(file); setContent(content.text); setBinary(content.binary);
        setRawContent(content.raw); setOpenedFiles(previous => ({ ...previous, [file.file_id]: content })); };
    });
  }
  return { repository, snapshot, selected, content, rawContent, changes, agent, restoredRevision, openedFiles, binary, busy: busy || checkingSession, error, requestId,
    connect, disconnect, load, select };
}
