import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMapping as parse } from './helpers';
import { syncBookMetadata } from '../src/book-metadata';
import { renderBookNote, BookNotes, type NoteStore } from '../src/notes';
import { bookKey, type Book } from '../src/model';

const book: Book = { id: '374328', source: 'hardcover', mode: 'live', title: 'Brave New World', authors: ['Aldous Huxley'], status: 'Currently reading', year: 1932, url: 'https://hardcover.app/books/brave-new-world', journalUrl: 'https://hardcover.app/@reader/journals' };
const header = (text: string) => text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)!;
const body = (text: string) => text.slice(header(text)[0].length);

void test('sync updates owned Hardcover state and removes cleared ratings while preserving all freeform body bytes and unrelated metadata', () => {
  const personal = '\n# My own title\n\n## Reading notes\nFreeform “writing”.\n```yaml\nreading_status: do not touch\n```\n\n<!-- historical markers stay here -->\n';
  const text = `---\nbook_key: "${bookKey(book)}"\nreading_status: "Read" # keep this annotation\nrating: 5\nauthors:\n  - Earlier author\ncreated: 2021-03-04\ntags: [book, personal]\ncustom:\n  nested: [one, two]\n  writing: "mine"\n---\n${personal}`;
  const result = syncBookMetadata(text, book, parse);
  const metadata = parse(header(result.content)[1]!);
  assert(result.changed);
  assert.equal(metadata.reading_status, book.status);
  assert.deepEqual(metadata.authors, book.authors);
  assert.equal(metadata.rating, undefined);
  assert.equal(metadata.hardcover_journal_url, book.journalUrl);
  assert.equal(body(result.content), personal);
  assert(result.content.includes('reading_status: "Currently reading" # keep this annotation'));
  assert(result.content.includes('custom:\n  nested: [one, two]\n  writing: "mine"'));
  assert(result.content.includes('created: 2021-03-04\ntags: [book, personal]'));
  assert.deepEqual(syncBookMetadata(result.content, book, parse), { content: result.content, changed: false });
});

void test('CRLF, BOM, Markdown insights already present as history, and a final missing newline remain byte-preserved', () => {
  const original = '\uFEFF' + renderBookNote(book).replaceAll('\n', '\r\n') + 'Private writing with\r\nno final newline';
  const result = syncBookMetadata(original, { ...book, status: 'Read', rating: 4.5 }, parse);
  assert.equal(body(result.content), body(original));
  assert(result.content.startsWith('\uFEFF---\r\n'));
  assert(!result.content.replaceAll('\r\n', '').includes('\n'));
  assert.equal(parse(header(result.content)[1]!).rating, 4.5);
});

void test('source/mode/book identity is required even when the title matches', () => {
  for (const other of [{ ...book, mode: 'sample' as const }, { ...book, id: 'another-edition' }, { ...book, source: 'goodreads' as const }]) {
    assert.throws(() => syncBookMetadata(renderBookNote(other), book, parse), /book_key does not match/);
  }
});

void test('invalid, duplicate, or complex managed keys fail before a note can be changed', () => {
  const base = renderBookNote(book);
  assert.throws(() => syncBookMetadata('No frontmatter\n', book, parse), /frontmatter/);
  assert.throws(() => syncBookMetadata(base.replace('title:', 'custom: [\ntitle:'), book, parse));
  assert.throws(() => syncBookMetadata(base.replace('---\n\n#', 'rating: 1\nrating: 2\n---\n\n#'), book, parse));
  assert.throws(() => syncBookMetadata(base.replace('reading_status:', '"reading_status":'), { ...book, status: 'Read' }, parse), /unsupported key syntax/);
});

void test('quoted hash characters and nested unknown properties survive a genuine title/author change', () => {
  const original = renderBookNote({ ...book, title: 'Old # title', authors: ['Old "Name"'] }).replace('---\n\n#', 'user_state:\n  title: "My # title"\n---\n\n#');
  const result = syncBookMetadata(original, book, parse);
  assert.equal(parse(header(result.content)[1]!).title, book.title);
  assert(result.content.includes('user_state:\n  title: "My # title"'));
  assert.equal(body(result.content), body(original));
});

void test('moved or renamed notes sync by stable book identity and never create another path', async () => {
  const path = 'Personal reading/Renamed note.md';
  const files = new Map([[path, renderBookNote({ ...book, status: 'Want to read' }) + 'Keep my writing.']]);
  const store: NoteStore = {
    findByKey: key => key === bookKey(book) ? path : undefined,
    exists: name => files.has(name), read: async name => files.get(name)!,
    ensureFolder: async () => { throw new Error('Should not create a folder'); },
    create: async () => { throw new Error('Should not create a note'); },
  };
  const notes = new BookNotes(store);
  const note = await notes.ensure(book, 'Books');
  assert.equal(note.path, path);
  assert.equal(note.created, false);
  const original = files.get(path)!;
  files.set(path, syncBookMetadata(original, book, parse).content);
  assert.equal(body(files.get(path)!), body(original));
  assert.equal(files.size, 1);
});

void test('new notes have separate Insights and Notes sections with a pending disposable view', () => {
  const text = renderBookNote(book);
  assert(text.includes('## Insights'));
  assert(text.includes('## Notes'));
  assert(text.includes('Refresh this book’s insights'));
  assert(text.includes(`[Hardcover journals](${book.journalUrl})`));
  assert(!text.includes('book-collection-entry:'));
  assert(!text.includes('## Reading notes'));
});
