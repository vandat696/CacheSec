import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SnapshotFile } from "../repositoryApi";

export function EditorTabs({ files, activeId, dirtyPath, onSelect, onClose }: {
  files: SnapshotFile[]; activeId: string | null; dirtyPath?: string;
  onSelect: (file: SnapshotFile) => void; onClose: (file: SnapshotFile) => void;
}) {
  const tabs = useRef<HTMLDivElement>(null);
  return <div className="repository-tabs" role="tablist" aria-label="Tệp đang mở" ref={tabs}>
    {files.map((file, index) => <div className="repository-tab" role="presentation" key={file.file_id}
      data-active={file.file_id === activeId}>
      <button type="button" role="tab" title={file.path} data-path={file.path}
        aria-selected={file.file_id === activeId} aria-controls="repository-editor-panel"
        tabIndex={file.file_id === activeId ? 0 : -1} onClick={() => onSelect(file)}
        onKeyDown={event => { const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
          if (!offset) return; event.preventDefault(); const next = (index + offset + files.length) % files.length;
          onSelect(files[next]); tabs.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus(); }}>
        <Icon name="code" />{file.path.split("/").at(-1)}
        {file.path === dirtyPath && <span className="editor-dirty" aria-label="Chưa lưu">●</span>}
      </button>
      <button type="button" className="repository-tab-close" aria-label={`Đóng ${file.path.split("/").at(-1)}`}
        onClick={() => onClose(file)}><Icon name="close" /></button>
    </div>)}
  </div>;
}
