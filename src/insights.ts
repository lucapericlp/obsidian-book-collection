import { bookKey, type Book } from './model';
import type { MetadataParser } from './book-metadata';
import { hasUnsupportedControls } from './text-safety';

export interface JournalInsight {
  id: string;
  bookId: string;
  event: 'note' | 'quote';
  entry: string;
  actionAt: string;
  privacy: 1 | 2 | 3;
  position?: JournalPosition;
}

export interface JournalPosition {
  percent: number;
  page?: number;
  totalPages?: number;
}

// Hardcover's native journal form stores metadata.position. Do not infer a
// page from the current catalog: an entry belongs to its original edition.
export function journalPosition(metadata: unknown): JournalPosition | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const position = (metadata as Record<string, unknown>).position;
  if (position == null) return undefined;
  if (typeof position !== 'object' || Array.isArray(position)) throw new Error('Hardcover returned an invalid journal position. The previous view was kept.');
  const raw = position as Record<string, unknown>;
  if (typeof raw.percent !== 'number' || !Number.isFinite(raw.percent) || raw.percent < 0 || raw.percent > 100) throw new Error('Hardcover returned an invalid journal percentage. The previous view was kept.');
  if (raw.type === 'pages') {
    if (!Number.isSafeInteger(raw.value) || !Number.isSafeInteger(raw.possible) || Number(raw.value) < 0 || Number(raw.possible) <= 0 || Number(raw.value) > Number(raw.possible)) throw new Error('Hardcover returned an invalid journal page. The previous view was kept.');
    return { percent: raw.percent, page: Number(raw.value), totalPages: Number(raw.possible) };
  }
  return { percent: raw.percent };
}

const PREFIX = '<!-- book-collection-insights:';

export function requireLiveBook(book: Book): void {
  if (book.source !== 'hardcover' || book.mode !== 'live' || !/^[1-9]\d*$/.test(book.id) || !Number.isSafeInteger(Number(book.id))) throw new Error('Insights refresh requires a tracked live Hardcover book ID.');
}

function markers(book: Book): { start: string; end: string } {
  requireLiveBook(book);
  return { start: `${PREFIX}start v1 ${bookKey(book)} -->`, end: `${PREFIX}end v1 ${bookKey(book)} -->` };
}

// Encode punctuation before Markdown parsing. Each line displays literally,
// including links/HTML/marker-looking content; remote text creates no syntax.
export function escapeInsightText(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, character => `&#${character.charCodeAt(0)};`);
}

function remoteLink(label: string, value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'hardcover.app' || url.username || url.password) return '';
    return `[${label}](<${url.href.replace(/[<>\r\n]/g, character => encodeURIComponent(character))}>)`;
  } catch { return ''; }
}

function wrap(book: Book, lines: string[], newline: string): string {
  const tags = markers(book);
  return [tags.start, ...lines, tags.end].join(newline);
}

export function pendingInsightsBlock(book: Book, newline = '\n'): string {
  return wrap(book, ['Refresh this book’s insights to load its Hardcover notes and quotes.'], newline);
}

function snapshotBlock(book: Book, snapshot: readonly JournalInsight[], newline: string): string {
  const seen = new Set<string>();
  for (const insight of snapshot) {
    if (!/^[1-9]\d*$/.test(insight.id) || seen.has(insight.id) || insight.bookId !== book.id || !['note', 'quote'].includes(insight.event) || !Number.isFinite(Date.parse(insight.actionAt)) || typeof insight.entry !== 'string' || hasUnsupportedControls(insight.entry, true) || ![1, 2, 3].includes(insight.privacy)) throw new Error('Hardcover returned an invalid insight snapshot. The previous view was kept.');
    seen.add(insight.id);
    const position = insight.position;
    if (position && (!Number.isFinite(position.percent) || position.percent < 0 || position.percent > 100 || (position.page !== undefined && (!Number.isSafeInteger(position.page) || !Number.isSafeInteger(position.totalPages) || position.page < 0 || position.totalPages! <= 0 || position.page > position.totalPages!)))) throw new Error('Hardcover returned an invalid insight position. The previous view was kept.');
  }
  const sorted = [...snapshot].sort((left, right) => Date.parse(left.actionAt) - Date.parse(right.actionAt) || (BigInt(left.id) < BigInt(right.id) ? -1 : 1));
  const links = [remoteLink('Book on Hardcover', book.url), remoteLink('Your Hardcover journals', book.journalUrl)].filter(Boolean).join(' · ');
  const lines = ['> Read-only view from Hardcover. Refresh replaces this block; write personal material in Notes.'];
  if (links) lines.push('', links);
  if (!sorted.length) lines.push('', 'No Hardcover notes or quotes.');
  for (const insight of sorted) {
    const date = new Date(insight.actionAt).toISOString().replace('T', ' ').replace('Z', ' UTC');
    const privacy = ({ 1: 'Public', 2: 'Followers', 3: 'Private' } as const)[insight.privacy];
    const position = insight.position;
    const location = position ? ` · ${position.page !== undefined ? `Page ${position.page} of ${position.totalPages} · ` : ''}${Number(position.percent.toFixed(2))}%` : '';
    lines.push('', `### ${insight.event === 'note' ? 'Note' : 'Quote'} · ${date}`, '', `Hardcover entry ${insight.id} · ${privacy}${location}`, '');
    const textLines = insight.entry.replace(/\r\n?/g, '\n').split('\n');
    lines.push(...textLines.map((line, index) => `> ${escapeInsightText(line)}${index < textLines.length - 1 ? '  ' : ''}`));
  }
  lines.push('');
  return wrap(book, lines, newline);
}

