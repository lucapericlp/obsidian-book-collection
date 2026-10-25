# Book Collection

The plugin reads Hardcover's official API directly. Hardcover journals own
structured insights; the plugin never creates, edits, deletes, or uploads them.
Do not embed an MCP server, gateway, journal database, scheduler, or cloud account
configuration. Conversational capture is separate and not required to use this plugin.

Fetch the complete authenticated user's book-specific snapshot before replacing
one uniquely delimited Insights block atomically. Keep the previous view on any
failure or partial fetch. Escape remote text; preserve every byte outside that
block, including personal Notes. Only explicit metadata sync may update owned
frontmatter fields. Preserve paths and source/mode/book identity.

The user chose folder-only discovery. Start at the configured book notes folder
and inspect only that folder and its visible subfolders. Never enumerate the
vault root, vault-wide Markdown files, or all cached files. Do not discover,
reopen, or sync a book note outside the configured folder. Renames/moves inside
the folder retain stable identity; outside notes remain untouched and undiscovered.

Keep API tokens only in Obsidian's native secret storage. Never include personal
vaults, library exports, journals, local setup scripts, credentials, or machine
paths in Git or release assets. Fixtures must be synthetic or public book metadata.

Run `npm run verify` before committing. Keep all official Obsidian source checks
enabled. The user made this repository public and submitted a draft community
entry on 25 October 2026. Pushing fixes and running hosted preview scans are
authorized. The user subsequently authorized publishing GitHub release assets
needed for the release review, while explicitly keeping the Obsidian listing in
draft. Publishing the community listing remains deferred.
Do not replace an existing installed plugin ID automatically. The standalone ID
is `book-collection`; the earlier private prototype used `obsidian-books`.
