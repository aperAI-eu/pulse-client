# Pulse Client

MCP server + setup wizard for [Pulse](https://test-pulse.aperai.eu) — AI-powered project management with a **Cortex** agent that has persistent wiki memory.

This repo is the entry point for adding any project to Pulse.

## What you get

After setup, your project has:
- **Kanban board** in Pulse (tasks, statuses, phases)
- **Git-native tracking** — `.pulse/` YAML files are the source of truth, bidirectional sync with the web UI
- **Cortex integration** — the org's AI agent indexes your codebase and can work on tasks assigned to it
- **MCP tools** in Claude Code / VS Code / Antigravity to manage tasks, wiki, and talk to Cortex

## Prerequisites

- A Git repository (GitHub) for your project
- A Pulse instance URL + API key (ask your org admin)
- Node.js 20+ installed
- Claude Code (or any IDE with MCP support: VS Code, Antigravity, Cursor, etc.)
- Optional: Cortex credentials (for the org's AI agent bridge)

## Quickstart (fool-proof wizard)

In your project repo, copy the setup skill:

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

Then in Claude Code:
```
> /pulse-setup
```

The wizard handles everything:
1. Configures the MCP server (asks for Pulse URL + API key + optional Cortex credentials)
2. Creates `.pulse/project.yml` + `.pulse/tasks.yml`
3. Registers the project in Pulse
4. Sets up git sync + auto-creates the GitHub webhook
5. Indexes your codebase for Cortex (generates wiki pages)
6. Verifies everything works

## Manual install (no wizard)

### Option A — npx from GitHub (simplest)

Add to your IDE's MCP config. For **Claude Code** (`.claude/settings.json`):
```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "github:aperAI-eu/pulse-client"],
      "env": {
        "PULSE_API_URL": "https://test-pulse.aperai.eu",
        "PULSE_API_KEY": "pk_your_api_key",
        "CORTEX_URL": "https://brain.aperai.eu",
        "CORTEX_USER": "your_username",
        "CORTEX_PASS": "your_password"
      }
    }
  }
}
```

For **VS Code / Antigravity** (`.vscode/mcp.json`):
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

Both files should be gitignored (they contain secrets).

### Option B — Local clone (recommended for teams)

Clone this repo as a sibling to your projects:
```bash
cd ~/projects
git clone https://github.com/aperAI-eu/pulse-client.git
cd pulse-client
npm install && npm run build
cp pulse.config.example.json pulse.config.json
# Edit pulse.config.json with your credentials
```

Then in each of your projects, MCP configs can be **committed without secrets**:

`.claude/settings.json`:
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

`.vscode/mcp.json`:
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

### Restart your IDE

After config, restart (Ctrl+Shift+P → "Reload Window"). All Pulse and Cortex MCP tools will appear.

## MCP Tools

### File-based (edits local `.pulse/` YAML)
- `init_project` — create `.pulse/project.yml` + `tasks.yml`
- `read_tasks` — list tasks with filters
- `create_task` — add a task
- `update_task` — change status/priority/assignee

### Pulse API (cloud)
- `list_pulse_projects` — projects in your org
- `get_project_context` — project details + tasks + statuses
- `register_project` — create project in Pulse (wizard)
- `configure_git_sync` — set git token + auto-create webhook (wizard)
- `verify_setup` — end-to-end check (wizard)
- `create_wiki_page` — add knowledge to Pulse DB wiki
- `add_comment` — add comment to a task

### Cortex bridge (the org's AI agent)
- `cortex_list_wiki` — see what Cortex knows
- `cortex_read_wiki` — read a wiki page from Cortex's memory
- `cortex_write_wiki` — write knowledge to Cortex's wiki
- `cortex_chat` — send a message to Cortex (full CLI power, persistent memory)

## How it works

```
Your project (local)
├── .pulse/              ← YAML source of truth (git-tracked)
│   ├── project.yml
│   ├── tasks.yml
│   └── tasks/*.yml
├── .claude/settings.json  ← Claude Code MCP config
└── .vscode/mcp.json     ← VS Code / Antigravity MCP config

Flow:
  git push → GitHub webhook → Pulse syncs DB from .pulse/
  UI drag in Pulse → DB update → git writer → commits [pulse] prefix
  MCP tools in IDE → Pulse API → task management
  cortex_chat → brain.aperai.eu → Claude Code CLI on agent server
```

## Troubleshooting

- **"Pulse tools not available"** — Restart your IDE. Configs are loaded at startup.
- **"Webhook didn't fire"** — Check GitHub repo → Settings → Webhooks → Recent Deliveries.
- **"Tasks not appearing"** — Check `.pulse/tasks.yml` is valid YAML. Statuses must match `project.yml`.
- **"Cortex not responding"** — Verify CORTEX_URL is reachable and credentials are correct.

## License

MIT
