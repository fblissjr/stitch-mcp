/**
 * Runtime-adjustable logging verbosity for the MCP proxy.
 *
 * - `off`     -- capture nothing.
 * - `minimal` -- one metadata line per tool call (tool, timing, ok/error). No
 *                args, results, or downloaded blobs. This is the fork default.
 * - `full`    -- upstream's full capture (args + results + content-addressed
 *                blobs), via the shared CaptureHandler.
 *
 * The level is seeded from the environment at startup and can be changed at
 * runtime by the `set_log_level` virtual tool (see set-log-level.ts).
 */
export type LogLevel = 'off' | 'minimal' | 'full';

const LEVELS: readonly LogLevel[] = ['off', 'minimal', 'full'];

export function isValidLevel(value: string): value is LogLevel {
  return (LEVELS as readonly string[]).includes(value);
}

/**
 * Resolve the starting level from the environment:
 * 1. `STITCH_MCP_LOG_LEVEL=off|minimal|full` (explicit, wins).
 * 2. `STITCH_MCP_LOG=1` (upstream's binary toggle) -> `full`, for back-compat.
 * 3. Otherwise `minimal` -- the fork keeps lightweight metadata by default.
 */
export function resolveInitialLevel(env: NodeJS.ProcessEnv = process.env): LogLevel {
  const raw = env.STITCH_MCP_LOG_LEVEL?.trim().toLowerCase();
  if (raw && isValidLevel(raw)) return raw;
  if (env.STITCH_MCP_LOG === '1') return 'full';
  return 'minimal';
}

let current: LogLevel = resolveInitialLevel();

export function getLogLevel(): LogLevel {
  return current;
}

export function setLogLevel(level: LogLevel): void {
  current = level;
}
