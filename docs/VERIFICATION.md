# Candidate verification — 25 October 2026

Version 0.6.0, plugin ID `book-collection`, minimum Obsidian 1.13.0.

## Passed locally

- TypeScript 5.9.3 strict type check.
- Official `eslint-plugin-obsidianmd` 0.4.2 recommended rules, using ESLint 10.13.0:
  zero errors and zero warnings, including manifest/license validation.
- All 42 functional tests: note identity and collision handling, Goodreads CSV,
  authenticated Hardcover reads, full cursor pagination (including clamped pages),
  privacy/location display, escaping, marker validation, failure preservation,
  atomic processing and concurrent personal-edit preservation.
- Production build, matching manifest/assets/version compatibility checks, and
  checks for accidental credentials, machine paths, maps, mutations or runtime
  MCP/Node imports in the three release assets.
- `npm audit --audit-level=low`: zero vulnerabilities in the complete locked tree.

## Native Obsidian smoke check

The built candidate loaded in the existing isolated test vault under Obsidian
1.14.4. It registered all ten declarative settings, loaded six explicit offline
sample books, and reopened an existing tracked book note without creating a
duplicate. Every Markdown file's SHA-256 remained identical. The prototype's
enabled state was restored afterward; the candidate was disabled.

The check made no network requests and used no real journal mutations or live
credentials. The main vault and its installed prototype were not changed.
Windows, Linux and mobile runtime tests remain unperformed.

## Official hosted review is pending

The signed-in Obsidian Community dashboard's **New plugin** form was inspected.
Before submission it requires the owner's agreement to Developer Policies and a
commitment to maintain the plugin (or remove/transfer it if support ends).
Neither checkbox was selected and **Submit** was not pressed. No directory entry
or official hosted review result has been created for this candidate.

The repository remains private. No tag or GitHub release was created. The normal
CI workflow may validate changes and retain private build artifacts, but contains
no release or community submission action. Local passes do not stand in for the
directory's full security/build scanner or final acceptance.
