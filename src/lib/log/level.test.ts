import { test, expect, describe, afterEach } from 'bun:test';
import {
  resolveInitialLevel,
  isValidLevel,
  getLogLevel,
  setLogLevel,
  type LogLevel,
} from './level.js';

describe('resolveInitialLevel', () => {
  test('honors an explicit STITCH_MCP_LOG_LEVEL', () => {
    expect(resolveInitialLevel({ STITCH_MCP_LOG_LEVEL: 'off' })).toBe('off');
    expect(resolveInitialLevel({ STITCH_MCP_LOG_LEVEL: 'full' })).toBe('full');
    expect(resolveInitialLevel({ STITCH_MCP_LOG_LEVEL: '  MINIMAL ' })).toBe('minimal');
  });

  test('maps upstream STITCH_MCP_LOG=1 toggle to full', () => {
    expect(resolveInitialLevel({ STITCH_MCP_LOG: '1' })).toBe('full');
  });

  test('prefers explicit level over the legacy toggle', () => {
    expect(resolveInitialLevel({ STITCH_MCP_LOG: '1', STITCH_MCP_LOG_LEVEL: 'off' })).toBe('off');
  });

  test('defaults to minimal', () => {
    expect(resolveInitialLevel({})).toBe('minimal');
  });

  test('ignores an invalid level and falls back', () => {
    expect(resolveInitialLevel({ STITCH_MCP_LOG_LEVEL: 'loud' })).toBe('minimal');
  });
});

describe('isValidLevel', () => {
  test('accepts known levels only', () => {
    for (const l of ['off', 'minimal', 'full']) expect(isValidLevel(l)).toBe(true);
    expect(isValidLevel('verbose')).toBe(false);
    expect(isValidLevel('')).toBe(false);
  });
});

describe('get/set current level', () => {
  const original: LogLevel = getLogLevel();
  afterEach(() => setLogLevel(original));

  test('round-trips through the setter', () => {
    setLogLevel('full');
    expect(getLogLevel()).toBe('full');
    setLogLevel('off');
    expect(getLogLevel()).toBe('off');
  });
});
