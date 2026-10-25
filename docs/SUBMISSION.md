# Community submission readiness

This is a private, unpublished release candidate. Local checks are preparation,
not an official approval or a claim that the Obsidian-hosted scan has passed.
No directory entry, public release, Git tag, or publication is created by any script.

## Repeatable local gate

Run `npm ci` followed by `npm run verify`. This checks the TypeScript application,
the official `eslint-plugin-obsidianmd` recommended configuration with zero
warnings permitted, the functional suite, a production build, and asset checks.
`npm audit` checks the full locked development dependency tree separately.

All recommended Obsidian rules remain enabled for source. Tests/build scripts are
allowed Node.js APIs; they are not plugin runtime code. Custom brand spellings are
declared for the sentence-case rule. The release checker requires matching package,
manifest and compatibility versions, the three expected artifacts, and no source
maps, machine paths, obvious PATs, journal mutations, or bundled MCP/Node imports.

## Prepared requirements

- A standalone repository with only the plugin, synthetic/public fixtures, tests,
  build tooling and public-facing documentation.
- A unique candidate ID `book-collection`, checked against the legacy community
  registry during preparation. The directory makes the final uniqueness decision.
- A short manifest description, author attribution, plain semantic version,
  explicit minimum app version, and `versions.json` compatibility mapping.
- An MIT license, account/network/privacy disclosures, and security guidance.
- Read-only direct Hardcover API access, explicit Goodreads CSV import, and no
  dependency on any personal MCP deployment.
- No automatic updates, telemetry, background polling, or outside-vault access.
- A CI gate that builds artifacts but has no publish/release permissions or steps.
- A new settings interface using the public 1.13 declarative API; minimum
  app version is raised to 1.13.0 accordingly. Desktop only until mobile is tested.

## Deliberately deferred

Only after the owner chooses to proceed:

1. Review the final plugin name, license, README and privacy disclosures.
2. Test the candidate on supported desktop platforms and establish mobile support
   separately before changing `isDesktopOnly`.
3. Make the repository accessible to Obsidian's reviewer. The documented submission
   flow requires GitHub source access. Do not assume a private repository can be
   scanned without an explicit supported authorization flow.
4. Sign into the Obsidian Community developer dashboard and link GitHub. The owner
   must handle any account creation, legal terms, or new account grants.
5. If available before publication, use **Review branch** to run Obsidian's hosted
   preview scan against the exact candidate commit, then record and fix its findings.
   The local ESLint gate does not replicate every hosted scan.
6. When authorized to release, create a tag exactly matching `manifest.version`
   (without `v`) and attach `dist/main.js`, `dist/manifest.json`, `dist/styles.css`
   to its GitHub release. Recheck asset/build correspondence.
7. Complete the directory submission, address all hosted errors, and publish only
   when the owner explicitly requests it.

For the eventual prototype migration, follow [MIGRATION.md](MIGRATION.md).
The original working vault and installed prototype are deliberately unchanged.

## Official references

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Manifest](https://docs.obsidian.md/Reference/Manifest)
- [Review FAQ and branch previews](https://docs.obsidian.md/community-directory/faq)
- [Official ESLint checker](https://github.com/obsidianmd/eslint-plugin)
