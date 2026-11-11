import { Icon } from "@/components/ui/Icon";
import type { SnapshotFile } from "../repositoryApi";
import { repositoryTree, type RepositoryFolder } from "./repositoryTree";

type Props = { files: SnapshotFile[]; activeId: string | null; dirtyPath?: string;
  onOpen: (file: SnapshotFile) => void };

export function RepositoryExplorer({ files, activeId, dirtyPath, onOpen }: Props) {
  function folderItems(folder: RepositoryFolder) {
    return <ul>{folder.folders.map(child => <li key={child.path}>
      <details open><summary>{child.name}</summary>{folderItems(child)}</details>
    </li>)}{folder.files.map(file => <li key={file.file_id}>
      <button type="button" title={file.path} data-path={file.path}
        aria-current={file.file_id === activeId ? "true" : undefined} onClick={() => onOpen(file)}>
        <Icon name="file" /><span>{file.path.split("/").at(-1)}</span>
        {file.path === dirtyPath && <span className="editor-dirty" aria-label="Chưa lưu">●</span>}
      </button>
    </li>)}</ul>;
  }
  return <nav className="repository-explorer" aria-label="Explorer">
    <div className="repository-explorer-title">EXPLORER <span>{files.length} tệp</span></div>
    {folderItems(repositoryTree(files))}
  </nav>;
}
