---
name: pulse-setup
description: Set up Pulse project management for this repo. Creates .pulse/ files, configures MCP server, sets up webhook, and syncs to Pulse.
---

# /pulse-setup — Onboard this project to Pulse

You are setting up Pulse project management for the user's repository. Follow these steps carefully, asking the user for input at each stage. Do NOT skip steps or assume answers.

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

Ask the user for TWO things:

1. **"What is your Pulse server URL?"**
   - Example: `https://test-pulse.aperai.eu`
   - Must be HTTPS
   - Validate by calling `GET <url>/api/v1/projects` (expect 401 — confirms server is reachable)

2. **"What is your Pulse API key?"**
   - They generate this at `<pulse-url>/admin/api-keys` in the Pulse web UI
   - Format: starts with `pk_`
   - Validate by calling `GET <url>/api/v1/projects` with `Authorization: Bearer <key>` header
   - Must return 200 (confirms key is valid)

If validation fails, explain the error and help them troubleshoot:
- 401 = invalid or expired API key → regenerate at admin panel
- Connection refused = wrong URL or server down
- Certificate error = HTTPS issue

### Step 3: Configure MCP server

Create or update `.claude/settings.json` (project-level, NOT global):

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

If the file already exists, merge the `pulse` entry into existing `mcpServers`. Preserve other servers.

**Important**: Verify `.claude/settings.json` is in `.gitignore` (it contains the API key). If not, add it:
```
# Add to .gitignore
.claude/settings.json
```

### Step 4: Initialize .pulse/ project files

Ask the user:
1. **"What should we call this project?"** (default: repo name from git remote)
2. **"Short description?"** (optional)

Detect the repo URL from `git remote get-url origin`:
- Extract `owner/repo` format (e.g., `aperAI-eu/seevee` from `https://github.com/aperAI-eu/seevee.git`)

Create `.pulse/project.yml` with:
- The project name and description
- The repo in `owner/repo` format
- Default SW Development statuses (9 statuses: NOT_STARTED through CANCELLED)
- Empty phases array

Create `.pulse/tasks.yml` with an empty tasks array.

Create `.pulse/tasks/` directory for future phase-specific task files.

### Step 5: Scan for existing work (optional)

Ask: **"Should I scan the codebase for existing tasks, TODOs, and issues?"**

If yes:
1. Read `CLAUDE.md` or `README.md` for project context
2. Search for `TODO`, `FIXME`, `HACK` comments in source files
3. Propose a list of tasks based on findings
4. Ask user to confirm which tasks to create
5. Create confirmed tasks in `.pulse/tasks.yml`

If no: skip.

### Step 6: Commit and push

Ask: **"Ready to commit .pulse/ files and push?"**

If yes:
```bash
git add .pulse/ .gitignore
git commit -m "Add Pulse project tracking (.pulse/ files)"
git push
```

### Step 7: Enable Git sync on the project

After push, the webhook (if configured) auto-creates the project. But we also need to ensure git sync is enabled.

Call the Pulse API to find and update the project:

```bash
# Find the project by name
curl -s -H "Authorization: Bearer <api-key>" <pulse-url>/api/v1/projects
```

If the project exists but `gitSyncEnabled` is false or `repoUrl` is null, inform the user:

> "The project exists in Pulse but git sync needs to be enabled. Please go to your project in Pulse → Overview → scroll to Git Sync settings → enter the repo URL and enable sync."

If the project doesn't exist yet, it will be auto-created when the webhook is configured (next step).

### Step 8: Configure GitHub webhook

**This is critical for automatic sync.** Walk the user through it step by step:

Tell the user:

> "Now we need to configure a GitHub webhook so Pulse automatically syncs when you push changes. This is a one-time setup per repo."

Ask: **"What is the GitHub webhook secret for your Pulse server?"**
- They get this from their Pulse server admin (it's the `GITHUB_WEBHOOK_SECRET` environment variable)
- If they don't know it, tell them to ask their Pulse admin or check the server's `.env` file

Then give them **exact instructions** with their specific values filled in:

> **Go to:** `https://github.com/<owner>/<repo>/settings/hooks/new`
>
> Fill in:
> 1. **Payload URL:** `<pulse-url>/api/webhooks/github`
> 2. **Content type:** `application/json`
> 3. **Secret:** `<the webhook secret they provided>`
> 4. **Which events:** Select "Just the push event"
> 5. **Active:** ✅ checked
>
> Click **"Add webhook"**

Wait for the user to confirm they've done this.

### Step 9: Test the sync

After webhook is configured, trigger a test:

```bash
# Make a small change and push
git commit --allow-empty -m "Test Pulse webhook sync"
git push
```

Then verify:
```bash
curl -s -H "Authorization: Bearer <api-key>" <pulse-url>/api/v1/projects | grep -i "<project-name>"
```

If the project appears with tasks — success!

If not, help troubleshoot:
- Check webhook delivery at `https://github.com/<owner>/<repo>/settings/hooks` — click the webhook → "Recent Deliveries"
- 200 response = webhook received, check if `.pulse/` files were in the push
- 401 = wrong webhook secret
- 404/500 = server issue

### Step 10: Final summary

Show the user a complete summary:

```
✅ Pulse Setup Complete

Configuration:
- MCP server: configured in .claude/settings.json
- Project files: .pulse/project.yml + .pulse/tasks.yml
- Git sync: enabled
- Webhook: configured at <repo-url>

Your project is live at: <pulse-url> (project: "<name>")

How to use:
- Create tasks: edit .pulse/tasks.yml or use MCP tools (create_task)
- Update tasks: change status in YAML, commit + push
- View in browser: <pulse-url> → Projects → <name>
- Kanban board: <pulse-url> → Projects → <name> → Board tab
- Wiki: use init_wiki MCP tool to start a project wiki

Task changes pushed to git will auto-sync to Pulse.
Changes in the Pulse web UI will be committed back to your repo.
```

## Troubleshooting

If anything goes wrong during setup:

**"API key doesn't work"**
→ Go to `<pulse-url>/admin/api-keys`, create a new key. Copy it immediately — it's only shown once.

**"Webhook not firing"**
→ Check the webhook secret matches. Check Recent Deliveries on GitHub. Verify the Pulse server is accessible from the internet.

**"Project not appearing in Pulse"**
→ Verify `.pulse/project.yml` was pushed. Check that `gitSyncEnabled` is true and `repoUrl` matches on the project. Try a re-push.

**"Can't access admin/api-keys"**
→ You need ADMIN role in your Pulse organization. Ask your org admin to grant access or create a key for you.
