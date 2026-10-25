# Security

Do not include tokens, private journals, library exports, or vault contents in
issues, pull requests, screenshots, or logs.

For a sensitive vulnerability, use this repository's **Security → Report a
vulnerability** private reporting feature if enabled. If that option is unavailable,
contact the maintainer using the contact method on their GitHub profile before
disclosing details publicly. Include affected versions and a minimal reproduction
using synthetic data. Do not post an exploitable vulnerability in a public issue.

API tokens belong only in Obsidian's native secret storage. Insight refresh creates
a local copy of remote journal text; users must account for vault sync and sharing.
