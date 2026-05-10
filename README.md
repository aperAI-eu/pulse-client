# Pulse Client

MCP server and setup wizard for [Pulse](https://test-pulse.aperai.eu), AI-powered project management with a Cortex agent that has persistent wiki memory.

This repo is the entry point for adding any project to Pulse from Claude Code, Codex, VS Code, Antigravity, or any MCP-capable client.

## What you get

After setup, your project has:

- Kanban board in Pulse for tasks, statuses, and phases
- Git-native tracking with `.pulse/` YAML files as the source of truth
- Bidirectional sync between git and the Pulse web UI
- Cortex integration so the org's AI agent can index the repo and work on assigned tasks
- MCP tools in Claude Code, Codex, VS Code, Antigravity, and other MCP-capable IDEs

## Prerequisites

- A GitHub repository for your project
- A Pulse instance URL and API key
- Node.js 20+
- Claude Code, Codex, or another MCP-capable IDE
- Optional Brain URL and org slug for the Pulse-hosted org Brain

## Quickstart

### Claude Code

In your project repo, copy the Claude command:

**Git Bash / Linux / macOS:**

```bash
mkdir -p .claude/commands
curl -o .claude/commands/pulse-setup.md https://raw.githubusercontent.com/aperAI-eu/pulse-client/main/skills/pulse-setup.md
```

**PowerShell:**

```powershell
New-Item -ItemType Directory -Force -Path .claude\commands
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aperAI-eu/pulse-client/main/skills/pulse-setup.md" -OutFile ".claude\commands\pulse-setup.md"
```

Then run in Claude Code:

```text
/pulse-setup
```

The Claude wizard also configures Codex when the `codex` CLI is available.

### Codex

Install the Codex skill, then restart Codex:

```text
$skill-installer install https://github.com/aperAI-eu/pulse-client/tree/main/codex-skills/pulse-setup
```

Then run:

```text
$pulse-setup
```

The Codex skill configures the Pulse MCP server with `codex mcp add`, initializes `.pulse/` files, registers the project, enables git sync, and optionally indexes the repo for Cortex.

## What the wizard does

1. Configures the MCP server with Pulse URL, Pulse API key, and optional org Brain URL.
2. Creates `.pulse/project.yml` and `.pulse/tasks.yml`.
3. Registers the project in Pulse.
4. Sets up git sync and creates the GitHub webhook.
5. Indexes the codebase for Cortex by generating wiki pages.
6. Verifies the setup end to end.

## Manual install

### Option A: npx from GitHub

Claude Code (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "github:aperAI-eu/pulse-client"],
      "env": {
        "PULSE_API_URL": "https://test-pulse.aperai.eu",
        "PULSE_API_KEY": "pk_your_api_key",
        "PULSE_BRAIN_URL": "https://brain.aperai.eu",
        "PULSE_ORG_SLUG": "your-org-slug"
      }
    }
  }
}
```

Codex (`~/.codex/config.toml`), preferably configured via CLI:

```bash
codex mcp add pulse \
  --env PULSE_API_URL="https://test-pulse.aperai.eu" \
  --env PULSE_API_KEY="pk_your_api_key" \
  --env PULSE_BRAIN_URL="https://brain.aperai.eu" \
  --env PULSE_ORG_SLUG="your-org-slug" \
  -- npx -y github:aperAI-eu/pulse-client
```

This creates a config entry like:

```toml
[mcp_servers.pulse]
command = "npx"
args = ["-y", "github:aperAI-eu/pulse-client"]

