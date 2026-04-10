---
name: pulse-setup
description: Set up Pulse project management for this repo. Creates .pulse/ files, configures MCP server, and syncs to Pulse.
---

# /pulse-setup — Onboard this project to Pulse

You are setting up Pulse project management for the user's repository. Follow these steps carefully, asking the user for input at each stage.

## Prerequisites

Before starting, verify:
1. This is a git repository (`git rev-parse --git-dir`)
2. There is a remote configured (`git remote -v`)
3. The user has a Pulse admin account (they need this to generate an API key)

If any prerequisite fails, explain what's needed and stop.

## Process

### Step 1: Check existing setup

Check if `.pulse/project.yml` already exists:
- If YES: ask the user if they want to reconfigure or skip setup
- If NO: continue

Check if `.claude/settings.json` exists and already has a `pulse` MCP server configured:
- If YES: ask if they want to update the configuration
- If NO: we'll create it

### Step 2: Collect Pulse credentials

Ask the user:

1. **"What is your Pulse server URL?"**
   - Example: `https://test-pulse.aperai.eu`
   - Must be HTTPS
   - Validate by calling `GET <url>/api/v1/projects` (expect 401 — this confirms the server is reachable)

2. **"What is your Pulse API key?"**
   - They generate this at `<pulse-url>/admin/api-keys`
   - Format: starts with `pk_`
   - Validate by calling `GET <url>/api/v1/projects` with `Authorization: Bearer <key>` header
   - Must return 200 (confirms key is valid)

If validation fails, explain the error and ask them to check their credentials.

### Step 3: Configure MCP server

Add the Pulse MCP server to `.claude/settings.json` (project-level, NOT global):

```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "@aperai/pulse-mcp"],
      "env": {
        "PULSE_API_URL": "<their-url>",
        "PULSE_API_KEY": "<their-key>"
      }
    }
  }
}
```

If the file already exists, merge the `pulse` entry into existing `mcpServers`.

**Important**: `.claude/settings.json` should be in `.gitignore` since it contains the API key.

### Step 4: Initialize .pulse/ project files

Ask the user:
1. **"What should we call this project?"** (default: repo name from git remote)
2. **"Short description?"** (optional)

Detect the repo URL from `git remote get-url origin` and convert to `owner/repo` format.

Create `.pulse/project.yml` with:
- The project name and description
- The repo in `owner/repo` format
- Default SW Development statuses (9 statuses from NOT_STARTED to CANCELLED)
- Empty phases array

Create `.pulse/tasks.yml` with an empty tasks array.

Create `.pulse/tasks/` directory for future phase-specific task files.

### Step 5: Scan for existing work (optional)

Ask: **"Should I scan the codebase for existing tasks, TODOs, and issues?"**

If yes:
1. Read `CLAUDE.md` or `README.md` for project context
2. Search for `TODO`, `FIXME`, `HACK` comments in source files
3. Check if there's a GitHub issues link and mention it
4. Propose a list of tasks based on findings
5. Ask user to confirm which tasks to create
6. Create confirmed tasks in `.pulse/tasks.yml`

If no: skip.

### Step 6: Commit and push

Ask: **"Ready to commit .pulse/ files and push? This will create the project in Pulse."**

If yes:
```bash
git add .pulse/
git commit -m "Add Pulse project tracking (.pulse/ files)"
git push
```

The push triggers a webhook on the Pulse server that auto-creates the project and syncs all tasks.

### Step 7: Verify

Wait a few seconds, then verify:
- Call `GET <pulse-url>/api/v1/projects` with the API key
- Look for the project name in the response
- If found: show the user a success message with the project URL
- If not found: explain that the webhook may need to be configured (provide instructions)

### GitHub Webhook Setup (if needed)

If the project doesn't appear after push, the webhook may not be configured. Instruct the user:

1. Go to `https://github.com/<owner>/<repo>/settings/hooks/new`
2. Payload URL: `<pulse-url>/api/webhooks/github`
3. Content type: `application/json`
4. Secret: (they need to get this from their Pulse admin)
5. Events: Just the push event
6. Active: checked

After configuring, push again or trigger a re-delivery.

## After setup

Tell the user:
- "Your project is now tracked in Pulse. You can view it at `<pulse-url>`"
- "To create tasks: edit `.pulse/tasks.yml` or use the Pulse MCP tools"
- "Task changes committed and pushed will automatically sync to Pulse"
- "Changes made in the Pulse web UI will be committed back to your repo"
- "Install the `/pulse-sync` skill for manual sync commands"
