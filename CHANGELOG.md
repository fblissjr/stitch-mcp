# Changelog

## 0.6.0

### Added
- Getting Started tutorial (`docs/getting-started.md`): step-by-step guide for Claude Code, Claude Desktop (with cowork), and Google Antigravity, including proxy pros/cons and both bunx and local-clone setup paths.
- Virtual tools (`build_site`, `get_screen_code`, `get_screen_image`) are now exposed through the MCP proxy. Previously these were only accessible via the `tool` CLI command. Agents connected via the proxy can now call them directly.
- Startup validation: proxy now checks for `STITCH_API_KEY` before starting and prints actionable guidance to stderr when missing.
- Stderr-based startup logging: proxy reports connection status, discovered tools count, and errors to stderr (safe for stdio transport).

### Fixed
- Redundant ternary in MCP config handler for OpenCode: both branches returned `'opencode.json'`.

### Removed
- Dead `--transport` and `--port` CLI options on the `proxy` command. The `--transport sse` option was accepted by the Zod schema but never implemented. The `--port` option was parsed but ignored.

### Changed
- Proxy internals: replaced `StitchProxy` (from `@google/stitch-sdk`) with `CompositeStitchServer`, a custom MCP server that composes upstream Stitch tools with local virtual tools. The external behavior and MCP config format are unchanged.
