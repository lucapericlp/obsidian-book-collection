import { parseRequest } from './helpers';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { bookKey, DEFAULT_SETTINGS, loadSettings, vaultPath } from '../src/model';
import { GoodreadsCsvSource, parseCsv, parseGoodreadsCsv } from '../src/sources/goodreads';
import { HardcoverSource, HARDCOVER_ENDPOINT, type HttpRequest, type HttpResponse } from '../src/sources/hardcover';
import { SampleSource } from '../src/sources/sample';

void test('both selectable sample sources work without credentials and have distinct identities', async () => {
  const hardcover = await new SampleSource('hardcover').loadBooks();
  const goodreads = await new SampleSource('goodreads').loadBooks();
  assert.equal(hardcover.length, 6);
  assert.equal(goodreads.length, 6);
  assert(hardcover.every(book => book.mode === 'sample' && book.source === 'hardcover'));
  assert.notEqual(bookKey(hardcover[0]!), bookKey(goodreads[0]!));
  hardcover[0]!.authors.push('Changed');
  assert.equal((await new SampleSource('hardcover').loadBooks())[0]!.authors.length, 1);
});

void test('Goodreads imports real export shapes, formula ISBNs, quoted commas, doubled quotes and multiline reviews', async () => {
  const fixture = await readFile(new URL('../fixtures/goodreads-demo.csv', import.meta.url), 'utf8');
  const books = parseGoodreadsCsv(`\uFEFF${fixture.replace(/\n/g, '\r\n')}`);
  assert.equal(books.length, 3);
  assert.equal(books[0]!.title, 'The Library, at Dusk');
  assert.equal(books[0]!.isbn, '9780123456786');
  assert.equal(books[0]!.status, 'Currently reading');
  assert.equal(books[0]!.rating, 4);
  assert.equal(books[1]!.rating, undefined);
  assert.equal(books[2]!.status, 'Read');
  assert.equal(books[0]!.mode, 'csv');
  const parsed = parseCsv('Title,Review\n"A ""quoted"" title","line 1\nline 2"\n');
  assert.deepEqual(parsed[1], ['A "quoted" title', 'line 1\nline 2']);
  assert(!('review' in books[0]!));
});

void test('Goodreads imports additional authors and deduplicates book IDs', () => {
  const books = parseGoodreadsCsv('Book Id,Title,Author,Additional Authors,ISBN13\n1,First,Ada,"Sam, Jo","=""9780123456786"""\n1,Updated,Ada,,\n');
  assert.equal(books.length, 1);
  assert.equal(books[0]!.title, 'Updated');
  const authors = parseGoodreadsCsv('Book Id,Title,Author,Additional Authors\n1,First,Ada,"Sam, Jo"');
  assert.deepEqual(authors[0]!.authors, ['Ada', 'Sam', 'Jo']);
});

void test('CSV failures are explicit and never become sample data', async () => {
  for (const csv of ['Title,Author\nBook,Ada', 'Book Id,Title,Author\n1,"Unfinished,Ada', 'Book Id,Title,Author\nabc,Book,Ada', 'Book Id,Title,Author\n1,Book,Ada,Extra']) {
    assert.throws(() => parseGoodreadsCsv(csv));
  }
  assert.throws(() => parseCsv('"closed"unexpected,field'));
  assert.deepEqual(parseGoodreadsCsv('Book Id,Title,Author\n'), []);
  const source = new GoodreadsCsvSource('Imports/missing.csv', async () => { throw new Error('File missing'); });
  await assert.rejects(() => source.loadBooks(), /File missing/);
});

function libraryEntry(id: number) {
  return {
    id,
    status_id: 2,
    rating: '4.5',
    book: {
      id: id + 1000,
      title: `Book ${id}`,
      slug: `book-${id}`,
      release_year: 2024,
      cached_contributors: [
        { author: { name: 'Ada Example' }, contribution: null },
        { author: { name: 'A Translator' }, contribution: 'Translator' },
      ],
    },
  };
}

