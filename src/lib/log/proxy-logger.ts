import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { appendEvent, type AppendResult } from './append.js';
import { createCaptureHandler, DEFAULT_LOG_ROOT } from './factory.js';
import type { CaptureInput, CaptureSpec } from './capture/spec.js';
import { getLogLevel, type LogLevel } from './level.js';

/**
 * Records MCP proxy tool calls to the local log, honoring the current
 * {@link LogLevel}. Best-effort: a `record()` call never throws and never
 * blocks the MCP response on a logging failure -- capture problems are
 * reported once to stderr and then suppressed.
 */
export interface ProxyLogger {
  record(input: CaptureInput): Promise<void>;
}

export interface ProxyLoggerDeps {
  /** Log root directory. Defaults to STITCH_MCP_LOG_DIR or `.stitch-mcp/log`. */
  root?: string;
  getLevel?: () => LogLevel;
  append?: (eventsPath: string, event: unknown) => Promise<AppendResult>;
  /** Full-fidelity capture backend; lazily built from `root` when omitted. */
  fullCapture?: CaptureSpec;
  newId?: () => string;
  warn?: (message: string) => void;
}

export function createProxyLogger(deps: ProxyLoggerDeps = {}): ProxyLogger {
  const root = deps.root ?? process.env.STITCH_MCP_LOG_DIR ?? DEFAULT_LOG_ROOT;
  // Minimal metadata goes to its own stream so it never mixes with the strict
  // call.requested/completed/failed schema that `full` capture writes to
  // events.jsonl (which upstream's EventSchema and log tooling parse).
  const metadataPath = join(root, 'metadata.jsonl');
  const getLevel = deps.getLevel ?? getLogLevel;
  const append = deps.append ?? appendEvent;
  const newId = deps.newId ?? (() => randomUUID());
  const warn = deps.warn ?? ((m: string) => console.error(m));

  let fullCapture = deps.fullCapture;
  let warned = false;

  const warnOnce = (message: string): void => {
    if (warned) return;
    warned = true;
    warn(`[stitch-mcp log] ${message}; further capture errors suppressed`);
  };

  return {
    async record(input: CaptureInput): Promise<void> {
      const level = getLevel();
      if (level === 'off') return;

      try {
        if (level === 'minimal') {
          const id = newId();
          const result = await append(metadataPath, {
            id,
            time: input.started_at,
            trace_id: id,
            schema_version: 1,
            type: 'call.metadata',
            payload: {
              tool: input.tool,
              duration_ms: input.duration_ms,
              started_at: input.started_at,
              finished_at: input.finished_at,
              ok: !isErrorResult(input.result),
            },
          });
          if (!result.success) warnOnce(`minimal capture failed: ${result.error.message}`);
          return;
        }

        // level === 'full'
        if (!fullCapture) fullCapture = createCaptureHandler(root);
        const result = await fullCapture.capture(input);
        if (!result.success) warnOnce(`full capture failed: ${result.error.message}`);
      } catch (err) {
        warnOnce(`capture error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function isErrorResult(result: unknown): boolean {
  return Boolean(
    result && typeof result === 'object' && (result as { isError?: boolean }).isError === true,
  );
}
