import type { Book, BookSource } from '../model';
import { journalPosition, type JournalInsight } from '../insights';
import { hasUnsupportedControls } from '../text-safety';

export const HARDCOVER_ENDPOINT = 'https://api.hardcover.app/v1/graphql';
export const HARDCOVER_SCOPES = 'read:me, read:library, read:catalog';
export const HARDCOVER_JOURNAL_SCOPES = 'read:me, read:journal';

export interface HttpRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

export interface HttpResponse {
  status: number;
  json: unknown;
}

export type Transport = (request: HttpRequest) => Promise<HttpResponse>;

export const LIBRARY_QUERY = `query ObsidianBooksLibrary($userId: Int!, $after: Int!, $limit: Int!) {
  user_books(where: {user_id: {_eq: $userId}, id: {_gt: $after}}, order_by: {id: asc}, limit: $limit) {
    id
    status_id
    rating
    book { id title slug release_year cached_contributors }
  }
}`;

export const INSIGHTS_QUERY = `query ObsidianBookInsights($userId: Int!, $bookId: Int!, $after: bigint!, $limit: Int!) {
  reading_journals(
    where: {user_id: {_eq: $userId}, book_id: {_eq: $bookId}, event: {_in: ["note", "quote"]}, id: {_gt: $after}},
    order_by: {id: asc}, limit: $limit
  ) { id user_id book_id event entry action_at privacy_setting_id metadata }
}`;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function authorsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap(contributor => {
    const entry = record(contributor);
    const author = record(entry.author);
    const name = author.name ?? entry.name;
    const role = entry.contribution ?? entry.role;
    if (typeof role === 'string' && role && !/author|writer/i.test(role)) return [];
    return typeof name === 'string' && name.trim() ? [name.trim()] : [];
  }))];
}

export class HardcoverSource implements BookSource {
  readonly label = 'Hardcover · live library';

  constructor(
    private readonly token: string,
    private readonly transport: Transport,
    private readonly pause: () => Promise<void> = () => new Promise(resolve => window.setTimeout(resolve, 1100)),
  ) {}

