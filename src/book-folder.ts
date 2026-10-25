import { vaultPath } from './model';

export interface BookFolderEntry {
  path: string;
  kind: 'folder' | 'markdown' | 'other';
}

export function isInBookFolder(path: string, folder: string): boolean {
  const root = vaultPath(folder);
  try {
    return vaultPath(path) === path && path.startsWith(`${root}/`);
  } catch { return false; }
}

export function requireBookFolderPath(path: string, folder: string): void {
  if (!isInBookFolder(path, folder)) {
    throw new Error('This note is outside the configured book notes folder. Move it into that folder or change the folder setting before syncing.');
  }
}

// Start at the configured folder itself. Never enumerate the vault root or ask
// for a vault-wide file/cache list, even when this folder is missing or invalid.
export function bookNotePaths(folder: string, children: (path: string) => readonly BookFolderEntry[]): string[] {
  const root = vaultPath(folder);
  const pending = [root];
  const files: string[] = [];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const entry of children(parent)) {
      if (!entry.path.startsWith(`${parent}/`)) throw new Error('Book folder discovery returned an out-of-folder path.');
      const name = entry.path.slice(parent.length + 1);
      if (!name || name.includes('/') || name.includes('\\')) throw new Error('Book folder discovery returned an invalid child path.');
      if (name.startsWith('.')) continue;
      requireBookFolderPath(entry.path, root);
      if (entry.kind === 'folder') pending.push(entry.path);
      else if (entry.kind === 'markdown') files.push(entry.path);
    }
  }
  return files;
}
