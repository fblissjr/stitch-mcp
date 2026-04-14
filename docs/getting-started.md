---
title: Getting Started
description: Step-by-step tutorial for setting up stitch-mcp with Claude Code, Claude Desktop, and Google Antigravity.
order: 0
category: getting-started
---

# Getting Started

This tutorial walks you through setting up stitch-mcp with three clients: Claude Code, Claude Desktop (including cowork mode), and Google Antigravity. By the end you will have an agent connected to Google Stitch with access to both upstream API tools and the proxy's virtual tools.

For other clients (VS Code, Cursor, Gemini CLI, Codex, OpenCode), see [Connect Your Agent](connect-your-agent.md).

## Should you use the proxy?

stitch-mcp can connect your agent to Stitch in two ways: through a local proxy process (stdio) or directly to the Stitch API (HTTP). The proxy is the recommended path for interactive agent work, but it is worth understanding the trade-offs.

**What the proxy gives you:**

- **Virtual tools** -- `build_site`, `get_screen_code`, and `get_screen_image` combine multiple API calls into single operations. Without them, your agent has to fetch metadata, follow download URLs, and assemble results itself.
- **Automatic token refresh** -- OAuth access tokens expire after one hour. The proxy refreshes them every 55 minutes so long-running sessions don't hit auth errors mid-workflow.
- **No port management** -- stdio transport means no open ports, no firewall rules, no process management. The client starts and owns the proxy lifecycle.
- **Unified tool surface** -- upstream Stitch tools and virtual tools appear as a single flat list to your agent.

**What the proxy costs you:**

- **A local process** -- the proxy runs as a child process of your MCP client. It needs Node.js 18+ or Bun on the machine.
- **Slightly more config** -- instead of a URL and an API key header, you configure a command, args, and env vars.
- **Not suited for CI/serverless** -- environments that can't spawn child processes should use the direct HTTP connection.

**Recommendation:** Use the proxy unless you have a specific reason not to. If you only need upstream Stitch tools and want the simplest possible config (a URL and an API key), use direct mode. Switching between the two is a config change -- same credentials, different transport.

For the full architecture breakdown, see [Connection Modes](connection-modes.md).

## Prerequisites

- **Node.js 18+** or **Bun** installed
- A **Google Cloud project** with the Stitch API enabled
- A **Stitch API key** (simplest path) or Google Cloud OAuth credentials
- One of the three clients installed: Claude Code, Claude Desktop, or Google Antigravity

## Installing stitch-mcp

You do not need to install stitch-mcp globally. MCP clients launch it on demand. There are two ways to run it depending on whether you are an end user or a contributor.

### End user: bunx

If you have Bun installed, use `bunx` to run stitch-mcp directly from the registry with no install step:

```bash
bunx @_davideast/stitch-mcp proxy
```

This is what you will use in your MCP client configs. If you prefer Node.js, `npx @_davideast/stitch-mcp proxy` works the same way.

### Contributor: local clone

If you are working on stitch-mcp itself, clone the repo and build:

```bash
git clone https://github.com/davideast/stitch-mcp.git
cd stitch-mcp
bun install
bun run build
```

Then reference the built binary in your MCP configs:

```bash
node ./bin/stitch-mcp.js proxy
```

The tutorials below show both `bunx` and local-clone variants where the config differs.

## Authentication

The fastest path is an API key. Set it as an environment variable:

```bash
export STITCH_API_KEY="your-api-key"
```

Or pass it through your MCP client config (shown in each tutorial below).

For OAuth, run the guided setup wizard which handles gcloud installation, authentication, project selection, and API enablement:

```bash
bunx @_davideast/stitch-mcp init
```

See [Setup](setup.md) for the full walkthrough of auth modes and the init wizard.

## Tutorial: Claude Code

### Step 1 -- Add the MCP server

With an API key:

```bash
claude mcp add stitch -e STITCH_API_KEY=YOUR_API_KEY \
  -- bunx @_davideast/stitch-mcp proxy
```

With OAuth (requires prior `init` or manual gcloud setup):

```bash
claude mcp add stitch -- bunx @_davideast/stitch-mcp proxy
```

**Local clone variant:** replace `bunx @_davideast/stitch-mcp` with `node /absolute/path/to/stitch-mcp/bin/stitch-mcp.js`:

```bash
claude mcp add stitch -e STITCH_API_KEY=YOUR_API_KEY \
  -- node /path/to/stitch-mcp/bin/stitch-mcp.js proxy
```

### Step 2 -- Choose a scope

By default, `claude mcp add` saves to the project-level config (`.mcp.json`). To make stitch-mcp available across all projects:

```bash
claude mcp add stitch -s user -e STITCH_API_KEY=YOUR_API_KEY \
  -- bunx @_davideast/stitch-mcp proxy
```

`-s user` saves to `~/.claude.json`. `-s project` (default) saves to `./.mcp.json`.

### Step 3 -- Verify

Start a Claude Code session and ask:

> "List the available Stitch tools."

