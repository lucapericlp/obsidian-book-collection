import { bookKey, vaultPath, type Book } from './model';
import { bookMetadata } from './book-metadata';
import { pendingInsightsBlock } from './insights';
import { replaceControls } from './text-safety';
import { requireBookFolderPath } from './book-folder';

export interface NoteStore {
  findByKey(key: string, folder: string): string | undefined;
  exists(path: string): boolean;
  read(path: string): Promise<string>;
  ensureFolder(path: string): Promise<void>;
  create(path: string, content: string): Promise<void>;
}

export interface BookNote {
  path: string;
  created: boolean;
}

function filenamePart(value: string, maxLength: number): string {
  const cleaned = replaceControls(value.normalize('NFC'), '-').replace(/[\\/:*?"<>|#[\]^]/g, '-').replace(/\s+/g, ' ').replace(/^\.+|[. ]+$/g, '').trim();
  let result = '';
  for (const character of cleaned) {
    if (new TextEncoder().encode(result + character).length > maxLength) break;
    result += character;
  }
  return result.replace(/[. ]+$/g, '') || 'Untitled';
}

export function noteStem(book: Book): string {
  return `${filenamePart(book.title, 70)} — ${filenamePart(book.authors[0] ?? 'Unknown author', 40)} (${book.source}-${book.mode}-${filenamePart(book.id, 30)})`;
}

export function renderBookNote(book: Book, date = new Date()): string {
  const properties: Record<string, unknown> = {
    ...bookMetadata(book),
    created: date.toISOString().slice(0, 10),
    tags: ['book'],
  };
  const frontmatter = Object.entries(properties).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
  const title = book.title.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}[\]<>]/g, '\\$&');
  const source = book.mode === 'sample' ? '> Sample library book. This entry is for testing.\n\n' : '';
  const links = [book.url ? `[${book.source === 'hardcover' ? 'Hardcover book' : 'Source book'}](${book.url})` : '', book.journalUrl ? `[Hardcover journals](${book.journalUrl})` : ''].filter(Boolean).join(' · ');
  const insights = book.source === 'hardcover' && book.mode === 'live' && /^[1-9]\d*$/.test(book.id)
    ? pendingInsightsBlock(book)
    : 'A refreshed Insights view is available for tracked live Hardcover books.';
  return `---\n${frontmatter}\n---\n\n# ${title}\n\n${source}${links ? links + '\n\n' : ''}## Insights\n\n${insights}\n\n## Notes\n\nPersonal writing here stays in this vault.\n\n`;
}

function contentHasKey(content: string, key: string): boolean {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const value = frontmatter?.match(/^book_key: (.+)$/m)?.[1];
  if (!value) return false;
  try {
    return JSON.parse(value) === key;
  } catch {
    return value.trim() === key;
  }
}

export class BookNotes {
  private readonly pending = new Map<string, Promise<BookNote>>();

  constructor(private readonly store: NoteStore) {}

  async find(book: Book, folder: string): Promise<string | undefined> {
    folder = vaultPath(folder);
    const key = bookKey(book);
    const indexed = this.store.findByKey(key, folder);
    if (indexed) { requireBookFolderPath(indexed, folder); return indexed; }
    const stem = noteStem(book);
    let counter = 1;
    while (true) {
      const path = `${vaultPath(folder)}/${stem}${counter === 1 ? '' : ` ${counter}`}.md`;
      if (!this.store.exists(path)) return undefined;
      if (contentHasKey(await this.store.read(path), key)) return path;
      counter++;
    }
  }

  ensure(book: Book, folder: string): Promise<BookNote> {
    folder = vaultPath(folder);
    const key = `${bookKey(book)}:${folder}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const operation = this.ensureNote(book, folder);
    this.pending.set(key, operation);
    void operation.finally(() => this.pending.delete(key)).catch(() => undefined);
    return operation;
  }

  private async ensureNote(book: Book, folder: string): Promise<BookNote> {
    const key = bookKey(book);
    const existing = this.store.findByKey(key, folder);
    if (existing) { requireBookFolderPath(existing, folder); return { path: existing, created: false }; }
    await this.store.ensureFolder(folder);
    const stem = noteStem(book);
    let counter = 1;
    while (true) {
      const path = `${folder}/${stem}${counter === 1 ? '' : ` ${counter}`}.md`;
      if (this.store.exists(path)) {
        if (contentHasKey(await this.store.read(path), key)) return { path, created: false };
        counter++;
        continue;
      }
      try {
        await this.store.create(path, renderBookNote(book));
        return { path, created: true };
      } catch (error) {
        if (!this.store.exists(path)) throw error;
      }
    }
  }
}
