import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { CompositeStitchServer } from './composite-server.js';
import type { VirtualTool } from '../tool/spec.js';

// Minimal virtual tool for testing
function makeVirtualTool(name: string, result: any): VirtualTool {
  return {
    name,
    description: `Test tool: ${name}`,
    inputSchema: {
      type: 'object',
      properties: { input: { type: 'string' } },
    },
    execute: mock(async () => result),
  };
}

// Mock fetch for Stitch API calls
function mockStitchApi(toolsList: any[] = [], callResult?: any) {
  const originalFetch = globalThis.fetch;
  const mockFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string || '{}');

    if (body.method === 'initialize') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', result: {}, id: body.id }));
    }
    if (body.method === 'notifications/initialized') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', result: {}, id: body.id }));
    }
    if (body.method === 'tools/list') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: { tools: toolsList },
        id: body.id,
      }));
    }
    if (body.method === 'tools/call') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: callResult || { content: [{ type: 'text', text: 'ok' }] },
        id: body.id,
      }));
    }
    return new Response('Not found', { status: 404 });
  }) as any;

  globalThis.fetch = mockFn;
  return { restore: () => { globalThis.fetch = originalFetch; }, mockFn };
}

describe('CompositeStitchServer', () => {
  let fetchMock: ReturnType<typeof mockStitchApi>;

  afterEach(() => {
    fetchMock?.restore();
  });

  describe('constructor', () => {
    it('filters out list_tools from virtual tools', () => {
      fetchMock = mockStitchApi();
      const listTool = makeVirtualTool('list_tools', []);
      const buildTool = makeVirtualTool('build_site', { pages: [] });

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [listTool, buildTool], stitch: {} as any },
      );

      const toolMap = (server as any).virtualToolMap as Map<string, any>;
      expect(toolMap.has('list_tools')).toBe(false);
      expect(toolMap.has('build_site')).toBe(true);
    });
  });

  describe('start', () => {
    it('initializes Stitch connection and connects transport', async () => {
      const remoteTools = [
        { name: 'list_projects', description: 'List projects', inputSchema: { type: 'object' } },
      ];
      fetchMock = mockStitchApi(remoteTools);

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [], stitch: {} as any },
      );

      let connected = false;
      const mockTransport = {
        start: async () => {},
        send: async () => {},
        close: async () => {},
        onclose: Promise.resolve(),
        onmessage: null,
        onerror: null,
        sessionId: undefined,
      } as any;

      // Patch McpServer.connect to track it was called
      const origConnect = (server as any).mcpServer.connect.bind((server as any).mcpServer);
      (server as any).mcpServer.connect = async (t: any) => {
        connected = true;
        // Don't actually connect in tests to avoid protocol issues
      };

      await server.start(mockTransport);

      // Should have sent initialize + tools/list to Stitch API
      const fetchCalls = fetchMock.mockFn.mock.calls;
      const methods = fetchCalls.map((c: any) => {
        try { return JSON.parse(c[1]?.body).method; } catch { return null; }
      }).filter(Boolean);

      expect(methods).toContain('initialize');
      expect(methods).toContain('tools/list');
      expect(connected).toBe(true);
    });

    it('throws when Stitch API is unreachable', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(async () => {
        throw new Error('ECONNREFUSED');
      }) as any;

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [], stitch: {} as any },
      );

      try {
        await server.start({} as any);
        expect(true).toBe(false); // should not reach here
      } catch (err: any) {
        expect(err.message).toContain('Network failure');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('STITCH_HOST validation', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.STITCH_HOST;
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.STITCH_HOST;
      } else {
        process.env.STITCH_HOST = originalEnv;
      }
    });

    it('uses default URL when STITCH_HOST is not set', () => {
      delete process.env.STITCH_HOST;
      fetchMock = mockStitchApi();

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [], stitch: {} as any },
      );
      expect((server as any).url).toBe('https://stitch.googleapis.com/mcp');
    });

    it('rejects non-googleapis.com hosts', () => {
      process.env.STITCH_HOST = 'https://evil.example.com/mcp';
      fetchMock = mockStitchApi();

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [], stitch: {} as any },
      );
      expect((server as any).url).toBe('https://stitch.googleapis.com/mcp');
    });

    it('rejects non-https hosts', () => {
      process.env.STITCH_HOST = 'http://stitch.googleapis.com/mcp';
      fetchMock = mockStitchApi();

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [], stitch: {} as any },
      );
      expect((server as any).url).toBe('https://stitch.googleapis.com/mcp');
    });

    it('accepts valid googleapis.com hosts', () => {
      process.env.STITCH_HOST = 'https://custom.stitch.googleapis.com/mcp';
      fetchMock = mockStitchApi();

      const server = new CompositeStitchServer(
        { apiKey: 'test-key' },
        { virtualTools: [], stitch: {} as any },
      );
      expect((server as any).url).toBe('https://custom.stitch.googleapis.com/mcp');
    });
  });
});