void test('Hardcover queries only the authenticated collection and paginates every entry', async () => {
  const requests: HttpRequest[] = [];
  let pauses = 0;
  const responses: HttpResponse[] = [
    { status: 200, json: { data: { me: [{ id: 42 }] } } },
    { status: 200, json: { data: { user_books: Array.from({ length: 100 }, (_, index) => libraryEntry(index + 1)) } } },
    { status: 200, json: { data: { user_books: [libraryEntry(101)] } } },
  ];
  const source = new HardcoverSource('Bearer local-test-token', async request => {
    requests.push(request);
    return responses.shift()!;
  }, async () => { pauses++; });
  const books = await source.loadBooks();
  assert.equal(books.length, 101);
  assert.equal(requests.length, 3);
  assert.equal(pauses, 3);
  assert(requests.every(request => request.url === HARDCOVER_ENDPOINT && request.method === 'POST'));
  assert(requests.every(request => request.headers.Authorization === 'Bearer local-test-token'));
  const firstPage = parseRequest(requests[1]!.body);
  const secondPage = parseRequest(requests[2]!.body);
  assert.deepEqual(firstPage.variables, { userId: 42, after: 0, limit: 100 });
  assert.deepEqual(secondPage.variables, { userId: 42, after: 100, limit: 100 });
  assert.match(firstPage.query, /user_id: \{_eq: \$userId\}/);
  assert(!requests.some(request => /mutation/.test(request.body)));
  assert.equal(books[0]!.status, 'Currently reading');
  assert.equal(books[0]!.rating, 4.5);
  assert.deepEqual(books[0]!.authors, ['Ada Example']);
  assert.equal(books[0]!.url, 'https://hardcover.app/books/book-1');
});

void test('Hardcover returns an empty authenticated collection without sample substitution', async () => {
  let calls = 0;
  const source = new HardcoverSource('test', async () => ({ status: 200, json: { data: calls++ === 0 ? { me: [{ id: 42 }] } : { user_books: [] } } }), async () => {});
  assert.deepEqual(await source.loadBooks(), []);
});

void test('Hardcover derives the owning account journal link without fetching journal text', async () => {
  const calls: string[] = [];
  const source = new HardcoverSource('local-test-token', async request => {
    const query = parseRequest(request.body).query;
    calls.push(query);
    return { status: 200, json: { data: query.includes('ObsidianBooksIdentity') ? { me: [{ id: 7, username: 'reader' }] } : { user_books: [{ id: 1, status_id: 2, rating: 4, book: { id: 374328, title: 'Brave New World', slug: 'brave-new-world', release_year: 1932, cached_contributors: [] } }] } } };
  }, async () => undefined);
  const books = await source.loadBooks();
  assert.equal(books[0]!.journalUrl, 'https://hardcover.app/@reader/journals');
  assert(calls.every(query => !query.includes('reading_journals')));
});

void test('Hardcover handles authentication, scopes, throttling and GraphQL errors without exposing server data', async () => {
  for (const [status, message] of [[401, /token/i], [403, /read:library/], [429, /rate limit/i], [503, /503/]] as const) {
    const source = new HardcoverSource('private-test-token', async () => ({ status, json: { error: 'private-test-token' } }), async () => undefined);
    await assert.rejects(() => source.loadBooks(), error => error instanceof Error && message.test(error.message) && !error.message.includes('private-test-token'));
  }
  const graphError = new HardcoverSource('private-test-token', async () => ({ status: 200, json: { errors: [{ message: 'private-test-token' }] } }), async () => undefined);
  await assert.rejects(() => graphError.loadBooks(), /Check token scopes/);
  const networkError = new HardcoverSource('private-test-token', async () => { throw new Error('private-test-token'); }, async () => undefined);
  await assert.rejects(() => networkError.loadBooks(), /Could not reach Hardcover/);
  const missingToken = new HardcoverSource('', async () => { throw new Error('Network must not be called'); });
  await assert.rejects(() => missingToken.loadBooks(), /Select a Hardcover API secret/);
});

void test('Hardcover rejects missing account and non-advancing pages instead of looping', async () => {
  const missingAccount = new HardcoverSource('test', async () => ({ status: 200, json: { data: { me: [] } } }), async () => undefined);
  await assert.rejects(() => missingAccount.loadBooks(), /no account/);
  let calls = 0;
  const badPage = new HardcoverSource('test', async () => ({ status: 200, json: { data: calls++ === 0 ? { me: [{ id: 42 }] } : { user_books: [libraryEntry(1), libraryEntry(1)] } } }), async () => {});
  await assert.rejects(() => badPage.loadBooks(), /invalid library page/);
});

void test('settings ignore unexpected fields, never load tokens, and reject paths outside visible vault folders', () => {
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
  const loaded = loadSettings({ source: 'goodreads', hardcoverToken: 'private', unknown: 'value' });
  assert.equal(loaded.source, 'goodreads');
  assert(!JSON.stringify(loaded).includes('private'));
  assert.equal(vaultPath(' Books/Reading '), 'Books/Reading');
  assert.equal(vaultPath('Imports\\library.csv'), 'Imports/library.csv');
  for (const path of ['/Users/private', '../outside', 'Books/../outside', '.obsidian/books', 'Books//Notes', 'C:\\outside', 'Books/.hidden', '']) {
    assert.throws(() => vaultPath(path));
  }
});
