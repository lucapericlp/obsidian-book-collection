import { hasUnsupportedControls } from './text-safety';

export type SourceId = 'hardcover' | 'goodreads';
export type CollectionMode = 'sample' | 'live' | 'csv';

export interface Book {
  id: string;
  source: SourceId;
  mode: CollectionMode;
  title: string;
  authors: string[];
  status: string;
  rating?: number;
  isbn?: string;
  year?: number;
  url?: string;
  journalUrl?: string;
}

export interface BookSource {
  readonly label: string;
  loadBooks(): Promise<Book[]>;
}

export interface BooksSettings {
  source: SourceId;
  hardcoverMode: 'sample' | 'live';
  goodreadsMode: 'sample' | 'csv';
  hardcoverSecret: string;
  goodreadsCsvPath: string;
  noteFolder: string;
}

export const DEFAULT_SETTINGS: BooksSettings = {
  source: 'hardcover',
  hardcoverMode: 'sample',
  goodreadsMode: 'sample',
  hardcoverSecret: 'book-collection-hardcover',
  goodreadsCsvPath: 'Imports/goodreads_library_export.csv',
  noteFolder: 'Books',
};

export function bookKey(book: Book): string {
  return `${book.source}:${book.mode}:${book.id}`;
}

export function loadSettings(value: unknown): BooksSettings {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    source: stored.source === 'goodreads' ? 'goodreads' : 'hardcover',
    hardcoverMode: stored.hardcoverMode === 'live' ? 'live' : 'sample',
    goodreadsMode: stored.goodreadsMode === 'csv' ? 'csv' : 'sample',
    hardcoverSecret: typeof stored.hardcoverSecret === 'string' ? stored.hardcoverSecret : DEFAULT_SETTINGS.hardcoverSecret,
    goodreadsCsvPath: typeof stored.goodreadsCsvPath === 'string' ? stored.goodreadsCsvPath : DEFAULT_SETTINGS.goodreadsCsvPath,
    noteFolder: typeof stored.noteFolder === 'string' ? stored.noteFolder : DEFAULT_SETTINGS.noteFolder,
  };
}

export function vaultPath(value: string): string {
  const path = value.trim().replace(/\\/g, '/');
  if (!path || path.startsWith('/') || hasUnsupportedControls(path) || path.split('/').some(part => !part || part.startsWith('.') || /[:*?"<>|]/.test(part))) {
    throw new Error('Use a relative vault path such as Books or Imports/library.csv, without hidden folders or .. segments.');
  }
  return path;
}
