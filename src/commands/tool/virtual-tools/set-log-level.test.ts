import { test, expect, describe, afterEach } from 'bun:test';
import { setLogLevelTool } from './set-log-level.js';
import { getLogLevel, setLogLevel, type LogLevel } from '../../../lib/log/level.js';

const original: LogLevel = getLogLevel();
afterEach(() => setLogLevel(original));

describe('set_log_level virtual tool', () => {
  test('sets the level and reports the previous one', async () => {
    setLogLevel('minimal');
    const res = await setLogLevelTool.execute(null as any, { level: 'full' });
    expect(res).toMatchObject({ previous: 'minimal', level: 'full' });
    expect(getLogLevel()).toBe('full');
  });

  test('normalizes case and whitespace', async () => {
    await setLogLevelTool.execute(null as any, { level: '  OFF ' });
    expect(getLogLevel()).toBe('off');
  });

  test('rejects an invalid level without changing state', async () => {
    setLogLevel('minimal');
    await expect(setLogLevelTool.execute(null as any, { level: 'loud' })).rejects.toThrow(
      /Invalid log level/,
    );
    expect(getLogLevel()).toBe('minimal');
  });

  test('is registered in the virtual tool set', async () => {
    const { virtualTools } = await import('./index.js');
    expect(virtualTools.some((t) => t.name === 'set_log_level')).toBe(true);
  });
});
