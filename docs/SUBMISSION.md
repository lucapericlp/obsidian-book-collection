# Community submission readiness

This is a public-source release candidate. The owner submitted a draft
community-directory entry on 25 October 2026 and authorized publishing GitHub
release 0.6.0 for review while keeping the community listing in draft. Local checks remain preparation,
not a substitute for Obsidian's hosted scan. No public release, Git tag, or
community publication is created by any script.

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
- Book-note discovery and sync confined to the configured folder and its visible
  subfolders, as requested by the owner. No vault-wide file enumeration or cache
  enumeration. Notes outside that tree remain untouched and undiscovered.
- No automatic updates, telemetry, background polling, or outside-vault access.
- A CI gate that builds artifacts but has no publish/release permissions or steps.
- A separate main-branch-only CI job signs provenance for the three verified
  artifacts. Its only write permissions are OIDC identity and attestations;
  pull-request builds have no attestation job or release write permission.
- A new settings interface using the public 1.13 declarative API; minimum
  app version is raised to 1.13.0 accordingly. Desktop only until mobile is tested.

## Deliberately deferred

Only after the owner chooses to proceed:

1. Review the final plugin name, license, README and privacy disclosures.
2. Test the candidate on supported desktop platforms and establish mobile support
   separately before changing `isDesktopOnly`.
3. Repository source access and the initial draft submission are complete. Any
   future legal agreements or additional account grants remain owner-controlled.
4. Use **Review branch** on the draft to run Obsidian's hosted preview scan against
   the exact candidate commit, then record and fix its findings. This does not
   require a GitHub release. The local ESLint gate does not replicate every scan.
5. Keep the directory's **Publish** control untouched until explicitly authorized.
6. GitHub release 0.6.0 is published with the owner's authorization. For later
   release fixes, create a new tag exactly matching `manifest.version`
   (without `v`) and attach `dist/main.js`, `dist/manifest.json`, `dist/styles.css`
   to its GitHub release. Recheck asset/build correspondence.
7. Address all hosted release-review errors. Keep the community listing in draft
   and publish it only when the owner explicitly requests it.

For the eventual prototype migration, follow [MIGRATION.md](MIGRATION.md).
The original working vault and installed prototype are deliberately unchanged.

## Official references

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Manifest](https://docs.obsidian.md/Reference/Manifest)
- [Review FAQ and branch previews](https://docs.obsidian.md/community-directory/faq)
- [Official ESLint checker](https://github.com/obsidianmd/eslint-plugin)
