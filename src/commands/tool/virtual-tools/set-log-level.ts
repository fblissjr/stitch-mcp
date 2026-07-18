import type { StitchToolClient, Stitch } from '@google/stitch-sdk';
import type { VirtualTool } from '../spec.js';
import { getLogLevel, setLogLevel, isValidLevel } from '../../../lib/log/level.js';

/**
 * Virtual tool that adjusts local logging verbosity at runtime. Exposed as a
 * first-class MCP tool so any client (or agent) can dial capture up while
 * debugging and back down afterward -- no restart or env change required.
 */
export const setLogLevelTool: VirtualTool = {
  name: 'set_log_level',
  description:
    '(Virtual) Set stitch-mcp local logging verbosity at runtime. ' +
    'Levels: "off" (no logging), "minimal" (metadata only: tool name, timing, ok/error), ' +
    '"full" (args, results, and downloaded assets). Returns the previous and current level.',
  inputSchema: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: ['off', 'minimal', 'full'],
        description: 'Required. The verbosity level to set.',
      },
    },
    required: ['level'],
  },
  execute: async (_client: StitchToolClient, args: any, _stitch?: Stitch) => {
    const requested = typeof args?.level === 'string' ? args.level.trim().toLowerCase() : '';
    if (!isValidLevel(requested)) {
      throw new Error(
        `Invalid log level "${args?.level}". Expected one of: off, minimal, full.`,
      );
    }
    const previous = getLogLevel();
    setLogLevel(requested);
    return {
      previous,
      level: requested,
      message: `stitch-mcp logging set to "${requested}" (was "${previous}")`,
    };
  },
};
