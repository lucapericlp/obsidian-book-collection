import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookKey, type Book } from '../src/model';
import { BookNotes, noteStem, renderBookNote, type NoteStore } from '../src/notes';

const book: Book = { id: '123', title: 'A Book', authors: ['Ada Example'], source: 'hardcover', mode: 'live', status: 'Read', rating: 4.5 };

class MemoryStore implements NoteStore {
  readonly files = new Map<string, string>();
  readonly indexed = new Map<string, string>();
  readonly folders = new Set<string>();
  creations = 0;

  findByKey(key: string): string | undefined { return this.indexed.get(key); }
  exists(path: string): boolean { return this.files.has(path); }
  async read(path: string): Promise<string> { return this.files.get(path)!; }
  async ensureFolder(path: string): Promise<void> { this.folders.add(path); }
  async create(path: string, content: string): Promise<void> {
    if (this.exists(path)) throw new Error('Already exists');
    this.creations++;
    this.files.set(path, content);
  }
}

void test('note creation is idempotent before metadata indexing and preserves every user edit', async () => {
  const store = new MemoryStore();
  const notes = new BookNotes(store);
  const first = await notes.ensure(book, 'Books/Reading');
  assert.equal(first.created, true);
  const edited = `${store.files.get(first.path)}\nMy own reading notes.\n`;
  store.files.set(first.path, edited);
  const second = await notes.ensure(book, 'Books/Reading');
  assert.equal(second.created, false);
  assert.equal(first.path, second.path);
  assert.equal(store.files.get(second.path), edited);
  assert.equal(store.creations, 1);
});

void test('concurrent selections create one note', async () => {
  const store = new MemoryStore();
  const notes = new BookNotes(store);
  const results = await Promise.all(Array.from({ length: 10 }, () => notes.ensure(book, 'Books')));
  assert.equal(new Set(results.map(result => result.path)).size, 1);
  assert.equal(store.creations, 1);
});

void test('renamed or moved indexed notes reopen by stable source identity after title and folder changes', async () => {
  const store = new MemoryStore();
  const path = 'Reading/Personal title.md';
  store.files.set(path, 'My writing');
  store.indexed.set(bookKey(book), path);
  const note = await new BookNotes(store).ensure({ ...book, title: 'Updated remote title' }, 'Books');
  assert.deepEqual(note, { path, created: false });
  assert.equal(store.files.get(path), 'My writing');
  assert.equal(store.creations, 0);
});

void test('unrelated filename collisions get a new path without replacing or opening the unrelated note', async () => {
  const store = new MemoryStore();
  const collisionPath = `Books/${noteStem(book)}.md`;
  store.files.set(collisionPath, 'Existing unrelated note');
  const note = await new BookNotes(store).ensure(book, 'Books');
  assert.notEqual(note.path, collisionPath);
  assert.equal(store.files.get(collisionPath), 'Existing unrelated note');
  assert.equal(note.created, true);
});

void test('sample/live modes and different collection sources create separate notes', async () => {
  const store = new MemoryStore();
  const notes = new BookNotes(store);
  const results = await Promise.all([
    notes.ensure(book, 'Books'),
    notes.ensure({ ...book, mode: 'sample' }, 'Books'),
    notes.ensure({ ...book, source: 'goodreads', mode: 'csv' }, 'Books'),
  ]);
  assert.equal(new Set(results.map(result => result.path)).size, 3);
});

void test('filenames handle hostile metadata and remain within portable byte limits', async () => {
  const tricky: Book = { ...book, title: '../Bad:/[Title] # ^\n' + '📚'.repeat(100), authors: ['書'.repeat(100)] };
  const stem = noteStem(tricky);
  assert(!/[\\/:*?"<>|#[\]^\n]/.test(stem));
  assert(!stem.startsWith('.'));
  assert(Buffer.byteLength(`${stem}.md`) < 255);
  await assert.rejects(async () => new BookNotes(new MemoryStore()).ensure(book, '../real-vault'));
});

void test('frontmatter quotes external metadata and makes room for personal writing without importing reviews', () => {
  const tricky = { ...book, title: 'A title\n---\ntags: malicious', authors: ['Ada: [Example]'], isbn: '0123456789' };
  const content = renderBookNote(tricky, new Date('2026-10-24T12:00:00Z'));
  assert(content.includes(`title: ${JSON.stringify(tricky.title)}`));
  assert(content.includes('isbn: "0123456789"'));
  assert(content.includes('created: "2026-10-24"'));
  assert(content.includes('## Notes\n\n'));
  assert.equal(content.split('\n').filter(line => line === '---').length, 2);
  assert(!content.includes('Sample library book'));
  assert(renderBookNote({ ...book, mode: 'sample' }).includes('Sample library book'));
});

void test('failed note creation surfaces the failure and can be retried', async () => {
  const store = new MemoryStore();
  let fail = true;
  const create = store.create.bind(store);
  store.create = async (path, content) => {
    if (fail) throw new Error('Disk full');
    await create(path, content);
  };
  const notes = new BookNotes(store);
  await assert.rejects(() => notes.ensure(book, 'Books'), /Disk full/);
  fail = false;
  assert.equal((await notes.ensure(book, 'Books')).created, true);
});
