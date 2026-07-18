# Changelog

## 0.7.0

### Added
- Local proxy logging with graduated verbosity, composed over the upstream `lib/log` capture primitives:
  - Levels `off` / `minimal` / `full`. `minimal` (the default) writes one metadata-only line per tool call (tool, timing, ok/error) to `.stitch-mcp/log/metadata.jsonl` (a separate stream from the strict-schema `events.jsonl`); `full` captures args, results, and downloaded assets via the upstream `CaptureHandler`.
  - Seeded from `STITCH_MCP_LOG_LEVEL` (or the legacy `STITCH_MCP_LOG=1` toggle, which maps to `full`). Logs default to `<project-root>/.stitch-mcp/log` (resolved from the module location, independent of the launch directory); override with `STITCH_MCP_LOG_DIR`.
  - New `set_log_level` virtual tool to change verbosity at runtime from any MCP client.
  - Capture is best-effort: a logging failure never breaks a tool call and is reported once to stderr.

### Changed
- Synced with upstream v0.9.0 (upload command, cross-runtime fixes, `@google/stitch-sdk` 0.3.5, expanded asset-proxy allowlist, logging subsystem).
- Trimmed `GEMINI.md` to project-accurate Bun conventions, removing the generic web-app boilerplate that contradicted this project (Vite, `fs-extra`, `node:http`). Added `FORK.md` documenting every deviation this fork carries over upstream.
- The SSRF asset-proxy allowlist originally added by this fork is now upstream-owned; upstream's version is broader and supersedes ours.

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