[mcp_servers.pulse.env]
PULSE_API_URL = "https://test-pulse.aperai.eu"
PULSE_API_KEY = "pk_your_api_key"
PULSE_BRAIN_URL = "https://brain.aperai.eu"
PULSE_ORG_SLUG = "your-org-slug"
```

VS Code / Antigravity (`.vscode/mcp.json`):

```json
{
  "servers": {
    "pulse": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:aperAI-eu/pulse-client"],
      "env": {
        "PULSE_API_URL": "https://test-pulse.aperai.eu",
        "PULSE_API_KEY": "pk_your_api_key"
      }
    }
  }
}
```

Config files containing `PULSE_API_KEY` should be gitignored.

### Org Brain auth

The Pulse-hosted Brain uses Pulse organization login, not legacy Cortex Basic auth.
Users open the org Brain URL and sign in with their Pulse email and password:

```text
https://brain.aperai.eu/<org-slug>/brain
```

For example, Nyvium uses:

```text
https://brain.aperai.eu/nyvium/brain
```

New MCP configs should use `PULSE_BRAIN_URL` and `PULSE_ORG_SLUG` only as
discoverability hints for agents. Do not set `CORTEX_USER` or `CORTEX_PASS` for
the Pulse-hosted org Brain. Those variables are only for an old standalone Brain
server that still exposes `/api/wiki` and `/api/chat` behind Basic auth.

### Option B: Local clone

Clone this repo as a sibling to your projects:

```bash
cd ~/projects
git clone https://github.com/aperAI-eu/pulse-client.git
cd pulse-client
npm install && npm run build
cp pulse.config.example.json pulse.config.json
# Edit pulse.config.json with your credentials
```

Then each project can use an MCP config without secrets.

Claude Code:

```json
{
  "mcpServers": {
    "pulse": {
      "command": "node",
      "args": ["../pulse-client/dist/index.js"]
    }
  }
}
```

Codex:

```bash
codex mcp add pulse -- node ../pulse-client/dist/index.js
```

VS Code / Antigravity:

```json
{
  "servers": {
    "pulse": {
      "type": "stdio",
      "command": "node",
      "args": ["../pulse-client/dist/index.js"]
    }
  }
}
```

The MCP server reads credentials from `pulse-client/pulse.config.json` at startup.

### Restart your agent

After config changes, restart Claude Code, Codex, or your IDE. MCP tools are loaded at startup.

## MCP Tools

### File-based tools

- `init_project` creates `.pulse/project.yml` and `tasks.yml`
- `read_tasks` lists tasks with filters
- `create_task` adds a task
- `update_task` changes status, priority, or assignee

### Pulse API tools

- `list_pulse_projects` lists projects in your org
- `get_project_context` returns project details, tasks, and statuses
- `register_project` creates a project in Pulse
- `configure_git_sync` stores the git token and creates the webhook
- `verify_setup` performs an end-to-end check
- `create_wiki_page` adds knowledge to Pulse DB wiki
- `add_comment` adds a comment to a task

### Cortex bridge tools

The Pulse-hosted org Brain is primarily browser/session based. These tools are
available for legacy standalone Cortex deployments that still expose the old
Basic-auth API:

- `cortex_list_wiki` lists Cortex wiki pages
- `cortex_read_wiki` reads a wiki page
- `cortex_write_wiki` writes knowledge to Cortex memory
- `cortex_chat` sends a message to Cortex

### Auth guidance tool

- `describe_pulse_auth_setup` explains the current org-based auth model and
  flags legacy `CORTEX_USER`/`CORTEX_PASS` env vars when present.

## How it works

```text
Your project
|-- .pulse/               YAML source of truth
|   |-- project.yml
|   |-- tasks.yml
|   `-- tasks/*.yml
|-- .claude/settings.json Claude Code MCP config, gitignored
`-- ~/.codex/config.toml  Codex MCP config, global and secret-bearing

Flow:
  git push -> GitHub webhook -> Pulse syncs DB from .pulse/
  UI drag in Pulse -> DB update -> git writer -> commits with [pulse] prefix
  MCP tools in agent -> Pulse API -> task management
  Brain URL -> Pulse org login -> organization Brain with persistent memory
```

## Troubleshooting

- "Pulse tools not available": restart your agent or IDE. MCP configs are loaded at startup.
- "Webhook did not fire": check GitHub repo Settings > Webhooks > Recent Deliveries.
- "Tasks not appearing": check `.pulse/tasks.yml` is valid YAML and statuses match `project.yml`.
- "Brain auth confusion": call `describe_pulse_auth_setup`. For Pulse-hosted
  Brain, remove `CORTEX_USER` and `CORTEX_PASS`, keep `PULSE_API_URL`,
  `PULSE_API_KEY`, and optionally set `PULSE_BRAIN_URL` + `PULSE_ORG_SLUG`.
- "Legacy Cortex not responding": if you intentionally use standalone Cortex,
  verify `CORTEX_URL`, `CORTEX_USER`, and `CORTEX_PASS`.

## License

MIT
