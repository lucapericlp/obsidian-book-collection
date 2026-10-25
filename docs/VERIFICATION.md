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

## Passed in private GitHub CI

[Verify plugin run 40185542521](https://github.com/lucapericlp/obsidian-book-collection/actions/runs/40185542521)
passed for source commit `cb92785f2b3423a1ddbd510cfcecf24ab9065e0c` on
Ubuntu with Node.js 22. The full `npm ci` and verification gate passed. Its
downloaded private artifact matches the local macOS build byte for byte:

| Asset | SHA-256 |
| --- | --- |
| `main.js` | `c5dc5368faed66e771e564cb80961918b3845af78a051f77f7689bd2667f7649` |
| `manifest.json` | `3c16775d78b7fe79dfb6ada9bd6f19c0468d5da8de4416b8c4202093340ab81d` |
| `styles.css` | `bfdf1a9ff59c993ed67a89e77f855834e7c8db3caaa74835e6a4402cd0a5cea3` |

CI building on Linux is not the same as testing inside the Linux Obsidian app.

## Native Obsidian smoke check

The built candidate loaded in the existing isolated test vault under Obsidian
1.14.4. It registered all ten declarative settings, loaded six explicit offline
sample books, and reopened an existing tracked book note without creating a
duplicate. Every Markdown file's SHA-256 remained identical. The prototype's
enabled state was restored afterward; the candidate was disabled.

The check made no network requests and used no real journal mutations or live
credentials. The main vault and its installed prototype were not changed.
Windows, Linux and mobile runtime tests remain unperformed.

## Initial hosted-review checkpoint

The signed-in Obsidian Community dashboard's **New plugin** form was inspected.
Before submission it requires the owner's agreement to Developer Policies and a
commitment to maintain the plugin (or remove/transfer it if support ends).
Neither checkbox was selected and **Submit** was not pressed. No directory entry
or official hosted review result has been created for this candidate.

At that initial checkpoint the repository was private. No tag or GitHub release was created. The normal
CI workflow may validate changes and retain private build artifacts, but contains
no release or community submission action. Local passes do not stand in for the
directory's full security/build scanner or final acceptance.

## Owner submission and hosted preview

Later on 25 October 2026, the owner made the repository public and submitted a
draft entry. Its [management page](https://community.obsidian.md/account/plugins/book-collection)
explicitly states that the entry is not yet visible to the public. **Review branch**
can run the hosted automated review without creating a release or publishing the
listing. A preview of commit `de711d80867a80174c92dfe7710d86c420330057` was requested;
the dependency check passed first while the remaining checks continued running.

The exact preview results live on that management page. Do not confuse a preview
scan with a published release review. At this checkpoint the missing-release
notice prevented release validation; it did not indicate a source-code failure.

## Authorized release review

The owner then explicitly authorized **GitHub releases only**, keeping the Obsidian
directory listing in draft. Release 0.6.0 was published from commit
`8ead8edcfbf6a1e9e1cbba4d91fef09e879f6be0`. Its three public download files were
checked against the verified local bytes. The tag points at that exact commit.

Obsidian's hosted release scan completed with **zero errors and zero warnings**.
It reported these passes:

- No suspicious network patterns.
- Vault read and vault write use Obsidian's API.
- No vulnerable dependencies.
- No code obfuscation.
- The scanner reproduced release `main.js` byte for byte.

Two recommendations were reported: GitHub artifact attestations, and vault-wide
Markdown metadata enumeration. Neither was an error or warning. The enumeration
supports finding tracked notes after moves/renames and does not upload paths or
unrelated file contents. Its purpose and scope are disclosed in the README.

## Build provenance and next candidate

Main-branch CI now creates GitHub attestations for all three verified assets.
[Run 40186898887](https://github.com/lucapericlp/obsidian-book-collection/actions/runs/40186898887)
passed verification and the separate attestation job. `gh attestation verify`
successfully verified `main.js`, `manifest.json`, and `styles.css` against this
repository; their digests matched the already published 0.6.0 files.

The dashboard does not rerun a completed release when **Check for new releases**
is selected again. Candidate 0.6.1 therefore incorporates the provenance workflow
before release review. No runtime book or journal behavior is changed by that
candidate. The directory's **Publish** control remains untouched.

Release 0.6.1 was built and attested by
[run 40187132515](https://github.com/lucapericlp/obsidian-book-collection/actions/runs/40187132515)
from `87cf4b2a968a9f94c3cff0eb26592996cb7890c7`. All three local assets passed
`gh attestation verify` constrained to that exact source digest, this repository's
`verify.yml` signer workflow, and GitHub-hosted runners. The published tag and
release target match the verified commit. Asset digests are:

- `main.js`: `c5dc5368faed66e771e564cb80961918b3845af78a051f77f7689bd2667f7649`
- `manifest.json`: `0119e88153b5adb23ef1e8302fac55db2961f9142b6782fd31e86779b0d57872`
- `styles.css`: `bfdf1a9ff59c993ed67a89e77f855834e7c8db3caaa74835e6a4402cd0a5cea3`

Moved-note support is preserved while the vault-enumeration recommendation is
assessed. Removing discovery by merely switching to another enumeration API would
not reduce access, and restricting it to one folder would change existing moved-
note behavior. No workaround was used to hide that capability from the scanner.

## Final hosted result for 0.6.1

The [Obsidian management dashboard](https://community.obsidian.md/account/plugins/book-collection)
shows **Completed** for release **0.6.1**, commit `87cf4b2`, with **zero errors,
zero warnings, eight Pass results, and one Recommendation**:

| Check | Hosted result |
| --- | --- |
| `main.js` GitHub artifact attestation | Pass |
| `styles.css` GitHub artifact attestation | Pass |
| Network patterns | Pass |
| Vault reads through Obsidian API | Pass |
| Vault writes through Obsidian API | Pass |
| Dependency vulnerabilities | Pass |
| Code obfuscation | Pass |
| Byte-for-byte reproduction of release `main.js` | Pass |
| Vault-wide Markdown metadata enumeration | Recommendation |

The enumeration advisory is retained to preserve existing moved/renamed book-note
discovery, consistent with the established design, and its local-only scope is
documented in README. It is not a failed check. A folder-only alternative would
change that behavior; it was offered as a product choice, not silently applied.

The dashboard still explicitly states that this entry is in **draft mode and not
yet visible to the public**. Its **Publish** control was not used. GitHub release
assets are public under the owner's separate authorization; community publication
remains deferred. The original main vault and its installed prototype are unchanged.

## 0.6.2: owner-selected folder-only discovery

The owner explicitly chose to limit discovery to the configured book folder,
superseding the retained 0.6.1 advisory decision. The plugin now starts at that
folder via `getAbstractFileByPath` and walks only its visible descendants. It never
requests a vault-wide file list, root listing, or cache listing. Hidden folders,
sibling prefixes, traversal paths, and malformed child listings are excluded or
rejected. A missing folder returns an empty discovery set without broadening scope.

The picker, note lookup, metadata sync, and insight sync share this boundary.
An active book note outside the configured tree is rejected before file reads or
network requests. Indexed results are checked again before reopening. Folder
changes during insight fetching keep the old snapshot; concurrent selections for
different folders cannot reuse an older folder's pending result.

Renames/moves inside the configured tree keep stable book identity. Notes outside
it are not discovered or modified. Selecting the same book can create a new note
inside the selected folder; README and migration guidance describe this tradeoff.

All **49 tests** pass, including seven new boundary/concurrency regressions. Strict
type checking, official lint rules with zero warnings, the build, and asset checks
pass. Asset checks also reject vault-wide listing calls in the production bundle.

Native Obsidian 1.14.4 verification in the isolated test vault used a plugin-only
proxy that throws on vault-wide listing APIs and any out-of-folder path/cache
lookup. It discovered four book notes, reopened the existing in-folder book note,
and rejected an outside active note. It made no network requests and preserved
every Markdown file's SHA-256. The prototype's enabled state was restored; no main
vault installation was changed. The hosted 0.6.2 result is recorded below when
available; earlier release results remain historical.

### Completed hosted result for 0.6.2

The dashboard shows **Completed** for release **0.6.2**, source commit
`66b0015f6083752db75c00a4bba287567367f92d`, with **8 Pass results, 0 errors,
0 warnings, and 0 recommendations**. The prior vault-enumeration advisory is gone.
The eight passes cover both release-asset attestations, network behavior, vault
reads, vault writes, dependencies, code obfuscation, and byte-for-byte build
reproduction. The listing still explicitly states that it is a **draft and not
yet visible to the public**; its Publish control was not used.

[GitHub CI run 40194065483](https://github.com/lucapericlp/obsidian-book-collection/actions/runs/40194065483)
passed the complete verification gate and attested the assets. Each asset passed
`gh attestation verify` constrained to the exact source commit, this repository's
`verify.yml` signer, and GitHub-hosted runners. The public release downloads were
also compared byte for byte against the verified local build:

- `main.js`: `02bae7efc8e4b890e32d7172ec157efad240dd01e481009867097e95e60ed610`
- `manifest.json`: `70d3004fa2a6104662437cc9a8864cee080e70c25a1aeb4ec725f0d0b7795ce0`
- `styles.css`: `bfdf1a9ff59c993ed67a89e77f855834e7c8db3caaa74835e6a4402cd0a5cea3`
