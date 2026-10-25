import {
  App,
  FuzzySuggestModal,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  SecretComponent,
  SuggestModal,
  TFile,
  TFolder,
  requestUrl,
  parseYaml,
  type Editor,
  type FuzzyMatch,
  type SettingDefinitionItem,
} from 'obsidian';
import { bookKey, loadSettings, vaultPath, type Book, type BooksSettings, type BookSource, type SourceId } from './model';
import { BookNotes } from './notes';
import { syncBookMetadata } from './book-metadata';
import { InsightProjection } from './insights';
import { GoodreadsCsvSource } from './sources/goodreads';
import { HardcoverSource, HARDCOVER_SCOPES } from './sources/hardcover';
import { SampleSource } from './sources/sample';
import { bookNotePaths, requireBookFolderPath } from './book-folder';

export default class BookCollectionPlugin extends Plugin {
  declare settings: BooksSettings;
  private notes!: BookNotes;
  private insightProjection!: InsightProjection;
  private collection?: { fingerprint: string; promise: Promise<Book[]>; label: string };
  async onload(): Promise<void> {
    const stored: unknown = await this.loadData();
    this.settings = loadSettings(stored);
    if (stored && typeof stored === 'object' && ['mcpEnabled', 'mcpPort', 'mcpSecret'].some(key => key in stored)) await this.saveData(this.settings);
    this.notes = new BookNotes({
      findByKey: (key, folder) => {
        const matches = this.bookFiles(folder).filter(file => this.app.metadataCache.getFileCache(file)?.frontmatter?.book_key === key);
        if (matches.length > 1) throw new Error('More than one note has this book_key. Resolve the duplicate before syncing.');
        return matches[0]?.path;
      },
      exists: path => this.app.vault.getAbstractFileByPath(path) !== null,
      read: path => { requireBookFolderPath(path, this.settings.noteFolder); return this.app.vault.adapter.read(path); },
      ensureFolder: path => this.ensureFolder(path),
      create: async (path, content) => { requireBookFolderPath(path, this.settings.noteFolder); await this.app.vault.create(path, content); },
    });
    this.insightProjection = new InsightProjection(async book => {
      const source = this.source();
      if (!(source instanceof HardcoverSource)) throw new Error('Select your live Hardcover collection before refreshing insights.');
      const secretName = this.settings.hardcoverSecret;
      const folder = vaultPath(this.settings.noteFolder);
      const token = this.app.secretStorage.getSecret(secretName);
      const snapshot = await source.loadInsights(book.id);
      if (this.settings.source !== 'hardcover' || this.settings.hardcoverMode !== 'live' || this.settings.hardcoverSecret !== secretName || this.app.secretStorage.getSecret(secretName) !== token) throw new Error('The selected Hardcover account changed during refresh. The previous view was kept; refresh again.');
      if (vaultPath(this.settings.noteFolder) !== folder) throw new Error('The book notes folder changed during refresh. The previous view was kept; refresh again.');
      return snapshot;
    }, {
      read: path => { requireBookFolderPath(path, this.settings.noteFolder); return this.app.vault.adapter.read(path); },
      process: async (path, transform) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error('The tracked book note moved or is no longer available. Refresh again.');
        requireBookFolderPath(file.path, this.settings.noteFolder);
        return this.app.vault.process(file, content => {
          requireBookFolderPath(file.path, this.settings.noteFolder);
          return transform(content);
        });
      },
    }, yaml => parseYaml(yaml) as unknown);
    this.addCommand({
      id: 'open-book-note',
      name: 'Search collection and open book note',
      callback: () => this.run(() => this.openPicker()),
    });
    this.addCommand({
      id: 'insert-book-mention',
      name: 'Insert book mention',
      editorCallback: (editor, view) => this.run(() => this.openPicker({ editor, sourcePath: view.file?.path ?? '' })),
    });
    this.addCommand({
      id: 'switch-source',
      name: 'Choose collection source',
      callback: () => new SourcePicker(this.app, this).open(),
    });
    this.addCommand({
      id: 'sync-active-insights',
      name: 'Sync active book insights',
      callback: () => this.run(async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) throw new Error('Open a tracked live Hardcover book note first.');
        const result = await this.syncInsightsForNote(file);
        new Notice(`Book Collection: ${result.entries} insights loaded${result.changed ? '.' : '; the view is already current.'}`);
      }),
    });
    this.addCommand({
      id: 'refresh-collection',
      name: 'Refresh collection and sync tracked book notes',
      callback: () => this.run(async () => {
        const result = await this.refreshCollectionAndSync();
        new Notice(`Book Collection: ${result.total} books loaded; ${result.updated} notes updated; ${result.failed.length} sync errors.`);
      }),
    });
    this.addRibbonIcon('book-open', 'Search books', () => this.run(() => this.openPicker()));
    this.addSettingTab(new BooksSettingsTab(this.app, this));
  }

  async syncInsightsForNote(file: TFile) {
    requireBookFolderPath(file.path, this.settings.noteFolder);
    if (this.settings.source !== 'hardcover' || this.settings.hardcoverMode !== 'live') throw new Error('Select your live Hardcover collection before refreshing insights.');
    const content = await this.app.vault.read(file);
    const header = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const key: unknown = header ? (parseYaml(header) as Record<string, unknown>)?.book_key : undefined;
    if (typeof key !== 'string' || !/^hardcover:live:[1-9]\d*$/.test(key)) throw new Error('Open a tracked live Hardcover book note first.');
    const { books } = await this.getCollection();
    const book = books.find(item => bookKey(item) === key);
    if (!book) throw new Error('This book is not in the selected live collection. Refresh the collection before syncing its insights.');
    const path = await this.notes.find(book, this.settings.noteFolder);
    if (path !== file.path) throw new Error('The tracked note identity is ambiguous. Resolve it before refreshing insights.');
    return { book_key: key, path: file.path, ...await this.insightProjection.sync(book, file.path) };
  }

  private async syncNote(book: Book, path: string): Promise<boolean> {
    if (book.source !== 'hardcover' || book.mode !== 'live') return false;
    requireBookFolderPath(path, this.settings.noteFolder);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error('The tracked book note is no longer available.');
    const parse = (yaml: string) => parseYaml(yaml) as unknown;
    if (!syncBookMetadata(await this.app.vault.read(file), book, parse).changed) return false;
    let changed = false;
    await this.app.vault.process(file, content => {
      requireBookFolderPath(file.path, this.settings.noteFolder);
      const result = syncBookMetadata(content, book, parse);
      changed = result.changed;
      return result.content;
    });
    return changed;
  }

  async refreshCollectionAndSync() {
    this.collection = undefined;
    const { books } = await this.getCollection();
    let tracked = 0;
    let updated = 0;
    let insights = 0;
    const failed: Array<{ book_key: string; message: string }> = [];
    for (const book of books) {
      if (book.source !== 'hardcover' || book.mode !== 'live') continue;
      try {
        const path = await this.notes.find(book, this.settings.noteFolder);
        if (!path) continue;
        tracked++;
        const result = await this.insightProjection.sync(book, path, content => syncBookMetadata(content, book, yaml => parseYaml(yaml) as unknown).content);
        if (result.changed) updated++;
        insights += result.entries;
      } catch (error) {
        failed.push({ book_key: bookKey(book), message: error instanceof Error ? error.message : 'Tracked note sync failed.' });
      }
    }
    return { ok: !failed.length, total: books.length, tracked, updated, unchanged: tracked - updated, insights, failed };
  }

  async saveSettings(): Promise<void> {
    this.collection = undefined;
    await this.saveData(this.settings);
  }

  run(action: () => Promise<unknown>): void {
    void action().catch((error: unknown) => {
      new Notice(`Book Collection: ${error instanceof Error ? error.message : 'The action could not be completed.'}`, 9000);
    });
  }

  private source(): BookSource {
    if (this.settings.source === 'goodreads') {
      return this.settings.goodreadsMode === 'sample'
        ? new SampleSource('goodreads')
        : new GoodreadsCsvSource(this.settings.goodreadsCsvPath, async path => {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile)) throw new Error(`Add your Goodreads export at ${path}, or change its path in Book Collection settings.`);
          return this.app.vault.read(file);
        });
    }
    if (this.settings.hardcoverMode === 'sample') return new SampleSource('hardcover');
    const token = this.app.secretStorage.getSecret(this.settings.hardcoverSecret);
    if (!token) throw new Error('Add and select your Hardcover API token using the local secret selector in Book Collection settings.');
    return new HardcoverSource(token, async request => {
      const response = await requestUrl({ ...request, throw: false });
      let json: unknown;
      try { json = response.json; } catch { json = undefined; }
      return { status: response.status, json };
    });
  }

  private async getCollection(): Promise<{ books: Book[]; label: string }> {
    const fingerprint = JSON.stringify(this.settings);
    if (!this.collection || this.collection.fingerprint !== fingerprint) {
      const source = this.source();
      const loading = this.settings.source === 'hardcover' && this.settings.hardcoverMode === 'live'
        ? new Notice('Loading your Hardcover collection…', 0) : undefined;
      const promise = source.loadBooks().then(books => books.sort((first, second) => first.title.localeCompare(second.title)));
      const collection = { fingerprint, promise, label: source.label };
      this.collection = collection;
      void promise.catch(() => { if (this.collection === collection) this.collection = undefined; }).finally(() => loading?.hide());
    }
    const collection = this.collection;
    return { books: await collection.promise, label: collection.label };
  }

  async openPicker(mention?: { editor: Editor; sourcePath: string }): Promise<void> {
    const { books, label } = await this.getCollection();
    const existingKeys = new Set(this.bookFiles(this.settings.noteFolder).flatMap(file => {
      const key: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.book_key;
      return typeof key === 'string' ? [key] : [];
    }));
    new BookPicker(this.app, books, existingKeys, label, mention ? 'mention' : 'open', book => this.run(async () => {
      const note = await this.notes.ensure(book, this.settings.noteFolder);
      requireBookFolderPath(note.path, this.settings.noteFolder);
      try { await this.syncNote(book, note.path); }
      catch (error) { new Notice(`Book metadata was not synced: ${error instanceof Error ? error.message : 'Check the note frontmatter.'}`, 9000); }
      const file = this.app.vault.getAbstractFileByPath(note.path);
      if (!(file instanceof TFile)) throw new Error('The book note could not be opened. Try again.');
      if (mention) {
        mention.editor.replaceSelection(this.app.fileManager.generateMarkdownLink(file, mention.sourcePath, undefined, book.title));
        mention.editor.focus();
        if (note.created) new Notice('Book note created. Follow the link to add reading notes.');
      } else {
        await this.app.workspace.getLeaf(false).openFile(file);
        if (note.created) {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view?.editor) {
            const lines = view.editor.getValue().split('\n');
            const heading = lines.findIndex(line => /^## (Notes|Personal notes|Reading notes)$/.test(line));
            view.editor.setCursor({ line: heading + 2, ch: 0 });
            view.editor.focus();
          }
        }
      }
    })).open();
  }

  private async ensureFolder(path: string): Promise<void> {
    const segments = vaultPath(path).split('/');
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && !(existing instanceof TFolder)) throw new Error(`A file already exists at the book folder path ${current}.`);
      if (!existing) {
        try {
          await this.app.vault.createFolder(current);
        } catch (error) {
          if (!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder)) throw error;
        }
      }
    }
  }

  private bookFiles(folder: string): TFile[] {
    const paths = bookNotePaths(folder, path => {
      const node = this.app.vault.getAbstractFileByPath(path);
      if (!node) return [];
      if (!(node instanceof TFolder)) throw new Error('The book notes folder path points to a file. Choose a folder in settings.');
      return node.children.map(child => ({
        path: child.path,
        kind: child instanceof TFolder ? 'folder' : child instanceof TFile && child.extension.toLowerCase() === 'md' ? 'markdown' : 'other',
      }));
    });
    return paths.map(path => this.app.vault.getAbstractFileByPath(path)).filter((file): file is TFile => file instanceof TFile);
  }
}

