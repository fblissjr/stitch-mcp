import { test, expect, describe, mock } from 'bun:test';
import { isAbsolute, sep } from 'node:path';
import { createProxyLogger, resolveDefaultLogRoot } from './proxy-logger.js';
import type { CaptureInput, CaptureResult, CaptureSpec } from './capture/spec.js';

function input(overrides: Partial<CaptureInput> = {}): CaptureInput {
  return {
    tool: 'get_screen',
    args: { projectId: 'p1' },
    result: { content: [{ type: 'text', text: 'ok' }] },
    duration_ms: 12,
    started_at: '2026-01-01T00:00:00.000Z',
    finished_at: '2026-01-01T00:00:00.012Z',
    ...overrides,
  };
}

describe('resolveDefaultLogRoot', () => {
  test('resolves to an absolute .stitch-mcp/log inside the project', () => {
    const root = resolveDefaultLogRoot();
    expect(isAbsolute(root)).toBe(true);
    expect(root.endsWith(`.stitch-mcp${sep}log`)).toBe(true);
    // walked up to the project root, not left as a CWD-relative fragment
    expect(root).not.toBe(`.stitch-mcp${sep}log`);
  });
});

describe('createProxyLogger', () => {
  test('off: records nothing', async () => {
    const append = mock(async () => ({ success: true }) as const);
    const fullCapture: CaptureSpec = { capture: mock(async () => okCapture()) };
    const logger = createProxyLogger({ getLevel: () => 'off', append, fullCapture });

    await logger.record(input());

    expect(append).toHaveBeenCalledTimes(0);
    expect(fullCapture.capture).toHaveBeenCalledTimes(0);
  });

  test('minimal: appends a metadata-only envelope, never touches full capture', async () => {
    const append = mock(async () => ({ success: true }) as const);
    const fullCapture: CaptureSpec = { capture: mock(async () => okCapture()) };
    const logger = createProxyLogger({
      getLevel: () => 'minimal',
      append,
      fullCapture,
      newId: () => 'id-123',
    });

    await logger.record(input({ tool: 'list_screens', duration_ms: 42 }));

    expect(fullCapture.capture).toHaveBeenCalledTimes(0);
    expect(append).toHaveBeenCalledTimes(1);
    const [path, event] = append.mock.calls[0] as [string, any];
    // minimal writes to its own stream, not events.jsonl
    expect(path.endsWith('metadata.jsonl')).toBe(true);
    expect(event.type).toBe('call.metadata');
    expect(event.id).toBe('id-123');
    expect(event.trace_id).toBe('id-123');
    expect(event.schema_version).toBe(1);
    expect(event.payload).toMatchObject({ tool: 'list_screens', duration_ms: 42, ok: true });
    // no heavy fields
    expect(event.payload.args).toBeUndefined();
    expect(event.payload.result).toBeUndefined();
  });

  test('minimal: marks ok=false when the result is an error', async () => {
    const append = mock(async () => ({ success: true }) as const);
    const logger = createProxyLogger({ getLevel: () => 'minimal', append });

    await logger.record(input({ result: { isError: true, content: [] } }));

    const [, event] = append.mock.calls[0] as [string, any];
    expect(event.payload.ok).toBe(false);
  });

  test('full: delegates to the capture backend, does not hand-append', async () => {
    const append = mock(async () => ({ success: true }) as const);
    const capture = mock(async () => okCapture());
    const logger = createProxyLogger({ getLevel: () => 'full', append, fullCapture: { capture } });

    await logger.record(input());

    expect(capture).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(0);
  });

  test('best-effort: a throwing append never propagates', async () => {
    const warn = mock(() => {});
    const append = mock(async () => {
      throw new Error('disk full');
    });
    const logger = createProxyLogger({ getLevel: () => 'minimal', append, warn });

    await expect(logger.record(input())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('best-effort: warns only once across repeated failures', async () => {
    const warn = mock(() => {});
    const append = mock(async () => ({
      success: false as const,
      error: { code: 'EVENT_WRITE_FAILED' as const, message: 'nope', recoverable: false },
    }));
    const logger = createProxyLogger({ getLevel: () => 'minimal', append, warn });

    await logger.record(input());
    await logger.record(input());
    await logger.record(input());

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

function okCapture(): CaptureResult {
  return { success: true, data: { trace_id: 't', produced_screen_ids: [], warnings: [] } };
}
