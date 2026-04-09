import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ProxyCommandHandler } from './handler.js';

describe('ProxyCommandHandler', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('starts CompositeStitchServer with StdioServerTransport', async () => {
    process.env.STITCH_API_KEY = 'test-key';
    let serverStarted = false;

    const handler = new ProxyCommandHandler({
      createServer: (_config) => ({
        start: async () => { serverStarted = true; },
        close: async () => {},
      } as any),
      createTransport: () => ({
        onclose: Promise.resolve(),
        start: async () => {},
      } as any),
    });

    const result = await handler.execute({});
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('running');
    expect(serverStarted).toBe(true);
  });

  it('passes STITCH_API_KEY to the server config', async () => {
    process.env.STITCH_API_KEY = 'my-secret-key';
    let receivedApiKey: string | undefined;

    const handler = new ProxyCommandHandler({
      createServer: (config) => {
        receivedApiKey = config.apiKey;
        return {
          start: async () => {},
          close: async () => {},
        } as any;
      },
      createTransport: () => ({
        onclose: Promise.resolve(),
        start: async () => {},
      } as any),
    });

    const result = await handler.execute({});
    expect(result.success).toBe(true);
    expect(receivedApiKey).toBe('my-secret-key');
  });

  it('returns error when STITCH_API_KEY is missing', async () => {
    delete process.env.STITCH_API_KEY;

    const handler = new ProxyCommandHandler();
    const result = await handler.execute({});

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('MISSING_API_KEY');
    expect(result.error?.recoverable).toBe(true);
  });

  it('awaits transport.onclose before returning', async () => {
    process.env.STITCH_API_KEY = 'test-key';
    let oncloseFired = false;

    const handler = new ProxyCommandHandler({
      createServer: () => ({
        start: async () => {},
        close: async () => {},
      } as any),
      createTransport: () => ({
        onclose: new Promise<void>(resolve =>
          setTimeout(() => { oncloseFired = true; resolve(); }, 10)
        ),
        start: async () => {},
      } as any),
    });

    const result = await handler.execute({});
    expect(result.success).toBe(true);
    expect(oncloseFired).toBe(true);
  });

  it('returns error when server start fails', async () => {
    process.env.STITCH_API_KEY = 'test-key';

    const handler = new ProxyCommandHandler({
      createServer: () => ({
        start: async () => { throw new Error('Connection refused'); },
        close: async () => {},
      } as any),
      createTransport: () => ({
        onclose: Promise.resolve(),
        start: async () => {},
      } as any),
    });

    const result = await handler.execute({});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PROXY_START_ERROR');
    expect(result.error?.message).toBe('Connection refused');
  });
});
