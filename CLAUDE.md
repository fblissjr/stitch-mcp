# CLAUDE.md

See also: `GEMINI.md` for Bun tooling conventions (runtime, test runner, package manager, build) and `FORK.md` for the ledger of deviations this fork carries over upstream.

## Project Overview

stitch-mcp is a TypeScript CLI + MCP server for Google Stitch. It handles Google Cloud auth, generates MCP client configs, previews Stitch designs locally, and builds Astro static sites from screen mappings.

This is a private downstream fork of the upstream project (Google, PM-owned). We track upstream and keep our deviations isolated and documented in `FORK.md`; we do not routinely PR changes upstream.

## Tooling

- **Runtime**: Bun (per GEMINI.md)
- **Tests**: `bun test` with `bun:test` module. Tests live in `tests/` (main suite) and co-located `*.test.ts` files. Preload: `tests/setup.ts`
- **Packages**: `bun install` / `bun add`
- **Build**: `bun run build` (scripts/build.ts + tsc)
- **No linter/formatter configured** -- no eslint, biome, or prettier

### Stack notes (don't apply generic Bun boilerplate)

- Uses **Vite** for the local dev server (`StitchViteServer`) -- intentional. Not `Bun.serve()`.
- Uses **`fs-extra`** for filesystem work, not `node:fs` readFile/writeFile or `Bun.file`.
- Uses **Vite's built-in server + Node's `http.createServer`** for HTTP, not express or `Bun.serve()`.

## Architecture

```
src/
  cli.ts              -- Entry point (Commander.js)
  commands/            -- CLI commands (init, doctor, serve, site, tool, proxy, etc.)
    proxy/               -- MCP proxy server (CompositeStitchServer)
    tool/virtual-tools/  -- MCP virtual tools (build_site, get_screen_code, get_screen_image)
  services/            -- Business logic (gcloud, stitch SDK, mcp-config, project)
  lib/server/          -- AssetGateway (caching proxy), Vite plugin, HTML server
  lib/services/site/   -- Astro site generation (SiteService)
  framework/           -- Step runner, command definitions, UI abstractions
  ui/                  -- Ink (React) terminal UI components
  platform/            -- Environment detection, shell, browser utils
```

### Proxy architecture

The MCP proxy (`src/commands/proxy/`) uses `CompositeStitchServer` instead of the SDK's `StitchProxy`. This is intentional -- `StitchProxy` only exposes upstream Stitch tools. `CompositeStitchServer` creates its own `McpServer`, forwards upstream tool calls to the Stitch API via JSON-RPC, and registers the virtual tools (`build_site`, `get_screen_code`, `get_screen_image`) as first-class MCP tools alongside the remote ones. Remote tools are cached with a 30-second TTL to avoid re-fetching on every `tools/list`.

### Proxy request logging

`CompositeStitchServer` records each `tools/call` to a local log, gated by a runtime verbosity level (`src/lib/log/level.ts`): `off` / `minimal` / `full`.

- `minimal` (default) appends one metadata-only `call.metadata` line per call (tool, timing, ok/error) to `.stitch-mcp/log/metadata.jsonl` -- no args, results, or blobs. This is a **separate stream** from `events.jsonl` so it never mixes with the strict `EventSchema` (call.requested/completed/failed) that `full` capture and the log tooling parse.
- `full` delegates to the upstream `CaptureHandler` (args + results + content-addressed blobs, written to `events.jsonl` + `blobs/`).
- The logger (`src/lib/log/proxy-logger.ts`) is a **composition layer over upstream's `lib/log` primitives** (`appendEvent`, `createCaptureHandler`) -- keep it that way so upstream improvements flow through. It is best-effort and fire-and-forget: capture never blocks or breaks a tool call, and warns to stderr once on failure.
- Level is seeded from `STITCH_MCP_LOG_LEVEL` (or legacy `STITCH_MCP_LOG=1` -> `full`); dir overridable via `STITCH_MCP_LOG_DIR`. Runtime changes go through the `set_log_level` virtual tool, which is intentionally agent-callable (any connected MCP client can change verbosity) -- note this also means the model can escalate what gets persisted to disk.

