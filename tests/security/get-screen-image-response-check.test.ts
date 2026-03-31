import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { getScreenImageTool } from '../../src/commands/tool/virtual-tools/get-screen-image.js';
import { createMockStitch, createMockProject, createMockScreen } from '../../src/services/stitch-sdk/MockStitchSDK.js';

const mockStitch = createMockStitch(createMockProject('proj-1', [
  createMockScreen({ screenId: 'home', projectId: 'proj-1' }),
]));

describe('get_screen_image response.ok validation', () => {
  let mockClient: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockClient = { callTool: mock() };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return null imageContent when fetch returns 404', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('<html>Not Found</html>', {
        status: 404,
        statusText: 'Not Found',
      }))
    ) as any;

    const result = await getScreenImageTool.execute(
      mockClient,
      { projectId: 'proj-1', screenId: 'home' },
      mockStitch as any
    );

    expect(result.imageContent).toBeNull();
  });

  it('should return null imageContent when fetch returns 500', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }))
    ) as any;

    const result = await getScreenImageTool.execute(
      mockClient,
      { projectId: 'proj-1', screenId: 'home' },
      mockStitch as any
    );

    expect(result.imageContent).toBeNull();
  });

  it('should return null imageContent when fetch returns 403', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Forbidden', {
        status: 403,
        statusText: 'Forbidden',
      }))
    ) as any;

    const result = await getScreenImageTool.execute(
      mockClient,
      { projectId: 'proj-1', screenId: 'home' },
      mockStitch as any
    );

    expect(result.imageContent).toBeNull();
  });

  it('should return valid base64 for successful 200 response', async () => {
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(imageBytes, { status: 200 }))
    ) as any;

    const result = await getScreenImageTool.execute(
      mockClient,
      { projectId: 'proj-1', screenId: 'home' },
      mockStitch as any
    );

    expect(result.imageContent).toBeDefined();
    expect(result.imageContent).not.toBeNull();
    // Verify it decodes back to the original bytes
    const decoded = Buffer.from(result.imageContent!, 'base64');
    expect(decoded[0]).toBe(0x89);
    expect(decoded[1]).toBe(0x50);
  });
});
