import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { AssetGateway } from '../../src/lib/server/AssetGateway.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('SSRF protection in AssetGateway.fetchAsset()', () => {
  let gateway: AssetGateway;
  let tempDir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `ssrf-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    gateway = new AssetGateway(tempDir);
    originalFetch = globalThis.fetch;
    // Mock fetch to track whether it was called -- it should NOT be for blocked URLs
    globalThis.fetch = mock(async () => new Response('OK', { status: 200 })) as any;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await fs.remove(tempDir);
  });

  // --- Blocked URLs: fetch must NOT be called ---

  it('should reject cloud metadata endpoint (169.254.169.254)', async () => {
    const result = await gateway.fetchAsset('http://169.254.169.254/latest/meta-data/');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject private IP (10.x.x.x)', async () => {
    const result = await gateway.fetchAsset('http://10.0.0.1/internal-api');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject localhost URLs', async () => {
    const result = await gateway.fetchAsset('http://localhost:8080/admin');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject 127.0.0.1', async () => {
    const result = await gateway.fetchAsset('http://127.0.0.1:9090/metrics');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject file:// scheme', async () => {
    const result = await gateway.fetchAsset('file:///etc/passwd');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject plain http:// URLs', async () => {
    const result = await gateway.fetchAsset('http://evil.com/payload');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject ftp:// scheme', async () => {
    const result = await gateway.fetchAsset('ftp://evil.com/file');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject malformed URLs', async () => {
    const result = await gateway.fetchAsset('not-a-url');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // --- Allowed URLs: fetch SHOULD be called ---

  it('should allow https://fonts.googleapis.com', async () => {
    await gateway.fetchAsset('https://fonts.googleapis.com/css2?family=Roboto');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('should allow https://fonts.gstatic.com', async () => {
    await gateway.fetchAsset('https://fonts.gstatic.com/s/roboto/v30/font.woff2');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('should allow https://*.googleusercontent.com', async () => {
    await gateway.fetchAsset('https://lh3.googleusercontent.com/some-image');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('should allow https://storage.googleapis.com', async () => {
    await gateway.fetchAsset('https://storage.googleapis.com/bucket/file.png');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('should allow https://cdnjs.cloudflare.com', async () => {
    await gateway.fetchAsset('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