export function replaceInsights(content: string, book: Book, snapshot: readonly JournalInsight[], parse: MetadataParser): { content: string; changed: boolean } {
  const tags = markers(book);
  const frontmatter = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter || (parse(frontmatter[1]!) as Record<string, unknown>)?.book_key !== bookKey(book)) throw new Error('The note identity changed or is not this live Hardcover book. Insights were not replaced.');
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const block = snapshotBlock(book, snapshot, newline);
  const occurrences = [...content.matchAll(/<!--\s*book-collection-insights\b/gi)];
  const found: Array<{ tag: 'start' | 'end'; key: string; offset: number; length: number }> = [];
  let offset = 0;
  let fence: { character: string; length: number } | undefined;
  let inComment = false;
  for (const fullLine of content.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const line = fullLine.replace(/\r?\n$/, '');
    if (line.includes(PREFIX)) {
      if (offset < frontmatter[0].length || fence || inComment) throw new Error('Insights markers appear inside personal code, comments, or metadata. Resolve ownership before refreshing.');
      const match = line.match(/^<!-- book-collection-insights:(start|end) v1 (hardcover:live:[1-9]\d*) -->$/);
      if (!match) throw new Error('An Insights marker is malformed. The previous view was kept.');
      found.push({ tag: match[1] as 'start' | 'end', key: match[2]!, offset, length: line.length });
    } else if (offset >= frontmatter[0].length) {
      const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (!inComment && delimiter) {
        if (!fence) fence = { character: delimiter[1]![0]!, length: delimiter[1]!.length };
        else if (delimiter[1]![0] === fence.character && delimiter[1]!.length >= fence.length && !delimiter[2]!.trim()) fence = undefined;
      }
      if (!fence) {
        if (inComment) { if (line.includes('-->')) inComment = false; }
        else if (line.includes('<!--') && !line.slice(line.indexOf('<!--') + 4).includes('-->')) inComment = true;
      }
    }
    offset += fullLine.length;
  }
  if (!occurrences.length) {
    if (fence || inComment) throw new Error('Close the unfinished code fence or HTML comment before adding an Insights view.');
    // Append a new owned section. An arbitrary existing Insights heading is personal.
    const separator = content.endsWith(newline + newline) ? '' : content.endsWith(newline) ? newline : newline + newline;
    return { content: content + separator + `## Insights${newline}${newline}` + block + newline, changed: true };
  }
  if (occurrences.length !== 2 || found.length !== 2 || found[0]!.tag !== 'start' || found[1]!.tag !== 'end' || found.some(marker => marker.key !== bookKey(book))) throw new Error('Insights markers are missing, duplicated, out of order, or belong to another book. The note was kept.');
  const start = found[0]!.offset;
  const end = found[1]!.offset + found[1]!.length;
  if (content.slice(start, start + tags.start.length) !== tags.start || content.slice(found[1]!.offset, end) !== tags.end) throw new Error('Insights ownership could not be verified.');
  const updated = content.slice(0, start) + block + content.slice(end);
  return { content: updated, changed: updated !== content };
}

export interface ProjectionStore {
  read(path: string): Promise<string>;
  process(path: string, transform: (content: string) => string): Promise<string>;
}

export class InsightProjection {
  private readonly pending = new Map<string, Promise<{ changed: boolean; entries: number }>>();

  constructor(private readonly load: (book: Book) => Promise<JournalInsight[]>, private readonly store: ProjectionStore, private readonly parse: MetadataParser) {}

  sync(book: Book, path: string, ownedMetadata?: (content: string) => string): Promise<{ changed: boolean; entries: number }> {
    const previous = this.pending.get(path) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      requireLiveBook(book);
      const snapshot = await this.load(book); // A failed/partial fetch never reaches process().
      const original = await this.store.read(path);
      const preview = replaceInsights(ownedMetadata ? ownedMetadata(original) : original, book, snapshot, this.parse);
      if (preview.content === original) return { changed: false, entries: snapshot.length };
      let changed = false;
      await this.store.process(path, content => {
        const result = replaceInsights(ownedMetadata ? ownedMetadata(content) : content, book, snapshot, this.parse);
        changed = result.content !== content;
        return result.content;
      });
      return { changed, entries: snapshot.length };
    });
    this.pending.set(path, operation);
    void operation.finally(() => { if (this.pending.get(path) === operation) this.pending.delete(path); }).catch(() => undefined);
    return operation;
  }
}
