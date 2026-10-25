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

Keep API tokens only in Obsidian's native secret storage. Never include personal
vaults, library exports, journals, local setup scripts, credentials, or machine
paths in Git or release assets. Fixtures must be synthetic or public book metadata.

Run `npm run verify` before committing. Keep all official Obsidian source checks
enabled. The user made this repository public and submitted a draft community
entry on 25 October 2026. Pushing fixes and running hosted preview scans are
authorized. Publishing the community listing remains deferred. Do not create a
public GitHub release merely to replace an available branch preview scan.
Do not replace an existing installed plugin ID automatically. The standalone ID
is `book-collection`; the earlier private prototype used `obsidian-books`.