class BookPicker extends FuzzySuggestModal<Book> {
  constructor(app: App, private readonly books: Book[], private readonly existingKeys: Set<string>, label: string, action: 'open' | 'mention', private readonly choose: (book: Book) => void) {
    super(app);
    this.modalEl.addClass('book-collection-picker');
    this.setPlaceholder('Search book title or author…');
    this.setInstructions([{ command: '↑ ↓', purpose: 'choose a book' }, { command: '↵', purpose: action === 'open' ? 'open reading note' : 'insert mention' }, { command: 'esc', purpose: 'close' }]);
    const context = this.modalEl.createDiv({ cls: 'book-collection-context', text: `${label} · ${books.length} books` });
    this.inputEl.parentElement?.after(context);
    this.emptyStateText = books.length ? 'No books match. Try another title or author.' : 'This collection is empty. Check Book Collection settings, then Refresh collection.';
  }

  getItems(): Book[] { return this.books; }

  getItemText(book: Book): string { return `${book.title} ${book.authors.join(' ')}`; }

  renderSuggestion(match: FuzzyMatch<Book>, element: HTMLElement): void {
    const book = match.item;
    const content = element.createDiv({ cls: 'suggestion-content' });
    content.createDiv({ cls: 'book-collection-title', text: book.title });
    const details = [book.authors.join(', ') || 'Unknown author', book.status, this.existingKeys.has(bookKey(book)) ? 'Open existing note' : 'Create note'];
    content.createDiv({ cls: 'book-collection-detail', text: details.join(' · ') });
  }