  private async query(query: string, variables: Record<string, number | string> = {}, scopes = HARDCOVER_SCOPES): Promise<Record<string, unknown>> {
    const token = this.token.trim().replace(/^Bearer\s+/i, '').trim();
    if (!token || /[\r\n]/.test(token)) throw new Error('Select a Hardcover API secret in Book Collection settings first.');
    let response: HttpResponse;
    try {
      await this.pause();
      response = await this.transport({
        url: HARDCOVER_ENDPOINT,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new Error('Could not reach Hardcover. Check your connection and try Refresh collection.');
    }
    if (response.status === 401) throw new Error('Hardcover rejected the API token. Check its value and expiry in Obsidian secrets.');
    if (response.status === 403) throw new Error(`Hardcover denied access. The token needs these read scopes: ${scopes}.`);
    if (response.status === 429) throw new Error('Hardcover rate limit reached. Wait before trying Refresh collection; also check your daily API allowance.');
    if (response.status !== 200) throw new Error(`Hardcover returned HTTP ${response.status}. Try Refresh collection later.`);
    const envelope = record(response.json);
    if (envelope.errors || envelope.error || !envelope.data) {
      throw new Error(`Hardcover could not complete this read. Check token scopes (${scopes}); the API schema may have changed.`);
    }
    return record(envelope.data);
  }

  async loadBooks(): Promise<Book[]> {
    const identity = await this.query('query ObsidianBooksIdentity { me { id username } }');
    const userId = Array.isArray(identity.me) ? record(identity.me[0]).id : undefined;
    const username = Array.isArray(identity.me) ? record(identity.me[0]).username : undefined;
    if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
      throw new Error('Hardcover returned no account for this token. Check its read:me permission.');
    }
    const books = new Map<string, Book>();
    let after = 0;
    while (true) {
      const data = await this.query(LIBRARY_QUERY, { userId, after, limit: 100 });
      if (!Array.isArray(data.user_books)) throw new Error('Hardcover returned an unexpected library response.');
      const entries = data.user_books;
      for (const raw of entries) {
        const entry = record(raw);
        const book = record(entry.book);
        if (typeof entry.id !== 'number' || entry.id <= after || !Number.isInteger(entry.id) || typeof book.id !== 'number') {
          throw new Error('Hardcover returned an invalid library page. Refresh collection to try again.');
        }
        after = entry.id;
        const id = String(book.id);
        const rating = Number(entry.rating);
        books.set(id, {
          id,
          source: 'hardcover',
          mode: 'live',
          title: typeof book.title === 'string' && book.title.trim() ? book.title.trim() : `Untitled book ${id}`,
          authors: authorsFrom(book.cached_contributors),
          status: ({ 1: 'Want to read', 2: 'Currently reading', 3: 'Read', 4: 'Paused', 5: 'Did not finish', 6: 'Ignored' } as Record<string, string>)[String(entry.status_id)] ?? 'In collection',
          rating: entry.rating != null && Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : undefined,
          year: typeof book.release_year === 'number' ? book.release_year : undefined,
          url: typeof book.slug === 'string' && book.slug ? `https://hardcover.app/books/${encodeURIComponent(book.slug)}` : undefined,
          journalUrl: typeof username === 'string' && username ? `https://hardcover.app/@${encodeURIComponent(username)}/journals` : undefined,
        });
      }
      if (entries.length < 100) return [...books.values()];
    }
  }

  async loadInsights(bookId: string): Promise<JournalInsight[]> {
    if (!/^[1-9]\d*$/.test(bookId) || !Number.isSafeInteger(Number(bookId))) throw new Error('Choose a valid live Hardcover book ID.');
    const identity = await this.query('query ObsidianInsightsIdentity { me { id } }', {}, HARDCOVER_JOURNAL_SCOPES);
    const userId = Array.isArray(identity.me) ? record(identity.me[0]).id : undefined;
    if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId <= 0) throw new Error('Hardcover returned no authenticated account for the journal read.');
    const insights: JournalInsight[] = [];
    let after = '0';
    for (let page = 0; page < 1000; page++) {
      const data = await this.query(INSIGHTS_QUERY, { userId, bookId: Number(bookId), after, limit: 100 }, HARDCOVER_JOURNAL_SCOPES);
      if (!Array.isArray(data.reading_journals) || data.reading_journals.length > 100) throw new Error('Hardcover returned an incomplete or invalid journal page. The previous view was kept.');
      const entries = data.reading_journals;
      for (const raw of entries) {
        const row = record(raw);
        const id = typeof row.id === 'number' && Number.isSafeInteger(row.id) ? String(row.id) : typeof row.id === 'string' ? row.id : '';
        if (!/^[1-9]\d*$/.test(id) || BigInt(id) <= BigInt(after) || row.user_id !== userId || String(row.book_id) !== bookId || !['note', 'quote'].includes(String(row.event)) || (row.entry !== null && typeof row.entry !== 'string') || typeof row.action_at !== 'string' || !Number.isFinite(Date.parse(row.action_at)) || ![1, 2, 3].includes(Number(row.privacy_setting_id))) throw new Error('Hardcover returned an invalid or non-advancing journal page. The previous view was kept.');
        const entry = (row.entry ?? '');
        if (hasUnsupportedControls(entry, true)) throw new Error('A journal entry contains unsupported control characters. The previous view was kept.');
        insights.push({ id, bookId, event: row.event as 'note' | 'quote', entry, actionAt: row.action_at, privacy: Number(row.privacy_setting_id) as 1 | 2 | 3, position: journalPosition(row.metadata) });
        after = id;
      }
      if (entries.length === 0) return insights;
    }
    throw new Error('The complete journal snapshot could not be fetched within the page limit. The previous view was kept.');
  }
}
