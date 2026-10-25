# Dependency notes

Runtime source uses Obsidian's public API and local project modules. There are no
production npm dependencies, dynamically downloaded modules, or bundled MCP SDK.
The `obsidian` module remains external to the bundle and is supplied by Obsidian.

Development uses TypeScript, esbuild, tsx, Node.js types, YAML for test parsing,
and Obsidian's official ESLint plugin and its dependencies. Their licenses remain
in npm's installed package metadata and are not replaced by this project's license.
`package-lock.json` pins the resolved dependency graph for reproducible installs.

The official ESLint package currently declares an exact Obsidian 1.8.7 peer despite
using newer API metadata internally. A narrow npm override aligns only that peer
with this project's pinned Obsidian type definitions. No ESLint source rules are
disabled for plugin source. Build scripts and tests are allowed Node.js APIs.

The project uses TypeScript 5.9, supported by the official checker's parser, for
both type checking and linting. No application runtime depends on the compiler.
