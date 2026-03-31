import { describe, it, expect, afterEach, mock } from 'bun:test';
import { SiteService } from '../../src/lib/services/site/SiteService.js';
import type { IAssetGateway } from '../../src/lib/services/site/types.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Path traversal protection in SiteService.generateSite()', () => {
  let tempDir: string;

  const mockAssetGateway: IAssetGateway = {
    rewriteHtmlForBuild: mock(async (_html: string) => ({
      html: '<html><body>rewritten</body></html>',
      assets: [],
    })) as any,
    copyAssetTo: mock(async () => true) as any,
  };

  afterEach(async () => {
    if (tempDir) await fs.remove(tempDir);
  });

  it('should reject route with path traversal (../../)', async () => {
    tempDir = path.join(os.tmpdir(), `traversal-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const config = {
      projectId: 'proj-1',
      routes: [
        { screenId: 's1', route: '/../../etc/evil', status: 'included' as const },
      ],
    };

    const htmlContent = new Map<string, string>();
    htmlContent.set('s1', '<html>payload</html>');

    await expect(
      SiteService.generateSite(config, htmlContent, mockAssetGateway, tempDir)
    ).rejects.toThrow(/path traversal/i);

    // Verify no file was written outside tempDir
    const evilPath = path.resolve(tempDir, '../../etc/evil.astro');
    expect(await fs.pathExists(evilPath)).toBe(false);
  });

  it('should reject route with dot-dot in the middle', async () => {
    tempDir = path.join(os.tmpdir(), `traversal-test2-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const config = {
      projectId: 'proj-1',
      routes: [
        { screenId: 's1', route: '/pages/../../../tmp/evil', status: 'included' as const },
      ],
    };

    const htmlContent = new Map<string, string>();
    htmlContent.set('s1', '<html>payload</html>');

    await expect(
      SiteService.generateSite(config, htmlContent, mockAssetGateway, tempDir)
    ).rejects.toThrow(/path traversal/i);
  });

  it('should allow normal nested routes', async () => {
    tempDir = path.join(os.tmpdir(), `traversal-test3-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const config = {
      projectId: 'proj-1',
      routes: [
        { screenId: 's1', route: '/blog/posts/hello', status: 'included' as const },
      ],
    };

    const htmlContent = new Map<string, string>();
    htmlContent.set('s1', '<html>hello</html>');

    // Should not throw
    await SiteService.generateSite(config, htmlContent, mockAssetGateway, tempDir);

    const filePath = path.join(tempDir, 'src/pages/blog/posts/hello.astro');
    expect(await fs.pathExists(filePath)).toBe(true);
  });

  it('should allow root route (/)', async () => {
    tempDir = path.join(os.tmpdir(), `traversal-test4-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const config = {
      projectId: 'proj-1',
      routes: [
        { screenId: 's1', route: '/', status: 'included' as const },
      ],
    };

    const htmlContent = new Map<string, string>();
    htmlContent.set('s1', '<html>index</html>');

    await SiteService.generateSite(config, htmlContent, mockAssetGateway, tempDir);

    const filePath = path.join(tempDir, 'src/pages/index.astro');
    expect(await fs.pathExists(filePath)).toBe(true);
  });

  it('should allow simple single-segment routes', async () => {
    tempDir = path.join(os.tmpdir(), `traversal-test5-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const config = {
      projectId: 'proj-1',
      routes: [
        { screenId: 's1', route: '/about', status: 'included' as const },
      ],
    };

    const htmlContent = new Map<string, string>();
    htmlContent.set('s1', '<html>about</html>');

    await SiteService.generateSite(config, htmlContent, mockAssetGateway, tempDir);

    const filePath = path.join(tempDir, 'src/pages/about.astro');
    expect(await fs.pathExists(filePath)).toBe(true);
  });
});
