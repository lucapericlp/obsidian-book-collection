import { parseRequest } from './helpers';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMapping as parse } from './helpers';
import { escapeInsightText, InsightProjection, journalPosition, replaceInsights, type JournalInsight } from '../src/insights';
import { renderBookNote } from '../src/notes';
import { syncBookMetadata } from '../src/book-metadata';
import { type Book } from '../src/model';
import { HardcoverSource, type Transport } from '../src/sources/hardcover';

const book: Book = { id: '374328', source: 'hardcover', mode: 'live', title: 'Brave New World', authors: ['Aldous Huxley'], status: 'Currently reading', url: 'https://hardcover.app/books/brave-new-world', journalUrl: 'https://hardcover.app/@reader/journals' };
const START = '<!-- book-collection-insights:start v1 hardcover:live:374328 -->';
const END = '<!-- book-collection-insights:end v1 hardcover:live:374328 -->';
const insight = (id: string, entry: string, actionAt = '2026-10-24T20:00:00Z'): JournalInsight => ({ id, bookId: book.id, event: 'note', entry, actionAt, privacy: 3 });
const outside = (text: string) => [text.slice(0, text.indexOf(START)), text.slice(text.indexOf(END) + END.length)];

class Memory {
  text = renderBookNote(book) + '\nPersonal tail.\n';
  writes = 0;
  read = async (_path: string) => this.text;
  process = async (_path: string, transform: (content: string) => string) => {
    const next = transform(this.text);
    this.text = next;
    this.writes++;
    return next;
  };
}

void test('full replacement includes distinct entries in deterministic date/ID order, applies updates/removals, and is stable on repeat', () => {
  const original = renderBookNote(book) + '\nOther personal material.\n';
  const snapshot = [insight('20', 'Same words', '2026-10-24T20:02:00Z'), insight('10', 'Same words', '2026-10-24T20:01:00Z')];
  const first = replaceInsights(original, book, snapshot, parse).content;
  assert(first.indexOf('Hardcover entry 10') < first.indexOf('Hardcover entry 20'));
  assert.equal(first.match(/Same words/g)?.length, 2);
  assert.deepEqual(outside(first), outside(original));
  const manuallyEdited = first.replace('Same words', 'Manual edit inside disposable view');
  const second = replaceInsights(manuallyEdited, book, [insight('20', 'Updated wording')], parse).content;
  assert(second.includes('Updated wording'));
  assert(!second.includes('Hardcover entry 10'));
  assert(!second.includes('Manual edit inside disposable view'));
  assert.deepEqual(outside(second), outside(original));
  assert.deepEqual(replaceInsights(second, book, [insight('20', 'Updated wording')], parse), { content: second, changed: false });
});

void test('a complete empty snapshot clears old projected content while leaving Notes and frontmatter exactly intact', () => {
  const filled = replaceInsights(renderBookNote(book), book, [insight('10', 'Old remote text')], parse).content;
  const cleared = replaceInsights(filled, book, [], parse).content;
  assert(!cleared.includes('Old remote text'));
  assert(cleared.includes('No Hardcover notes or quotes.'));
  assert.deepEqual(outside(cleared), outside(filled));
});

