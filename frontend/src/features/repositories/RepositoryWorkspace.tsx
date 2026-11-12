"use client";

import { useEffect, useImperativeHandle, useState, type KeyboardEvent, type Ref } from "react";
import { usePathname, useRouter } from "next/navigation";
import { writeViewReference } from "../workbench/viewReferences";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { editablePath, pendingTest } from "../code-changes/changeWorkflowApi";
import { CodeChangesPanel } from "../code-changes/CodeChangesPanel";
import { SourceEditor } from "../code-changes/SourceEditor";
import { UnsavedChangesDialog } from "../code-changes/UnsavedChangesDialog";
import { useCodeChanges } from "../code-changes/useCodeChanges";
import { EditorTabs } from "./navigation/EditorTabs";
import { RepositoryExplorer } from "./navigation/RepositoryExplorer";
import type { SnapshotFile } from "./repositoryApi";
import type { useRepository } from "./useRepository";

export type RepositoryWorkspaceHandle = { requestLeave: (action: () => void) => void; openProposal: (id: string) => void };

export function RepositoryWorkspace({ repo, ref }: { repo: ReturnType<typeof useRepository>; ref?: Ref<RepositoryWorkspaceHandle> }) {
  const snapshot = repo.snapshot!;
  const router = useRouter();
  const pathname = usePathname();
  const editable = snapshot.files.find(file => file.path === editablePath);
  const original = editable ? repo.openedFiles[editable.file_id]?.raw : null;
  const change = useCodeChanges(original !== null && original !== undefined ? repo.changes : null,
    snapshot.snapshot_id, original ?? "", repo.repository!.repository_identity, repo.disconnect, repo.restoredRevision);
  const [tabs, setTabs] = useState<SnapshotFile[]>(repo.selected ? [repo.selected] : []);
  const [activeId, setActiveId] = useState<string | null>(repo.selected?.file_id ?? null);
  const [consoleTab, setConsoleTab] = useState<"tests" | "diff" | "details">("tests");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [savedNotice, setSavedNotice] = useState("");
  const [explorerOpen, setExplorerOpen] = useState(true);
  const active = tabs.find(file => file.file_id === activeId);
  const isEditable = active?.path === editablePath && original !== null && original !== undefined;
  const canSave = !!isEditable && !!change.config?.can_propose && change.dirty && !change.busy;
  const pending = change.jobs.some(job => job.revision === change.saved?.revision && pendingTest(job));
  const canTest = !!change.config?.can_test && (!!change.saved || !!change.config.can_propose)
    && (!change.dirty || !!change.config.can_propose) && !change.busy && !pending;
  useEffect(() => {
    if (pathname === "/workspace" && change.saved) writeViewReference("proposal", change.saved.proposal_id);
  }, [pathname, change.saved]);
  function requestLeave(action: () => void) {
    if (change.dirty) setPendingAction(() => action);
    else action();
  }
  useImperativeHandle(ref, () => ({ requestLeave, openProposal: id => requestLeave(() => {
    if (editable) { openFile(editable); setConsoleTab("diff"); void change.open(id); }
  }) }));

  useEffect(() => {
    if (!change.dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target || link.hasAttribute("download")) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
      // These routes share the mounted workbench, so switching views keeps the draft and undo history.
      if (["/workspace", "/quotations"].includes(destination.pathname)) return;
      event.preventDefault(); event.stopPropagation();
      setPendingAction(() => () => router.push(destination.pathname + destination.search + destination.hash));
    };
    window.addEventListener("beforeunload", prevent);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", prevent); document.removeEventListener("click", navigate, true); };
  }, [change.dirty, router]);

  function openFile(file: SnapshotFile) {
    setTabs(previous => previous.some(item => item.file_id === file.file_id) ? previous : [...previous, file]);
    setActiveId(file.file_id); void repo.select(file);
  }
  function closeFile(file: SnapshotFile) {
    const remaining = tabs.filter(item => item.file_id !== file.file_id);
    setTabs(remaining);
    if (activeId === file.file_id) {
      const next = remaining[Math.min(tabs.indexOf(file), remaining.length - 1)];
      setActiveId(next?.file_id ?? null);
      if (next) void repo.select(next);
    }
  }
  function requestClose(file: SnapshotFile) {
    if (change.busy) return;
    if (file.path === editablePath && change.dirty) requestLeave(() => closeFile(file));
    else closeFile(file);
  }
  async function save() {
    if (!change.dirty || !change.config?.can_propose || change.busy) return false;
    const ok = await change.save();
    if (ok) setSavedNotice("Đã lưu");
    else setConsoleTab("tests");
    return ok;
  }
  async function runTests() { setConsoleTab("tests"); setSavedNotice(""); await change.test(); }
  function keyboard(event: KeyboardEvent) {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
    event.preventDefault(); if (canSave) void save();
  }

  return <div className="repository-workspace" onKeyDown={keyboard} data-explorer-open={explorerOpen}>
    <div className="repository-workspace-toolbar">
      <Button variant="tertiary" className="repository-explorer-toggle" aria-label="Explorer"
        aria-expanded={explorerOpen} onClick={() => setExplorerOpen(value => !value)}><Icon name="menu" /></Button>
      <strong>CacheSec</strong>
      <span className="repository-save-status" role="status">{change.dirty ? "Chưa lưu" : savedNotice || (change.saved ? "Đã lưu" : "")}</span>
      <Button id="change-save" variant="secondary" title="Lưu (Ctrl+S)" onClick={() => { void save(); }} disabled={!canSave}>Lưu <kbd>Ctrl S</kbd></Button>
      <Button id="change-test" onClick={() => { void runTests(); }} disabled={!canTest} loading={change.busy}
        loadingLabel="Đang gửi…"><Icon name="terminal" />{pending ? "Đang kiểm thử…" : "Chạy test"}</Button>
    </div>
    <div className="repository-source repository-workspace-body">
      <RepositoryExplorer files={snapshot.files} activeId={activeId}
        dirtyPath={change.dirty ? editablePath : undefined} onOpen={openFile} />
      <div className="repository-file repository-editor-column">
        <EditorTabs files={tabs} activeId={activeId} dirtyPath={change.dirty ? editablePath : undefined}
          onSelect={openFile} onClose={requestClose} />
        <div className="repository-editor-area" role="tabpanel" id="repository-editor-panel">
          {tabs.map(file => {
            const content = repo.openedFiles[file.file_id];
            if (!content || content.binary) return null;
            const own = file.path === editablePath && original !== null && original !== undefined;
            return <SourceEditor key={`${file.file_id}:${own ? change.documentVersion : 0}`}
              value={own ? change.draft : content.text ?? ""} readOnly={!own || !change.config?.can_propose || change.opening}
              active={activeId === file.file_id && !repo.busy} label={own ? "Mã bản sửa" : `Nội dung ${file.path.split("/").at(-1)}`}
              onChange={own ? value => { change.setDraft(value); setSavedNotice(""); } : undefined}
              onSave={own ? () => { if (!change.busy && change.dirty) void save(); } : undefined} />;
          })}
          {repo.busy && <p className="repository-notice" role="status">Đang mở tệp…</p>}
          {!repo.busy && !active && <p className="repository-editor-empty">Chọn tệp trong Explorer để mở.</p>}
          {!repo.busy && active && repo.openedFiles[active.file_id]?.binary &&
            <p className="repository-notice">Tệp nhị phân hoặc không phải UTF-8; không hiển thị dạng văn bản.</p>}
        </div>
        {original !== null && original !== undefined && <CodeChangesPanel change={change} tab={consoleTab} onTab={setConsoleTab} />}
      </div>
    </div>
    <UnsavedChangesDialog open={!!pendingAction} onCancel={() => setPendingAction(null)}
      onDiscard={() => { change.discard(); pendingAction?.(); setPendingAction(null); }}
      onSave={async () => { const ok = await save(); if (ok) { pendingAction?.(); setPendingAction(null); } return ok; }} />
  </div>;
}
