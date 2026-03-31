# CLAUDE.md

See also: `GEMINI.md` for Bun tooling conventions (runtime, test runner, package manager). Note that GEMINI.md contains generic Bun guidance that conflicts with this project in places -- the clarifications below take precedence.

## Project Overview

stitch-mcp is a TypeScript CLI + MCP server for Google Stitch. It handles Google Cloud auth, generates MCP client configs, previews Stitch designs locally, and builds Astro static sites from screen mappings.

## Tooling

- **Runtime**: Bun (per GEMINI.md)
- **Tests**: `bun test` with `bun:test` module. Tests live in `tests/` (main suite) and co-located `*.test.ts` files. Preload: `tests/setup.ts`
- **Packages**: `bun install` / `bun add`
- **Build**: `bun run build` (scripts/build.ts + tsc)
- **No linter/formatter configured** -- no eslint, biome, or prettier

### Where GEMINI.md is wrong for this project

- GEMINI.md says "don't use vite" -- this project uses Vite for the local dev server (`StitchViteServer`). That's intentional.
- GEMINI.md says "prefer `Bun.file` over `node:fs`" -- this project uses `fs-extra` throughout. Don't migrate unless there's a reason.
- GEMINI.md says "don't use `express`" -- the project uses neither express nor `Bun.serve()`. It uses Vite's built-in server and Node's `http.createServer`.

## Architecture

```
src/
  cli.ts              -- Entry point (Commander.js)
  commands/            -- CLI commands (init, doctor, serve, site, tool, proxy, etc.)
    tool/virtual-tools/  -- MCP virtual tools (build_site, get_screen_code, get_screen_image)
  services/            -- Business logic (gcloud, stitch SDK, mcp-config, project)
  lib/server/          -- AssetGateway (caching proxy), Vite plugin, HTML server
  lib/services/site/   -- Astro site generation (SiteService)
  framework/           -- Step runner, command definitions, UI abstractions
  ui/                  -- Ink (React) terminal UI components
  platform/            -- Environment detection, shell, browser utils
```

## Key Conventions

- **Imports**: Relative paths with `.js` extensions (ESM + bundler moduleResolution)
- **Mocking**: `mock()` and `spyOn()` from `bun:test`. Global fetch mocked via `globalThis.fetch = mock(...)`. Stitch SDK mocked via `MockStitchSDK.ts`
- **TypeScript**: Strict mode, ESNext target, no emit. `allowImportingTsExtensions: true`
- **CLI**: Commander.js with dynamic command loading from `src/commands/*/command.ts`
- **UI**: Ink (React for terminal) with step-based wizard pattern (`StepRunner`)
- **Auth**: Two modes -- OAuth (gcloud) and API key (`STITCH_API_KEY` env var)

## Security

URL validation and input sanitization are ongoing work in this fork:

- `AssetGateway.fetchAsset()` has an HTTPS-only URL allowlist -- only permits known Google/CDN domains (`*.googleapis.com`, `*.googleusercontent.com`, `*.gstatic.com`, `cdnjs.cloudflare.com`). Do not bypass or weaken this.
- `SiteService.generateSite()` validates output paths stay within the pages directory. Do not remove the traversal guard.
- `get-screen-image.ts` checks `response.ok` before processing image data. Follow this pattern for any new fetch calls.
- CSP headers are applied via `buildCspResponse()` in `lib/server/csp.ts` -- used by both the Vite plugin and `serveHtmlInMemory`. Update the shared helper, not individual call sites.
- `STITCH_HOST` is validated: must be `https:` and hostname must end with `.googleapis.com`. Invalid values are ignored and the default endpoint is used.
- File writes containing credentials must use `mode: 0o600`. Both `AuthModeStep.ts` (`.env` file) and `ConfigStep.ts` (Gemini extension JSON) demonstrate this pattern.
- Shell commands use `shell: false` on non-Windows. Do not switch to `shell: true`.

## Running Tests

```bash
bun test                    # Full suite (~467 tests + security tests)
bun test tests/security/    # Security regression tests only
bun test src/lib/server/    # Co-located tests for a specific module
```
