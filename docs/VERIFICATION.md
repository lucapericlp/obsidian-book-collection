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