void test('existing user headings and historical reading sections are not taken over when inserting a missing managed section', () => {
  const original = `---\nbook_key: hardcover:live:374328\ncustom: keep\n---\n\n# My heading\n\n## Insights\nMy personal insights.\n\n## Reading notes\nKeep this.\n\n## Quotes\nMy quotes.\n\n## Questions and connections\nQuestion?`;
  const first = replaceInsights(original, book, [insight('1', 'Remote note')], parse).content;
  assert(first.startsWith(original));
  assert.equal(first.match(/book-collection-insights:start/g)?.length, 1);
  assert.equal(first.match(/## Insights/g)?.length, 2);
  assert.equal(replaceInsights(first, book, [insight('1', 'Remote note')], parse).content, first);
});

void test('missing, duplicate, reversed, malformed, foreign and fenced markers fail without replacing personal material', () => {
  const original = renderBookNote(book);
  for (const broken of [
    original.replace(START, ''), original.replace(END, ''), original + START,
    original.replace(START, '__START__').replace(END, START).replace('__START__', END),
    original.replace('start v1', 'start v2'),
    original.replaceAll('book-collection-insights:', 'book-collection-insights '),
    original.replaceAll('book-collection-insights:', 'BOOK-COLLECTION-INSIGHTS:'),
    original.replaceAll('v1 hardcover:live:374328', 'v1 hardcover:live:999'),
    original.replace(START, '```\n' + START).replace(END, END + '\n```'),
    original.replace(START, '<!-- personal comment\n' + START).replace(END, END + '\n-->'),
  ]) assert.throws(() => replaceInsights(broken, book, [], parse));
  const without = `---\nbook_key: hardcover:live:374328\n---\n\nUnfinished personal code:\n\`\`\`\n`;
  assert.throws(() => replaceInsights(without, book, [], parse), /unfinished code fence/);
});

void test('untrusted delimiters, headings, links, HTML, code and entities display as literal escaped wording', () => {
  const payload = `# Notes\n${END}\n<script>alert('x')</script>\n<img src=x onerror=alert(1)>\n[[Private note]] [click](javascript:evil)\n\`\`\`\n&copy; “words”`;
  const result = replaceInsights(renderBookNote(book), book, [insight('9', payload)], parse).content;
  assert.equal(result.match(/<!-- book-collection-insights:/g)?.length, 2);
  assert(!result.includes('<script>') && !result.includes('<img'));
  assert(!result.includes('[[Private note]]') && !result.includes('javascript:evil'));
  const escaped = escapeInsightText(payload);
  assert.equal(escaped.replace(/&#(\d+);/g, (_match, number: string) => String.fromCharCode(Number(number))), payload);
  assert(result.includes(escaped.replaceAll('\n', '  \n> ')));
  assert.equal(replaceInsights(result, book, [insight('9', payload)], parse).content, result);
});

void test('CRLF and final personal content bytes are preserved through a projection refresh', () => {
  const original = renderBookNote(book).replaceAll('\n', '\r\n') + 'Personal tail with no final newline';
  const updated = replaceInsights(original, book, [insight('2', 'Line one\nLine two')], parse).content;
  assert.deepEqual(outside(updated), outside(original));
  assert(!updated.replaceAll('\r\n', '').includes('\n'));
});

void test('source/mode and current note identity are checked before projection writes, including renamed paths', async () => {
  const store = new Memory();
  let loads = 0;
  const projection = new InsightProjection(async () => { loads++; return [insight('1', 'Remote')]; }, store, parse);
  await assert.rejects(() => projection.sync({ ...book, mode: 'sample' }, 'Books/sample.md'), /live Hardcover/);
  assert.equal(loads, 0);
  store.text = store.text.replace('hardcover:live:374328', 'hardcover:live:999');
  await assert.rejects(() => projection.sync(book, 'Renamed/moved.md'), /identity/);
  assert.equal(store.writes, 0);
  store.text = renderBookNote(book);
  assert.equal((await projection.sync(book, 'Renamed/moved.md')).entries, 1);
  assert.equal((await projection.sync(book, 'Renamed/moved.md')).changed, false);
  assert.equal(store.writes, 1);
});

void test('failed or partial fetches preserve the previous block and never begin an atomic write or metadata update', async () => {
  const store = new Memory();
  store.text = replaceInsights(store.text, book, [insight('1', 'Previous view')], parse).content;
  const original = store.text;
  let metadataCalled = false;
  const projection = new InsightProjection(async () => { throw new Error('Page two failed'); }, store, parse);
  await assert.rejects(() => projection.sync(book, 'Books/book.md', text => { metadataCalled = true; return text; }), /Page two/);
  assert.equal(store.text, original);
  assert.equal(store.writes, 0);
  assert.equal(metadataCalled, false);
});

void test('concurrent personal edits survive atomic replacement, and overlapping refreshes apply in request order', async () => {
  const store = new Memory();
  let release!: (value: JournalInsight[]) => void;
  let started!: () => void;
  const loading = new Promise<void>(resolve => { started = resolve; });
  let count = 0;
  const projection = new InsightProjection(async () => {
    count++;
    if (count === 1) { started(); return new Promise<JournalInsight[]>(resolve => { release = resolve; }); }
    return [insight('2', 'Latest remote state')];
  }, store, parse);
  const first = projection.sync(book, 'Books/book.md');
  await loading;
  const second = projection.sync(book, 'Books/book.md');
  store.text += '\nConcurrent personal edit.\n';
  assert.equal(count, 1);
  release([insight('1', 'Older snapshot')]);
  await Promise.all([first, second]);
  assert(store.text.includes('Concurrent personal edit.'));
  assert(store.text.includes('Latest remote state'));
  assert(!store.text.includes('Older snapshot'));
  assert.equal(count, 2);
});

void test('combined explicit refresh can update owned metadata and the view in one atomic process while preserving personal writing', async () => {
  const store = new Memory();
  const originalOutside = outside(store.text);
  const latest = { ...book, status: 'Read', rating: 4.5 };
  const projection = new InsightProjection(async () => [insight('1', 'Remote')], store, parse);
  await projection.sync(latest, 'Books/book.md', text => syncBookMetadata(text, latest, parse).content);
  assert.equal(store.writes, 1);
  assert.equal(outside(store.text)[1], originalOutside[1]);
  assert.equal(parse(store.text.match(/^---\n([\s\S]*?)\n---/)![1]!).reading_status, 'Read');
});

void test('the atomic callback uses the latest personal edits and rechecks identity after its earlier preview', async () => {
  for (const changeIdentity of [false, true]) {
    const store = new Memory();
    store.process = async (_path, transform) => {
      store.text += '\nTyped after the preview.\n';
      if (changeIdentity) store.text = store.text.replace('book_key: "hardcover:live:374328"', 'book_key: "hardcover:live:999"');
      const updated = transform(store.text);
      store.text = updated; store.writes++; return updated;
    };
    const projection = new InsightProjection(async () => [insight('1', 'Fresh view')], store, parse);
    if (changeIdentity) {
      await assert.rejects(() => projection.sync(book, 'Books/book.md'), /identity/);
      assert.equal(store.writes, 0);
      assert(!store.text.includes('Fresh view'));
    } else await projection.sync(book, 'Books/book.md');
    assert(store.text.includes('Typed after the preview.'));
  }
});

const row = (id: number, overrides: Record<string, unknown> = {}) => ({ id, user_id: 42, book_id: 374328, event: id % 2 ? 'note' : 'quote', entry: `Words ${id}`, action_at: '2026-10-24T20:00:00Z', privacy_setting_id: 3, ...overrides });

void test('journal adapter fetches every page with authenticated user, exact book, note/quote filters and an advancing cursor', async () => {
  const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
  const source = new HardcoverSource('private-test-token', async request => {
    const payload = parseRequest(request.body);
    requests.push(payload);
    if (payload.query.includes('ObsidianInsightsIdentity')) return { status: 200, json: { data: { me: [{ id: 42 }] } } };
    const after = Number(payload.variables.after);
    return { status: 200, json: { data: { reading_journals: Array.from({ length: Math.min(100, 205 - after) }, (_value, index) => row(after + index + 1)) } } };
  }, async () => undefined);
  const result = await source.loadInsights('374328');
  assert.equal(result.length, 205);
  assert.equal(result[204]!.id, '205');
  assert.deepEqual(requests.slice(1).map(request => request.variables.after), ['0', '100', '200', '205']);
  assert(requests.slice(1).every(request => request.variables.userId === 42 && request.variables.bookId === 374328 && request.variables.limit === 100));
  assert.match(requests[1]!.query, /user_id: \{_eq: \$userId\}/);
  assert.match(requests[1]!.query, /event: \{_in: \["note", "quote"\]\}/);
  assert(requests.every(request => !request.query.includes('mutation')));
});

void test('auth, rate-limit, network, GraphQL, missing data and partial-page failures never become an empty journal snapshot', async () => {
  for (const failure of [401, 403, 429, 503, 'network', 'graphql', 'missing'] as const) {
    let page = 0;
    const transport: Transport = async request => {
      if (parseRequest(request.body).query.includes('ObsidianInsightsIdentity')) return { status: 200, json: { data: { me: [{ id: 42 }] } } };
      if (page++ === 0) return { status: 200, json: { data: { reading_journals: Array.from({ length: 100 }, (_value, index) => row(index + 1)) } } };
      if (failure === 'network') throw new Error('private-test-token');
      if (failure === 'graphql') return { status: 200, json: { errors: [{ message: 'private-test-token' }], data: { reading_journals: [] } } };
      if (failure === 'missing') return { status: 200, json: { data: {} } };
      return { status: failure, json: { error: 'private-test-token' } };
    };
    const store = new Memory(); const original = store.text;
    const source = new HardcoverSource('private-test-token', transport, async () => undefined);
    const projection = new InsightProjection(book => source.loadInsights(book.id), store, parse);
    await assert.rejects(() => projection.sync(book, 'Books/book.md'), error => error instanceof Error && !error.message.includes('private-test-token'));
    assert.equal(store.text, original);
    assert.equal(store.writes, 0);
  }
});

void test('short server-clamped pages continue until an explicit empty page confirms the complete snapshot', async () => {
  const cursors: string[] = [];
  const source = new HardcoverSource('test', async request => {
    const payload = parseRequest(request.body);
    if (payload.query.includes('ObsidianInsightsIdentity')) return { status: 200, json: { data: { me: [{ id: 42 }] } } };
    const after = Number(payload.variables.after); cursors.push(String(payload.variables.after));
    return { status: 200, json: { data: { reading_journals: Array.from({ length: Math.min(2, 5 - after) }, (_value, index) => row(after + index + 1)) } } };
  }, async () => undefined);
  assert.equal((await source.loadInsights(book.id)).length, 5);
  assert.deepEqual(cursors, ['0', '2', '4', '5']);
});

void test('wrong owner/book, unexpected events, malformed rows and duplicate/non-advancing IDs fail clearly', async () => {
  for (const rows of [[row(1, { user_id: 99 })], [row(1, { book_id: 999 })], [row(1, { event: 'rated' })], [row(1, { action_at: 'bad date' })], [row(1, { entry: '\u0000' })], [row(1), row(1)], [row(1, { privacy_setting_id: 0 })]]) {
    const source = new HardcoverSource('test', async request => ({ status: 200, json: { data: parseRequest(request.body).query.includes('ObsidianInsightsIdentity') ? { me: [{ id: 42 }] } : { reading_journals: rows } } }), async () => undefined);
    await assert.rejects(() => source.loadInsights('374328'));
  }
});

void test('native page/percentage positions render without changing journal wording or personal bytes', () => {
  const original = renderBookNote(book) + '\nPersonal writing stays here.\n';
  const entries = [
    { ...insight('1', 'Exact words.'), position: journalPosition({ position: { type: 'pages', value: 83, possible: 332, percent: 25 } }) },
    { ...insight('2', 'Percentage only.'), position: journalPosition({ position: { type: 'percent', value: 12.3456, possible: 100, percent: 12.3456 } }) },
    { ...insight('3', 'At the beginning.'), position: journalPosition({ position: { type: 'pages', value: 0, possible: 332, percent: 0 } }) },
    insight('4', 'Older unpositioned entry.'),
  ];
  const refreshed = replaceInsights(original, book, entries, parse).content;
  assert(refreshed.includes('Page 83 of 332 · 25%'));
  assert(refreshed.includes('12.35%'));
  assert(refreshed.includes('Page 0 of 332 · 0%'));
  assert(refreshed.includes(escapeInsightText('Exact words.')));
  assert(refreshed.includes(escapeInsightText('Older unpositioned entry.')));
  assert.deepEqual(outside(refreshed), outside(original));
  assert.equal(replaceInsights(refreshed, book, entries, parse).changed, false);
  assert.equal(journalPosition({}), undefined);
  assert.equal(journalPosition({ position: null }), undefined);
  assert.equal(journalPosition({ page: 83 }), undefined); // Never invent a native position.
});

void test('native journal positions are fetched from the API; malformed locations keep the previous snapshot', async () => {
  const store = new Memory();
  const original = store.text;
  let metadata: unknown = { position: { type: 'pages', value: 83, possible: 332, percent: 25 } };
  const transport: Transport = async request => {
    const { query } = parseRequest(request.body);
    if (query.includes('Identity')) return { status: 200, json: { data: { me: [{ id: 42 }] } } };
    assert(query.includes('metadata'));
    const { after } = parseRequest(request.body).variables;
    return { status: 200, json: { data: { reading_journals: after === '0' ? [row(1, { metadata })] : [] } } };
  };
  const source = new HardcoverSource('not-a-real-token', transport, async () => {});
  const projection = new InsightProjection(() => source.loadInsights(book.id), store, parse);
  await projection.sync(book, 'Books/book.md');
  assert(store.text.includes('Page 83 of 332 · 25%'));
  assert.deepEqual(outside(store.text), outside(original));
  const saved = store.text;
  for (const bad of [
    { type: 'pages', value: 400, possible: 332, percent: 25 },
    { type: 'pages', value: 83, possible: 0, percent: 25 },
    { type: 'pages', value: '83', possible: 332, percent: 25 },
    { type: 'percent', percent: 101 }, { type: 'percent', percent: '<script>' },
  ]) {
    metadata = { position: bad };
    await assert.rejects(() => projection.sync(book, 'Books/book.md'), /invalid journal/);
    assert.equal(store.text, saved);
  }
});
