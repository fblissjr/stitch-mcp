import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CompositeStitchServer } from './composite-server.js';
import type { CompositeServerConfig } from './composite-server.js';

interface ProxyCommandInput {
  debug?: boolean;
}

interface ProxyCommandResult {
  success: boolean;
  data?: { status: string };
  error?: { code: string; message: string; recoverable: boolean };
}

export class ProxyCommandHandler {
  private createServer: (config: CompositeServerConfig) => CompositeStitchServer;
  private createTransport: () => StdioServerTransport;

  constructor(deps?: {
    createServer?: (config: CompositeServerConfig) => CompositeStitchServer;
    createTransport?: () => StdioServerTransport;
  }) {
    this.createServer = deps?.createServer ?? ((config) => new CompositeStitchServer(config));
    this.createTransport = deps?.createTransport ?? (() => new StdioServerTransport());
  }

  async execute(input: ProxyCommandInput): Promise<ProxyCommandResult> {
    const apiKey = process.env.STITCH_API_KEY;
    if (!apiKey) {
      console.error(
        '[stitch-mcp] No STITCH_API_KEY found.\n' +
        'Set it in your environment or run: npx @_davideast/stitch-mcp init',
      );
      return {
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'STITCH_API_KEY environment variable is required',
          recoverable: true,
        },
      };
    }

    try {
      const server = this.createServer({ apiKey });
      const transport = this.createTransport();
      await server.start(transport);
      await transport.onclose;
      return { success: true, data: { status: 'running' } };
    } catch (e: any) {
      return {
        success: false,
        error: { code: 'PROXY_START_ERROR', message: e.message, recoverable: false },
      };
    }
  }
}
