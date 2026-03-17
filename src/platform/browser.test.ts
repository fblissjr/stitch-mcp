import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { openUrl, validateUrl } from './browser.js';
import * as childProcess from 'node:child_process';

describe('browser', () => {
  describe('validateUrl', () => {
    it('accepts valid http and https URLs', () => {
      expect(validateUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/');
      expect(validateUrl('https://google.com')).toBe('https://google.com/');
      expect(validateUrl('http://localhost/path?a=1&b=2')).toBe('http://localhost/path?a=1&b=2');
    });

    it('throws on invalid protocols', () => {
      expect(() => validateUrl('file:///etc/passwd')).toThrow('Invalid protocol');
      expect(() => validateUrl('javascript:alert(1)')).toThrow('Invalid protocol');
    });

    it('throws on malformed URLs', () => {
      expect(() => validateUrl('not-a-url')).toThrow('Invalid URL');
    });
  });

  describe('openUrl', () => {
    let spawnSpy: any;

    beforeEach(() => {
      spawnSpy = spyOn(childProcess, 'spawn').mockReturnValue({
        unref: () => {},
      } as any);
    });

    afterEach(() => {
      spawnSpy.mockRestore();
    });

    it('spawns the correct command on non-windows', () => {
      if (process.platform !== 'win32') {
        const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        openUrl('http://127.0.0.1');
        expect(spawnSpy).toHaveBeenCalledWith(cmd, ['http://127.0.0.1/'], expect.any(Object));
      }
    });

    it('spawns the correct command on windows', () => {
      if (process.platform === 'win32') {
        openUrl('http://127.0.0.1');
        expect(spawnSpy).toHaveBeenCalledWith('cmd', ['/c', 'start', '""', '"http://127.0.0.1/"'], {
          detached: true,
          stdio: 'ignore',
          shell: false
        });
      }
    });

    it('handles URLs with ampersands correctly on windows', () => {
      if (process.platform === 'win32') {
        const url = 'http://localhost/path?a=1&b=2';
        openUrl(url);
        expect(spawnSpy).toHaveBeenCalledWith('cmd', ['/c', 'start', '""', `"${url}"`], {
          detached: true,
          stdio: 'ignore',
          shell: false
        });
      }
    });
  });
});
