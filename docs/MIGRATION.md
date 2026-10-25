# From the private prototype

The earlier private prototype used plugin ID `obsidian-books`. Community plugin
IDs cannot contain `obsidian`, so this standalone candidate uses `book-collection`.
Its display name remains **Book Collection**. No installed main vault is modified
by extracting or building this repository.

The new ID changes the plugin's installation directory and command prefixes. It
does not change book identities such as `hardcover:live:<work-id>`, note paths,
the Insights ownership markers, or the meaning of existing personal writing.

For an eventual migration, make a vault backup, disable the prototype, and install
the new candidate. Copy only the prototype's plugin settings into the new plugin
directory, then select the same existing native secret through Obsidian. Reassign
hotkeys to the new command IDs. Do not copy credential values or run both plugins
at the same time. Verify the chosen source, live/sample mode, CSV path, and notes
folder before refreshing anything.

The new plugin will reopen tracked notes by their existing `book_key`. It does not
rename notes or automatically rewrite the old plugin configuration. Existing
Hardcover journal entries stay remote and are never re-created during migration.
