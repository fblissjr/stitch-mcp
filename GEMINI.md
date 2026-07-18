---
description: Use Bun as the runtime, test runner, and package manager for this project.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js for this project.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`.
- Use `bun test` instead of `jest` or `vitest`.
- Use `bun install` / `bun add` instead of `npm`, `yarn`, or `pnpm`.
- Use `bun run <script>` instead of `npm run <script>`.
- Build with `bun run build` (runs `scripts/build.ts` + `tsc`).
- Bun automatically loads `.env`, so don't add `dotenv`.

## What this project is (don't apply generic Bun web-app boilerplate)

This is a **CLI + MCP server**, not a `Bun.serve()` web app. Before assuming a stock Bun pattern, note the intentional stack choices:

- HTTP/dev server: **Vite** (`StitchViteServer`) and Node's `http.createServer` -- **not** `Bun.serve()` or `express`.
- Filesystem: **`fs-extra`** -- **not** `node:fs` readFile/writeFile or `Bun.file`.
- No database, Redis, or WebSocket layer -- ignore `bun:sqlite`, `Bun.redis`, `Bun.sql`, and `ws` guidance.
- Frontend output is **Astro** static sites, not Bun HTML imports.

See `CLAUDE.md` for the full architecture and conventions.

## Testing

Use `bun test` to run the suite (preloads `tests/setup.ts`).

```ts#example.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```
