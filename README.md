# Pulse Client

MCP server + setup wizard for [Pulse](https://pulse.aperai.eu) project management.

Track your project's tasks in Git (`.pulse/` YAML files) and sync them to the Pulse web UI automatically.

## Prerequisites

- A Git repository with a remote
- A Pulse admin account (ask your org admin for access)
- An API key generated at `https://<your-pulse-url>/admin/api-keys`
- [Claude Code](https://claude.ai/claude-code) IDE extension

## Quick Start

### Option 1: Setup wizard (recommended)

Copy the setup skill to your project:

```bash
mkdir -p .claude/commands
curl -o .claude/commands/pulse-setup.md https://raw.githubusercontent.com/aperAI-eu/pulse-client/main/skills/pulse-setup.md
```

Then in Claude Code:
```
> /pulse-setup
```

The wizard will guide you through configuration, create `.pulse/` files, and sync to Pulse.

### Option 2: Manual setup

1. **Configure MCP server** in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "@aperai/pulse-mcp"],
      "env": {
        "PULSE_API_URL": "https://your-pulse-instance.com",
        "PULSE_API_KEY": "pk_your_api_key_here"
      }
    }
  }
}
```

2. **Initialize project** (in Claude Code):
```
Use the init_project MCP tool to create .pulse/ files
```

3. **Commit and push**:
```bash
git add .pulse/
git commit -m "Add Pulse project tracking"
git push
```

The push triggers a webhook that auto-creates the project in Pulse.

## MCP Tools

### File-based (edits local `.pulse/` YAML)

| Tool | Description |
|------|-------------|
| `init_project` | Create `.pulse/` directory with project config |
| `read_tasks` | List all tasks from YAML files |
| `create_task` | Add a new task |
| `update_task` | Change task status, priority, or assignee |

### API-based (calls Pulse server)

| Tool | Description |
|------|-------------|
| `get_project_context` | Get project details + tasks + comments |
| `add_comment` | Add a comment to a task |
| `list_pulse_projects` | List all projects in your org |

## `.pulse/` File Format

### `project.yml`
```yaml
version: 1
name: My Project
repo: myorg/my-project
statuses:
  - name: NOT_STARTED
    label: Not Started
    color: "#6b7280"
    order: 1
    isDefault: true
  # ... more statuses
phases: []  # optional groupings (epics/features)
```

### `tasks.yml`
```yaml
tasks:
  - code: AUTH-01
    name: Implement login
    status: IN_PROGRESS
    priority: HIGH
    assignee: dev@example.com
    dependsOn: [SETUP-01]
```

## How sync works

```
You edit .pulse/ YAML → git push → GitHub webhook → Pulse DB updated → Pulse web UI shows changes
Pulse web UI change → Pulse commits [pulse] prefixed change → your repo updated
```

## License

MIT
