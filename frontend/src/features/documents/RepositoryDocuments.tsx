"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/Button";
import { initializeLocalWorkspace, localSessionEnded } from "../local-workspace/localWorkspaceClient";
import { RepositoryHttpClient, sourceText, type Repository, type RepositorySnapshot, type SnapshotFile } from "../repositories/repositoryApi";

export function RepositoryDocuments() {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selected, setSelected] = useState<SnapshotFile | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const current = useRef<AbortController | null>(null);
  const api = useRef<RepositoryHttpClient | null>(null);
  function clear() { setRepository(null); setSnapshot(null); setSelected(null); setText(null); }
  useEffect(() => {
    const controller = new AbortController(); current.current = controller;
    const ended = () => { current.current?.abort(); api.current = null; clear(); setBusy(false); setError("Phiên local đã kết thúc."); };
    window.addEventListener(localSessionEnded, ended);
    async function connect() {
      clear(); setError(""); setBusy(true);
      try {
        if (!await initializeLocalWorkspace()) throw new Error("NO_SESSION");
        const client = new RepositoryHttpClient("/api/local-control", null);
        const result = await client.describe(controller.signal);
        if (!controller.signal.aborted) { api.current = client; setRepository(result); }
      } catch { if (!controller.signal.aborted) { clear(); setError("Chưa đọc được repository. Mở phiên Workspace và kiểm tra quyền truy cập."); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void connect();
    return () => { controller.abort(); current.current?.abort(); api.current = null; window.removeEventListener(localSessionEnded, ended); };
  }, [revision]);
  async function load(file?: SnapshotFile) {
    if (!api.current || (file && !snapshot)) return;
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setBusy(true); setError(""); setText(null); setSelected(null);
    if (!file) setSnapshot(null);
    try {
      if (file && snapshot) {
        const bytes = await api.current.readFile(snapshot.snapshot_id, file, controller.signal);
        if (!controller.signal.aborted) { setSelected(file); setText(sourceText(bytes)); }
      } else {
        const result = await api.current.capture(controller.signal);
        if (!controller.signal.aborted) setSnapshot(result);
      }
    } catch {
      if (!controller.signal.aborted) { clear(); setError("Không đọc được nguồn hoặc quyền đã đổi. Tải lại để kiểm tra."); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="content-page repository-documents">
    <PageHeading title="Nguồn repo" action={<Button variant="secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Tải lại</Button>} />
    {error && <p role="alert">{error} <Link href="/workspace">Mở Workspace</Link></p>}
    {busy && <p role="status">Đang đọc nguồn…</p>}
    {repository && <>
      <p>{repository.repository_identity}</p>
      <Button id="documents-capture" variant="secondary" disabled={busy} onClick={() => { void load(); }}>Tải nguồn hiện tại</Button>
      <p className="runtime-settings-note">File thuộc scope đã cấp quyền · chỉ đọc</p>
    </>}
    {snapshot && <div className="repository-documents-layout" data-source-snapshot={snapshot.snapshot_id}>
      <ul aria-label="File được cấp quyền">{snapshot.files.map(file => <li key={file.file_id}>
        <button type="button" disabled={busy} aria-pressed={selected?.file_id === file.file_id}
          data-document-file={file.file_id} onClick={() => { void load(file); }}><code>{file.path}</code><small>{file.byte_size} byte</small></button>
      </li>)}</ul>
      <section aria-label="Nội dung nguồn">
        {selected ? <><h2>{selected.path.split("/").at(-1)}</h2>
          {text === null ? <p>Không xem được dưới dạng UTF-8.</p> : <pre data-document-preview><code>{text}</code></pre>}
          <details><summary>Hash đã đối chiếu</summary><code>{selected.digest}</code></details>
        </> : <p>Chọn file để xem nội dung.</p>}
      </section>
    </div>}
    <details className="runtime-settings-reference"><summary>Tệp tải lên trong phiên</summary>
      <p>Chưa có API upload/ingest. Các tệp này chưa được Agent sử dụng.</p><Link href="/documents?view=preview">Mở giao diện tham khảo</Link>
    </details>
  </div>;
}
