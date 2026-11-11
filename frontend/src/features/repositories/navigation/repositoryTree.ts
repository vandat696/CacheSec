import type { SnapshotFile } from "../repositoryApi";

export type RepositoryFolder = { name: string; path: string; folders: RepositoryFolder[]; files: SnapshotFile[] };

export function repositoryTree(files: SnapshotFile[]): RepositoryFolder {
  const root: RepositoryFolder = { name: "", path: "", folders: [], files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let folder = root;
    for (const name of parts.slice(0, -1)) {
      let child = folder.folders.find(item => item.name === name);
      if (!child) { child = { name, path: folder.path ? `${folder.path}/${name}` : name, folders: [], files: [] };
        folder.folders.push(child); }
      folder = child;
    }
    folder.files.push(file);
  }
  return root;
}
