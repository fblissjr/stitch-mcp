# FORK.md

This is a **private downstream fork** of the upstream `stitch-mcp` project (Google, PM-owned). We track upstream and do not routinely PR changes back.

## Sync strategy

- **Track, don't contribute.** We merge upstream regularly; we open PRs upstream only if something is obviously worth it (rare).
- **Minimize the deviation surface.** Isolate fork-only work in *new* files; keep edits to upstream-owned files to a minimum (each changed line is a future merge conflict).
- **Drop deviations upstream adopts.** If upstream ships an equivalent, delete ours. (Already happened once -- see the AssetGateway note below.)
- **Merge, don't rebase.** `origin/main` is published; rebasing would rewrite shared history.

### Sync procedure

```bash
git fetch upstream
git merge upstream/main        # resolve conflicts (historically only src/commands/proxy/handler.ts)
bun install                    # reconcile node_modules when the merge bumps deps (e.g. the SDK)
bun test                       # expect 0 fail
bun run build                  # confirm the build/typecheck still passes
git push origin main           # when ready
```

Note: a merge that bumps a dependency in `package.json`/`bun.lock` does **not** update `node_modules` on its own. Always `bun install` after merging, or `tsc`/`bun run build` will fail against stale installed types (the `@google/stitch-sdk` 0.3.5 sync tripped this once).

## Deviations we carry

### Architectural (permanent)

- **MCP proxy uses `CompositeStitchServer`, not the SDK's `StitchProxy`.**
  Files: `src/commands/proxy/composite-server.ts` (+ test), `handler.ts`, `command.ts`, `spec.ts`.
  Why: `StitchProxy` only exposes remote Stitch tools and is sealed (no extension points). `CompositeStitchServer` composes the remote tools with our local virtual tools (`build_site`, `get_screen_code`, `get_screen_image`, `set_log_level`). This is the reason the fork exists. See CLAUDE.md > Proxy architecture.
  Merge note: `handler.ts` is the one edited upstream-owned file, so it's the recurring conflict point. Keep the edit minimal.

- **Local proxy logging with graduated verbosity.**
  Files: `src/lib/log/level.ts`, `src/lib/log/proxy-logger.ts`, `src/commands/tool/virtual-tools/set-log-level.ts` (+ tests); one-line wiring in `composite-server.ts` and one entry in `virtual-tools/index.ts`.
  Why: keep lightweight local metadata by default, controllable at runtime. Built as a thin **composition over upstream's `lib/log`** (`appendEvent`, `createCaptureHandler`) so upstream improvements flow through. `minimal` is the default; `full` reuses upstream's `CaptureHandler`. See CLAUDE.md > Proxy request logging.

### Security hardening (permanent-local; upstream lacks these)

- `getStitchUrl()` STITCH_HOST validation (https + `*.googleapis.com`) -- `src/services/stitch/connection.ts`.
- `buildCspResponse()` shared CSP helper + CSP applied on the Vite dev-server path -- `src/lib/server/csp.ts`, `virtualContent.ts`, `serve-behaviors/server.ts`. (Upstream applies CSP inline in `serveHtmlInMemory` only; not on the Vite path.)
- `get-screen-image.ts` `response.ok` guard before processing image data.
- `SiteService.generateSite()` path-traversal guard (resolved path must stay under `src/pages`).
- `ConfigStep.ts` writes the Gemini extension JSON with `mode: 0o600`.

### Docs / tooling

- `CLAUDE.md`, this `FORK.md`, `docs/getting-started.md`, `docs/index.md`, `README.md`, `CHANGELOG.md`.
- `GEMINI.md` trimmed to project-accurate Bun conventions (removed generic web-app boilerplate that contradicted the project).
- `.gitignore`: added `.claude`.
- Trivial cleanups: dropped dead `--transport`/`--port` proxy options; collapsed a no-op ternary in `mcp-config/handler.ts`.

## Deviations upstream has absorbed (dropped from the fork)

- **AssetGateway SSRF allowlist.** We originally added an HTTPS-only hostname allowlist to `AssetGateway.fetchAsset()`. Upstream later shipped its own, broader allowlist (`ALLOWED_HOST_PATTERNS`, now including Tailwind/Unsplash/jsDelivr/unpkg). The merge converged onto upstream's version; our deviation is gone. Do not re-add a local copy.

## Parked / not done

- Nothing currently. (Proxy-level logging, previously parked after the upstream logging subsystem landed, is now implemented above.)

## Known issues

- None currently.

(Historical: `src/commands/upload/command.ts` briefly failed `tsc` after the 0.9.0 merge because `node_modules` still held the old `@google/stitch-sdk` 0.0.3 while `package.json`/`bun.lock` had moved to 0.3.5. Fixed by `bun install` -- see the sync procedure note above. It was never an upstream code bug.)