### Stitch SDK constraints

- `StitchProxy` is sealed: all members are private, `setupHandlers()` is private, no extension points. Do not attempt to subclass or monkey-patch it -- use `CompositeStitchServer` instead.
- `forwardToStitch`, `refreshTools`, and `initializeStitchConnection` are exported from the SDK's `proxy/index.ts` barrel but NOT from the main package index, and there is no `"./proxy"` subpath export. No stable import path exists -- we reimplement the JSON-RPC forwarding locally.
- `VirtualTool.execute` takes `(client: StitchToolClient, args, stitch?)` but current implementations only use `stitch`. The proxy passes `null` for `client`. Known design debt.

## Key Conventions

- **Imports**: Relative paths with `.js` extensions (ESM + bundler moduleResolution)
- **Mocking**: `mock()` and `spyOn()` from `bun:test`. Global fetch mocked via `globalThis.fetch = mock(...)`. Stitch SDK mocked via `MockStitchSDK.ts`
- **Dependency injection**: Command handlers accept an optional `deps` object for testing (e.g., `ProxyCommandHandler({ createServer, createTransport })`). Follow this pattern -- don't spy on module internals.
- **TypeScript**: Strict mode, ESNext target, no emit. `allowImportingTsExtensions: true`
- **CLI**: Commander.js with dynamic command loading from `src/commands/*/command.ts`
- **UI**: Ink (React for terminal) with step-based wizard pattern (`StepRunner`)
- **Auth**: Two modes -- OAuth (gcloud) and API key (`STITCH_API_KEY` env var)
- **Proxy logging**: All proxy log output uses `console.error` (stderr). This is mandatory -- stdout is reserved for MCP JSON-RPC messages over stdio transport. The `[stitch-mcp]` prefix is the convention.
- **URL validation**: `getStitchUrl()` in `services/stitch/connection.ts` is the shared STITCH_HOST validator. Reuse it instead of hardcoding the URL or writing new validation.

## Security

The guards below are a mix of upstream-provided and fork-local hardening. See `FORK.md` for which are ours. When touching this code, preserve them:

- `AssetGateway.fetchAsset()` has an HTTPS-only hostname allowlist (`ALLOWED_HOST_PATTERNS`) -- currently `*.googleapis.com`, `*.googleusercontent.com`, `*.gstatic.com`, `cdnjs.cloudflare.com`, `cdn.tailwindcss.com`, `images.unsplash.com`, `cdn.jsdelivr.net`, `unpkg.com`. This allowlist is now upstream-owned (upstream adopted the SSRF guard our fork originally added). Do not bypass or weaken it; check the source for the current patterns before editing.
- `SiteService.generateSite()` validates output paths stay within the pages directory. Do not remove the traversal guard. (fork-local)
- `get-screen-image.ts` checks `response.ok` before processing image data. Follow this pattern for any new fetch calls. (fork-local)
- CSP headers are applied via `buildCspResponse()` in `lib/server/csp.ts` -- used by both the Vite plugin and `serveHtmlInMemory`. Update the shared helper, not individual call sites. (fork-local)
- `STITCH_HOST` is validated: must be `https:` and hostname must end with `.googleapis.com`. Invalid values are ignored and the default endpoint is used. (fork-local)
- File writes containing credentials must use `mode: 0o600`. Both `AuthModeStep.ts` (`.env` file) and `ConfigStep.ts` (Gemini extension JSON) demonstrate this pattern.
- Shell commands use `shell: false` on non-Windows. Do not switch to `shell: true`.

## Running Tests

```bash
bun test                    # Full suite (~594 pass + security tests)
bun test tests/security/    # Security regression tests only
bun test src/lib/server/    # Co-located tests for a specific module
```