  onChooseItem(book: Book): void { this.choose(book); }
}

class SourcePicker extends SuggestModal<SourceId> {
  constructor(app: App, private readonly plugin: BookCollectionPlugin) {
    super(app);
    this.setPlaceholder('Choose a collection source…');
  }

  getSuggestions(query: string): SourceId[] {
    return (['hardcover', 'goodreads'] as const).filter(source => source.includes(query.toLowerCase()));
  }

  renderSuggestion(source: SourceId, element: HTMLElement): void {
    const mode = source === 'hardcover' ? this.plugin.settings.hardcoverMode : this.plugin.settings.goodreadsMode;
    element.setText(`${source === 'hardcover' ? 'Hardcover' : 'Goodreads'} · ${mode === 'sample' ? 'sample library' : mode === 'live' ? 'live library' : 'CSV library'}`);
  }

  onChooseSuggestion(source: SourceId): void {
    this.plugin.run(async () => {
      this.plugin.settings.source = source;
      await this.plugin.saveSettings();
      await this.plugin.openPicker();
    });
  }
}

class BooksSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: BookCollectionPlugin) { super(app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const hardcover = () => this.plugin.settings.source === 'hardcover';
    const goodreads = () => this.plugin.settings.source === 'goodreads';
    return [
      {
        name: 'Collection source',
        desc: 'Search Hardcover or an exported Goodreads library. Sample libraries work offline.',
        render: setting => { setting.addDropdown(dropdown => dropdown
          .addOptions({ hardcover: 'Hardcover', goodreads: 'Goodreads' })
          .setValue(this.plugin.settings.source)
          .onChange(value => this.plugin.run(async () => {
            this.plugin.settings.source = value as SourceId;
            await this.plugin.saveSettings();
            this.refreshDomState();
          }))); },
      },
      {
        name: 'Book notes folder',
        desc: 'Discovery and syncing stay within this folder and its subfolders. Notes moved outside it are no longer discovered.',
        render: setting => { setting.addText(text => text
          .setValue(this.plugin.settings.noteFolder)
          .onChange(value => this.plugin.run(async () => {
            this.plugin.settings.noteFolder = value.trim();
            await this.plugin.saveSettings();
          }))); },
      },
      {
        name: 'Hardcover library', visible: hardcover,
        render: setting => { setting.addDropdown(dropdown => dropdown
          .addOptions({ sample: 'Sample library', live: 'My live collection' })
          .setValue(this.plugin.settings.hardcoverMode)
          .onChange(value => this.plugin.run(async () => {
            this.plugin.settings.hardcoverMode = value as 'sample' | 'live';
            await this.plugin.saveSettings();
          }))); },
      },
      {
        name: 'Hardcover API secret', visible: hardcover,
        desc: `Select a native Obsidian secret with ${HARDCOVER_SCOPES}, read:journal. Only its name is saved in plugin settings.`,
        render: setting => { setting.addComponent(element => new SecretComponent(this.app, element)
          .setValue(this.plugin.settings.hardcoverSecret)
          .onChange(value => this.plugin.run(async () => {
            this.plugin.settings.hardcoverSecret = value ?? '';
            await this.plugin.saveSettings();
          }))); },
      },
      {
        name: 'Hardcover account settings', visible: hardcover,
        render: setting => { setting.descEl.createEl('a', { text: 'Open Hardcover API settings', href: 'https://hardcover.app/account/api' }); },
      },
      {
        name: 'Goodreads library', visible: goodreads,
        render: setting => { setting.addDropdown(dropdown => dropdown
          .addOptions({ sample: 'Sample library', csv: 'My exported CSV library' })
          .setValue(this.plugin.settings.goodreadsMode)
          .onChange(value => this.plugin.run(async () => {
            this.plugin.settings.goodreadsMode = value as 'sample' | 'csv';
            await this.plugin.saveSettings();
          }))); },
      },
      {
        name: 'Goodreads CSV path', visible: goodreads,
        desc: 'Export your Goodreads library, copy the CSV into this vault, then select its relative path. Export again when the collection changes.',
        render: setting => { setting.addText(text => text
          .setPlaceholder('Imports/goodreads_library_export.csv')
          .setValue(this.plugin.settings.goodreadsCsvPath)
          .onChange(value => this.plugin.run(async () => {
            this.plugin.settings.goodreadsCsvPath = value.trim();
            await this.plugin.saveSettings();
          }))); },
      },
      {
        name: 'Goodreads export', visible: goodreads,
        render: setting => { setting.descEl.createEl('a', { text: 'Open Goodreads import and export', href: 'https://www.goodreads.com/review/import' }); },
      },
      {
        name: 'Refresh and sync',
        desc: 'On demand: refresh tracked book metadata and replace the managed insights view. Personal writing stays unchanged.',
        render: setting => { setting.addButton(button => button.setButtonText('Refresh tracked notes').onClick(() => {
          this.plugin.run(async () => {
            const result = await this.plugin.refreshCollectionAndSync();
            new Notice(`Book Collection: ${result.updated} notes updated; ${result.failed.length} sync errors.`);
          });
        })); },
      },
      {
        name: 'Insights and personal writing',
        desc: 'The insights section is a regenerated view; edits inside its marked block are replaced, never uploaded. Keep personal writing outside it. Refresh runs only on demand.',
      },
    ];
  }
}
