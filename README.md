# Book Collection

Turn books in your Hardcover or Goodreads library into linked notes in your vault.
Refresh Hardcover notes and quotes into a read-only **Insights** section, while
keeping your personal writing in **Notes**.

This is a release candidate, available from GitHub releases. Its Obsidian Community
entry is a draft under review; it is not yet published in the community directory.

## Features

- Search your collection by title or author to create or reopen a book note.
- Insert a link to a book from the editor.
- Refresh reading status, rating, and other managed book properties.
- Refresh the complete set of Hardcover journal notes and quotes on demand.
- Display dates, visibility, and available page or percentage positions.
- Preserve personal writing, unrelated frontmatter, and renamed notes within the
  configured book folder.
- Import an official Goodreads library CSV without signing into Goodreads.

## Set up Hardcover

1. Open **Settings → Book Collection** and select **Hardcover**.
2. In **Hardcover API secret**, use Obsidian's native secret selector to add your
   token from [Hardcover API settings](https://hardcover.app/account/api).
3. Choose **My live collection**, then refresh your collection.

A Hardcover account and API access are required for live Hardcover features.
Use a token with `read:me`, `read:library`, and `read:catalog`. Insight refresh also
needs `read:journal`. This plugin only reads; it does not need write permissions.
Hardcover controls API availability, account requirements, and rate limits.

Only the selected secret's name is saved in plugin settings. Tokens are held by
Obsidian's native secret storage, never in Markdown or ordinary plugin data.

## Set up Goodreads

Export your library from **Goodreads → My Books → Import and export**, copy the CSV
into your vault, then select **Goodreads → My exported CSV library** and set the
relative CSV path. Export again when your Goodreads library changes. Goodreads
offers collection import here; it does not supply journal insights through this plugin.

Both sources also have an explicit **Sample library** for trying book search
offline. Sample books have separate identities and never replace a failed live read.

## Use the plugin

Run these commands from Obsidian's command palette:

- **Search collection and open book note** creates or reopens one selected book.
- **Insert book mention** inserts a vault link at the editor's cursor.
- **Sync active book insights** refreshes the open tracked Hardcover book.
- **Refresh collection and sync tracked book notes** refreshes the collection and
  updates already tracked live Hardcover notes. It does not create a note for every book.

Configure the note folder in settings. Assign shortcuts in **Settings → Hotkeys**;
the plugin sets no default hotkeys. Opening a live book refreshes its metadata;
the Insights commands separately refresh its journal view.

Discovery and syncing are limited to the configured book folder and its visible
subfolders. Renaming or moving a note inside that tree preserves its identity.
Moving it outside the tree, or changing the configured folder, makes it
undiscoverable to the plugin. Move it back or select its containing folder before
syncing again. Selecting the same book while its old note is outside the folder
can create a new note inside the configured folder; the outside note is untouched.

### Insights and personal writing

Hardcover is the source of truth for journal insights. The plugin fetches every
page for the authenticated account and exact book before replacing its marked
Insights block. An incomplete or failed request leaves the previous view intact.
A successful empty snapshot shows that no notes or quotes exist.

**Edits inside the marked Insights block are replaced on refresh.** Put your own
writing outside that block, for example in **Notes**. Those bytes are preserved
and never uploaded. Metadata refresh separately updates only managed frontmatter
properties; it preserves unrelated properties, tags, and the note's path.

To capture or edit structured insights, use Hardcover itself or a separately
configured Hardcover client. No ChatGPT account, MCP server, cloud deployment,
or conversational integration is required by this plugin.

## Privacy and network use

- Live Hardcover reads go only to `https://api.hardcover.app/v1/graphql`, using
  your token to read account identity, library metadata, and book journals.
- Goodreads CSV imports and sample libraries run locally. Goodreads links open
  only when you choose them; importing a CSV makes no Goodreads API requests.
- Personal Notes, Markdown edits, and Goodreads reviews are not uploaded.
- The plugin has no analytics, telemetry, background polling, automatic updates,
  journal mutations, or filesystem access outside the vault.
- Book-note discovery inspects Markdown paths and cached `book_key` frontmatter
  only inside the configured book folder and its visible subfolders. It does not
  enumerate the vault root or request a vault-wide file/cache list. Paths and
  unrelated note contents are not uploaded. A Goodreads CSV is read only from its
  separately configured import path.
- No separate payment is collected by this plugin. Third-party services set
  their own account and API conditions.
- Private Hardcover insights are copied into your vault when you refresh them.
  Your vault's backup, sync, publishing, and sharing choices then apply to that copy.

Desktop support is declared for this first release candidate; mobile Obsidian
compatibility has not been verified. Minimum Obsidian version: **1.13.0**.

## Local development

Use Node.js 22.13 or newer and npm:

```sh
npm ci
npm run verify
```

Verification runs TypeScript checks, Obsidian's official ESLint rules, the test
suite, a production build, and release-asset checks. `npm run dev` rebuilds with
development source maps; production assets contain no source map.

For a disposable test vault, copy `dist/main.js`, `dist/manifest.json`, and
`dist/styles.css` into `<vault config directory>/plugins/book-collection/`, then
enable **Book Collection**. Never copy a real vault or API token into this repo.
Do not run the prototype `obsidian-books` and this standalone plugin together in
the same vault; see [migration notes](docs/MIGRATION.md).

See [submission readiness](docs/SUBMISSION.md) for the checks and remaining
user-controlled publication steps. The CI workflow only validates and uploads
build artifacts; it never tags, releases, publishes, or submits the plugin.
Successful builds of the main branch also produce GitHub artifact attestations.
These identify the workflow and source revision that built each asset. They use
short-lived GitHub workflow credentials, with no repository or release write
permission; pull-request builds cannot publish attestations.

## License and acknowledgments

MIT © Luca Peric. This is an independent integration, not an official Obsidian,
Hardcover, or Goodreads product. It uses Obsidian's public plugin API. Third-party
development dependencies retain their respective licenses; see
[dependency notes](docs/DEPENDENCIES.md).
