import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookNotePaths, isInBookFolder, requireBookFolderPath, type BookFolderEntry } from '../src/book-folder';

void test('discovery reads only the configured folder tree and collects Markdown notes', () => {
  const tree: Record<string, BookFolderEntry[]> = {
    'Books': [
      { path: 'Books/First.md', kind: 'markdown' },
      { path: 'Books/cover.jpg', kind: 'other' },
      { path: 'Books/Reading', kind: 'folder' },
      { path: 'Books/.private', kind: 'folder' },
    ],
    'Books/Reading': [{ path: 'Books/Reading/Renamed.md', kind: 'markdown' }],
    'Personal': [{ path: 'Personal/Unrelated.md', kind: 'markdown' }],
  };
  const visited: string[] = [];
  const paths = bookNotePaths('Books', path => { visited.push(path); return tree[path] ?? []; });
  assert.deepEqual(paths, ['Books/First.md', 'Books/Reading/Renamed.md']);
  assert.deepEqual(visited, ['Books', 'Books/Reading']);
});

void test('missing and newly selected folders never fall back to a vault-wide search', () => {
  const visited: string[] = [];
  assert.deepEqual(bookNotePaths('New/Books', path => { visited.push(path); return []; }), []);
  assert.deepEqual(visited, ['New/Books']);
  for (const folder of ['', '/', '.', '..', 'Books/../Personal', '/Books']) {
    assert.throws(() => bookNotePaths(folder, () => { throw new Error('Must not read an invalid root'); }), /relative vault path/);
  }
});

void test('folder boundaries exclude siblings, hidden paths, traversal, and the root itself', () => {
  for (const path of ['Bookshelf/Other.md', 'Other/Books/a.md', 'Books', 'Books/../Other/a.md', 'Books/.hidden/a.md', 'Books/a/../../b.md', 'Books\\a.md']) {
    assert.equal(isInBookFolder(path, 'Books'), false, path);
    assert.throws(() => requireBookFolderPath(path, 'Books'), /outside the configured/);
  }
  assert(isInBookFolder('Books/Reading/Book.md', 'Books'));
  assert(isInBookFolder('Library/Books/Book.md', 'Library/Books'));
});

void test('malformed child listings stop before an outside folder can be visited', () => {
  for (const path of ['Personal', 'Bookshelf/Private', 'Books/../Personal', 'Books/deep/Skipped', 'Books/']) {
    const visited: string[] = [];
    assert.throws(() => bookNotePaths('Books', parent => {
      visited.push(parent);
      return [{ path, kind: 'folder' }];
    }));
    assert.deepEqual(visited, ['Books']);
  }
});
