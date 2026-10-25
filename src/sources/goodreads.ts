import { vaultPath, type Book, type BookSource } from '../model';

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += character;
      }
    } else if (character === ',') {
      row.push(field);
      field = '';
      closedQuote = false;
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      field = '';
      closedQuote = false;
      if (character === '\r' && input[index + 1] === '\n') index++;
    } else if (character === '"' && field === '' && !closedQuote) {
      quoted = true;
    } else if (closedQuote) {
      throw new Error('Invalid CSV quoting. Import an unedited Goodreads library export.');
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV has an unfinished quoted field. Download the export again.');
  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

function isbnValue(value: string): string | undefined {
  const isbn = value.trim().replace(/^="(.*)"$/, '$1').replace(/[^\dXx]/g, '');
  return /^(\d{9}[\dXx]|\d{13})$/.test(isbn) ? isbn : undefined;
}

export function parseGoodreadsCsv(text: string): Book[] {
  const [headers, ...rows] = parseCsv(text);
  if (!headers || !['Book Id', 'Title', 'Author'].every(header => headers.includes(header))) {
    throw new Error('Expected a Goodreads CSV with Book Id, Title, and Author columns. Export it from My Books → Import and export.');
  }
  const books = new Map<string, Book>();
  for (const [index, row] of rows.entries()) {
    if (row.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns. Download the export again.`);
    const values = Object.fromEntries(headers.map((header, column) => [header, row[column]?.trim() ?? '']));
    const id = values['Book Id'] ?? '';
    const title = values.Title ?? '';
    if (!/^\d+$/.test(id) || !title) throw new Error(`CSV row ${index + 2} needs a numeric Book Id and a title.`);
    const rating = Number(values['My Rating']);
    const year = Number(values['Original Publication Year'] || values['Year Published']);
    const status = values['Exclusive Shelf'] || 'In collection';
    books.set(id, {
      id,
      title,
      source: 'goodreads',
      mode: 'csv',
      authors: [values.Author, ...(values['Additional Authors']?.split(',') ?? [])].filter((author): author is string => Boolean(author?.trim())).map(author => author.trim()),
      status: ({ 'to-read': 'Want to read', 'currently-reading': 'Currently reading', read: 'Read' } as Record<string, string>)[status] ?? status,
      rating: rating > 0 && rating <= 5 ? rating : undefined,
      year: Number.isInteger(year) && year !== 0 ? year : undefined,
      isbn: isbnValue(values.ISBN13 || values.ISBN || ''),
      url: `https://www.goodreads.com/book/show/${id}`,
    });
  }
  return [...books.values()];
}

export class GoodreadsCsvSource implements BookSource {
  readonly label = 'Goodreads · CSV library';

  constructor(private readonly path: string, private readonly read: (path: string) => Promise<string>) {}

  async loadBooks(): Promise<Book[]> {
    return parseGoodreadsCsv(await this.read(vaultPath(this.path)));
  }
}
