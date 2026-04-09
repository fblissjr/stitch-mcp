import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { stitch as defaultStitch } from '@google/stitch-sdk';
import type { Stitch, StitchToolClient } from '@google/stitch-sdk';
import { virtualTools as defaultVirtualTools } from '../tool/virtual-tools/index.js';
import type { VirtualTool } from '../tool/spec.js';
import { getStitchUrl } from '../../services/stitch/connection.js';

const PROTOCOL_VERSION = '2024-11-05';
const TOOLS_TTL_MS = 30_000;

export interface CompositeServerConfig {
  apiKey: string;
  url?: string;
  name?: string;
  version?: string;
}

/**
 * MCP server that combines upstream Stitch tools with local virtual tools.
 *
 * Replaces the SDK's StitchProxy, which only exposes remote Stitch tools.
 * This server adds build_site, get_screen_code, and get_screen_image as
 * first-class MCP tools that agents can call directly.
 */
export class CompositeStitchServer {
  private mcpServer: McpServer;
  private url: string;
  private headers: Readonly<Record<string, string>>;
  private name: string;
  private version: string;
  private remoteTools: Tool[] = [];
  private remoteToolsFetchedAt = 0;
  private requestId = 0;
  private virtualToolMap: Map<string, VirtualTool>;
  private virtualToolDefs: Tool[];
  private stitchInstance: Stitch;

  constructor(
    config: CompositeServerConfig,
    deps?: {
      stitch?: Stitch;
      virtualTools?: VirtualTool[];
      createMcpServer?: (name: string, version: string) => McpServer;
    },
  ) {
    this.url = getStitchUrl(config.url);
    this.name = config.name || 'stitch-mcp';
    this.version = config.version || '1.0.0';
    this.headers = Object.freeze({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Goog-Api-Key': config.apiKey,
    });

    this.stitchInstance = deps?.stitch || defaultStitch;

    // Exclude list_tools -- we handle tool listing natively via MCP protocol
    const tools = (deps?.virtualTools || defaultVirtualTools)
      .filter(t => t.name !== 'list_tools');
    this.virtualToolMap = new Map(tools.map(t => [t.name, t]));
    this.virtualToolDefs = tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Tool['inputSchema'],
    }));

    const createServer = deps?.createMcpServer || ((name: string, version: string) =>
      new McpServer({ name, version }, { capabilities: { tools: {} } })
    );
    this.mcpServer = createServer(this.name, this.version);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // tools/list: merge remote tools from Stitch API with local virtual tools
    this.mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        await this.refreshRemoteTools();
      } catch (err) {
        console.error('[stitch-mcp] Failed to refresh remote tools:', err);
        if (this.remoteTools.length === 0) throw err;
        console.error('[stitch-mcp] Using cached tools from previous refresh');
      }

      return { tools: [...this.remoteTools, ...this.virtualToolDefs] };
    });

    // tools/call: route to virtual tool handler or forward to Stitch
    this.mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`[stitch-mcp] Calling tool: ${name}`);

      const virtualTool = this.virtualToolMap.get(name);
      if (virtualTool) {
        return this.executeVirtualTool(virtualTool, args || {});
      }
      return this.forwardToolCall(name, args);
    });
  }

  private async executeVirtualTool(
    tool: VirtualTool,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      // Current virtual tools (build_site, get_screen_code, get_screen_image)
      // only use the stitch param, not client. We pass null for client since
      // creating a StitchToolClient would open a second HTTP connection.
      const result = await tool.execute(
        null as unknown as StitchToolClient,
        args,
        this.stitchInstance,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[stitch-mcp] Virtual tool "${tool.name}" error: ${message}`);
      return {
        content: [{ type: 'text', text: `Error calling ${tool.name}: ${message}` }],
        isError: true,
      };
    }
  }

  private async forwardToolCall(
    name: string,
    args: Record<string, unknown> | undefined,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const result = await this.forwardToStitch('tools/call', {
        name,
        arguments: args,
      });
      return result as { content: Array<{ type: string; text: string }> };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[stitch-mcp] Remote tool "${name}" error: ${message}`);
      return {
        content: [{ type: 'text', text: `Error calling ${name}: ${message}` }],
        isError: true,
      };
    }
  }

  async start(transport: Transport): Promise<void> {
    console.error(`[stitch-mcp] Connecting to ${this.url}...`);
    await this.initializeConnection();
    await this.mcpServer.connect(transport);
    console.error('[stitch-mcp] Proxy server running');
  }

  async close(): Promise<void> {
    await this.mcpServer.close();
  }

  private async initializeConnection(): Promise<void> {
    await this.forwardToStitch('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: this.name, version: this.version },
    });

    // Send initialized notification (fire and forget, per MCP spec)
    fetch(this.url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    }).catch(err => {
      console.error('[stitch-mcp] Failed to send initialized notification:', err);
    });

    await this.refreshRemoteTools(true);
    console.error(
      `[stitch-mcp] Connected: ${this.remoteTools.length} remote tools, ` +
      `${this.virtualToolDefs.length} virtual tools`,
    );
  }

  private async refreshRemoteTools(force = false): Promise<void> {
    if (!force && this.remoteTools.length > 0 &&
        Date.now() - this.remoteToolsFetchedAt < TOOLS_TTL_MS) {
      return;
    }
    const result = await this.forwardToStitch('tools/list', {}) as { tools: Tool[] };
    this.remoteTools = result.tools || [];
    this.remoteToolsFetchedAt = Date.now();
  }

  private async forwardToStitch(method: string, params?: unknown): Promise<unknown> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: params ?? {},
      id: ++this.requestId,
    });

    let response: Response;
    try {
      response = await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body,
      });
    } catch (err: any) {
      throw new Error(`Network failure connecting to Stitch API: ${err.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stitch API error (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as {
      error?: { message: string };
      result?: unknown;
    };
    if (result.error) {
      throw new Error(`Stitch RPC error: ${result.error.message}`);
    }
    return result.result;
  }
}
