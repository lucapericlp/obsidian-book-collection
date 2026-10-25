import type { Book, BookSource, SourceId } from '../model';

const SAMPLE_BOOKS = [
  { id: 'sample-brave-new-world', title: 'Brave New World', authors: ['Aldous Huxley'], status: 'Currently reading', year: 1932 },
  { id: 'sample-piranesi', title: 'Piranesi', authors: ['Susanna Clarke'], status: 'Currently reading', year: 2020 },
  { id: 'sample-left-hand', title: 'The Left Hand of Darkness', authors: ['Ursula K. Le Guin'], status: 'Read', rating: 5, year: 1969 },
  { id: 'sample-invisible-cities', title: 'Invisible Cities', authors: ['Italo Calvino'], status: 'Want to read', year: 1972 },
  { id: 'sample-middlemarch', title: 'Middlemarch', authors: ['George Eliot'], status: 'Want to read', year: 1871 },
  { id: 'sample-frankenstein', title: 'Frankenstein', authors: ['Mary Shelley'], status: 'Read', rating: 4, year: 1818 },
];

export class SampleSource implements BookSource {
  readonly label: string;

  constructor(private readonly source: SourceId) {
    this.label = `${source === 'hardcover' ? 'Hardcover' : 'Goodreads'} · sample library`;
  }

  async loadBooks(): Promise<Book[]> {
    return SAMPLE_BOOKS.map(book => ({ ...book, authors: [...book.authors], source: this.source, mode: 'sample' }));
  }
}