You should see both upstream tools (`list_projects`, `get_screen`, `edit_screens`, etc.) and virtual tools (`build_site`, `get_screen_code`, `get_screen_image`). If you only see upstream tools, the proxy is not running -- check that the `claude mcp add` command succeeded.

### Step 4 -- Try it

Some prompts to confirm everything works:

> "List my Stitch projects."

> "Use get_screen_code to fetch screen ABC from project 123 and show me the HTML structure."

> "Use build_site to create a two-page site from project 123 with the home screen at / and the pricing screen at /pricing."

If a tool call fails with an auth error, run the doctor:

```bash
bunx @_davideast/stitch-mcp doctor --verbose
```

## Tutorial: Claude Desktop + Cowork

### Part A -- Desktop MCP config

Claude Desktop manages MCP servers through a JSON config file.

**Step 1 -- Open the config file**

The file location depends on your OS:

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Create the file if it does not exist.

**Step 2 -- Add the stitch server**

With an API key using bunx:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "bunx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

With OAuth:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "bunx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Local clone variant:** replace `"command": "bunx"` with `"command": "node"` and set args to `["/absolute/path/to/stitch-mcp/bin/stitch-mcp.js", "proxy"]`.

**Step 3 -- Restart Claude Desktop**

Quit and reopen Claude Desktop. It reads the config on startup.

**Step 4 -- Verify**

Open a conversation and ask Claude to list your Stitch projects. The tool calls should appear in the conversation with both upstream and virtual tools available.

### Part B -- Cowork mode

Cowork is Claude Desktop's mode for pairing with Claude Code. When you start a cowork session, Claude Desktop can delegate coding tasks to a Claude Code instance running in your terminal. MCP servers configured in Claude Desktop are available during cowork sessions -- Claude Desktop sees and invokes the tools, then passes the context to Claude Code for implementation.

**How it works:**

1. Configure stitch-mcp in Claude Desktop (Part A above).
2. Open a project directory in your terminal and start Claude Code.
3. In Claude Desktop, start a cowork session with Claude Code.
4. Claude Desktop can now use Stitch tools to fetch design context and hand it to Claude Code for implementation.

**Example workflow:**

1. In Claude Desktop (cowork): "Use get_screen_code to fetch the dashboard screen from project 123."
2. Claude Desktop retrieves the HTML and passes the design context to Claude Code.
3. Claude Code implements the dashboard as a React component in your project, using the Stitch HTML as a design reference.

This workflow lets you use Desktop's conversational interface for design exploration while Code handles the file-level implementation work.

## Tutorial: Google Antigravity

### Step 1 -- Open the MCP config

In Antigravity, navigate to:

**Agent Panel** > **three-dot menu** > **MCP Servers** > **Manage MCP Servers** > **View raw config**

### Step 2 -- Add the stitch server

With an API key using bunx:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "bunx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

With OAuth:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "bunx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Local clone variant:** same as Desktop -- replace `"command": "bunx"` with `"command": "node"` and adjust args.

> **Note:** If you use direct mode instead of the proxy, Antigravity uses `serverUrl` (not `url`) for the HTTP endpoint. See [Connect Your Agent](connect-your-agent.md#antigravity) for the direct config.

### Step 3 -- Verify

Ask the agent to list your Stitch projects. If both upstream and virtual tools appear, the proxy is running correctly.

### Step 4 -- Try it

> "List all screens in project 123 and show me the code for the landing page."

> "Generate a new screen with a sign-up form that has email, password, and a Google sign-in button."

> "Build a site from project 123 with three pages: home at /, features at /features, and pricing at /pricing."

## Verifying your setup

Regardless of which client you use, you can verify the proxy and authentication from the terminal.

**Check authentication:**

```bash
bunx @_davideast/stitch-mcp doctor --verbose
```

This runs 7 health checks covering API key detection, gcloud installation, authentication, and API connectivity.

**List available tools:**

```bash
bunx @_davideast/stitch-mcp tool
```

You should see both upstream tools and virtual tools:

| Type | Tools |
|------|-------|
| Upstream | `list_projects`, `get_project`, `list_screens`, `get_screen`, `generate_screen_from_text`, `edit_screens`, `generate_variants` |
| Virtual | `build_site`, `get_screen_code`, `get_screen_image`, `list_tools` |

If virtual tools are missing, you are connected directly to the API without the proxy. Check your MCP config.

**Test a tool directly:**

```bash
bunx @_davideast/stitch-mcp tool list_projects
```

If this returns your projects, auth is working. See [Troubleshooting](troubleshooting.md) for common errors.

## Next steps

- [Use Stitch Tools in Agents](use-stitch-tools-in-agents.md) -- prompting patterns and debugging workflows
- [Tool Catalog](tool-catalog.md) -- full schemas and parameters for every tool
- [Build a Virtual Tool](build-virtual-tools.md) -- extend the proxy with custom tools
- [Agent Skills](agent-skills.md) -- reusable skills that pair with Stitch data
