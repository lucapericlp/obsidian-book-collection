import { bookKey, type Book } from './model';

export function bookMetadata(book: Book): Record<string, unknown> {
  return {
    book_key: bookKey(book), book_source: book.source, book_id: book.id,
    collection_mode: book.mode, title: book.title, authors: book.authors,
    reading_status: book.status,
    ...(book.rating !== undefined ? { rating: book.rating } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.year ? { publication_year: book.year } : {}),
    ...(book.url ? { source_url: book.url } : {}),
    ...(book.journalUrl ? { hardcover_journal_url: book.journalUrl } : {}),
  };
}

const owned = new Set(['book_key', 'book_source', 'book_id', 'collection_mode', 'title', 'authors', 'reading_status', 'rating', 'isbn', 'publication_year', 'source_url', 'hardcover_journal_url']);
export type MetadataParser = (yaml: string) => unknown;

function inlineComment(line: string): string {
  let quote = '';
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quote === '"' && character === '\\') { index++; continue; }
    if (quote === "'" && character === "'" && line[index + 1] === "'") { index++; continue; }
    if (quote) { if (character === quote) quote = ''; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === '#' && /\s/.test(line[index - 1] ?? '')) return (line.slice(0, index).match(/\s*$/)?.[0] ?? ' ') + line.slice(index);
  }
  return '';
}

// Edit only plugin-owned frontmatter fields. Never serialize or alter the body,
// unknown properties, created date, tags, or the note's path/title heading.
export function syncBookMetadata(content: string, book: Book, parse: MetadataParser): { content: string; changed: boolean } {
  const match = content.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (!match) throw new Error('The tracked note needs valid frontmatter before metadata can be synced.');
  const header = match[2]!;
  const parsed = parse(header);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The note frontmatter must be a mapping.');
  const old = parsed as Record<string, unknown>;
  const current = bookMetadata(book);
  if (old.book_key !== bookKey(book)) throw new Error('The note book_key does not match this source, mode, and book. Nothing was synced.');
  const newline = match[1]!.endsWith('\r\n') ? '\r\n' : '\n';
  const lines = header.split(newline);
  const positions = new Map<string, number>();
  for (let index = 0; index < lines.length; index++) {
    const key = lines[index]!.match(/^([a-z][a-z0-9_]*):(?:\s|$)/)?.[1];
    if (!key || !owned.has(key)) continue;
    if (positions.has(key)) throw new Error(`Duplicate managed property ${key}; resolve it before syncing.`);
    positions.set(key, index);
  }
  const edits: Array<{ start: number; end: number; lines: string[] }> = [];
  const additions: string[] = [];
  for (const key of owned) {
    if (Object.hasOwn(old, key) && !positions.has(key)) throw new Error(`Managed property ${key} uses unsupported key syntax; simplify that key before syncing.`);
    if (JSON.stringify(old[key]) === JSON.stringify(current[key])) continue;
    const value = current[key];
    const index = positions.get(key);
    if (index === undefined) { if (value !== undefined) additions.push(`${key}: ${JSON.stringify(value)}`); continue; }
    let end = index + 1;
    let scan = end;
    while (scan < lines.length && (!lines[scan]!.trim() || /^\s/.test(lines[scan]!))) {
      if (lines[scan]!.trim()) end = scan + 1;
      scan++;
    }
    const comment = inlineComment(lines[index]!);
    edits.push({ start: index, end, lines: value === undefined ? (comment ? [comment.trimStart()] : []) : [`${key}: ${JSON.stringify(value)}${comment}`] });
  }
  if (!edits.length && !additions.length) return { content, changed: false };
  for (const edit of edits.sort((left, right) => right.start - left.start)) lines.splice(edit.start, edit.end - edit.start, ...edit.lines);
  if (additions.length) lines.push(...additions);
  const updatedHeader = lines.join(newline);
  const checked = parse(updatedHeader) as Record<string, unknown>;
  for (const key of owned) if (JSON.stringify(checked[key]) !== JSON.stringify(current[key])) throw new Error(`Could not safely update ${key}; note left unchanged.`);
  const updated = match[1] + updatedHeader + match[3] + content.slice(match[0].length);
  return { content: updated, changed: updated !== content };
}
