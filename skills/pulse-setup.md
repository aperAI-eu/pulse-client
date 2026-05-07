# Pulse Setup Wizard

You are guiding the user through connecting their project to Pulse, a project management system with AI-powered task tracking, wiki knowledge base, and an optional Cortex agent that can work on tasks autonomously.

The user may arrive with nothing configured. Start from Phase 0.

## Phase 0: Self-configure MCP

Check if the `pulse` MCP server is available by looking for pulse tools such as `list_pulse_projects`.

If pulse tools are not available, configure them for Claude Code and, when installed, Codex.

1. Check if `.claude/settings.json` exists in this project. Read it if so.

2. Ask the user these questions:
   - Pulse URL: "What is your Pulse instance URL?" Default: `https://test-pulse.aperai.eu`
   - API key: "Do you have a Pulse API key? If not, log in to your Pulse instance > Admin > API Keys > create one. It starts with `pk_`."
   - Cortex URL: "Does your org have a Cortex agent server? If yes, what is its URL?" Example: `https://brain.aperai.eu`. If no, skip Cortex config.
   - Cortex credentials: If Cortex URL was provided, ask for the Cortex username and password.

3. Write or merge this into `.claude/settings.json`:

```json
{
  "mcpServers": {
    "pulse": {
      "command": "npx",
      "args": ["-y", "github:aperAI-eu/pulse-client"],
      "env": {
        "PULSE_API_URL": "<user's URL>",
        "PULSE_API_KEY": "<user's key>",
        "CORTEX_URL": "<cortex URL, if provided>",
        "CORTEX_USER": "<cortex username, if provided>",
        "CORTEX_PASS": "<cortex password, if provided>"
      }
    }
  }
}
```

Omit the `CORTEX_*` env vars entirely if the user does not have Cortex.

4. If the `codex` CLI is available, configure Codex too. Use `codex mcp list` to check whether a `pulse` server already exists. If it does not exist, run:

```bash
codex mcp add pulse \
  --env PULSE_API_URL="<user's URL>" \
  --env PULSE_API_KEY="<user's key>" \
  --env CORTEX_URL="<cortex URL, if provided>" \
  --env CORTEX_USER="<cortex username, if provided>" \
  --env CORTEX_PASS="<cortex password, if provided>" \
  -- npx -y github:aperAI-eu/pulse-client
```

Omit every `CORTEX_*` flag if Cortex is not configured.

If Codex already has a stale `pulse` server, tell the user you can refresh it by running:

```bash
codex mcp remove pulse
```

Then add it again with the command above.

5. Tell the user: "MCP configured. Please restart Claude Code and Codex, then run this setup again."

6. Stop here. The MCP server will not be available until the tools restart.

If pulse tools are available, skip to Step 1.

## Step 1: Connect to Pulse

Call `list_pulse_projects` to verify the connection.

- If it works, show the org name and existing projects. Continue to Step 2.
- If it fails with auth error, the API key is wrong or expired. Ask the user to check it in Pulse > Admin > API Keys.
- If it fails with connection error, the URL is wrong or Pulse is down.

## Step 2: Initialize .pulse files

Check if `.pulse/project.yml` already exists in this repo.

If it exists, read it, show the user what is there, and ask if they want to re-initialize or keep it. If keeping, skip to Step 3.

If it does not exist, use the `init_project` tool:

- Detect the project name from `package.json` name, README first heading, then directory name.
- Ask the user to confirm the name and optionally add a description.
- Use the SW Development template with default statuses.
- Scan the codebase for TODOs, FIXMEs, and open issues. Suggest initial tasks.
- Let the user confirm or edit the task list before creating tasks.

## Step 3: Register project in Pulse

Check if this repo is already registered by calling `list_pulse_projects` and looking for a matching name or repo URL.

If already registered, show the project ID and ask if the user wants to link to it or create a new one.

If not registered, use `register_project`:

- Pass the project name and description from Step 2.
- Detect repo URL from `git remote get-url origin`.
- Strip `.git` suffix and extract `owner/repo` when useful.
- Save the returned project ID for subsequent steps.

Tell the user: "Project registered in Pulse. ID: {id}"

## Step 4: Configure Git sync

Ask the user for a GitHub Personal Access Token.

Show this URL:

`https://github.com/settings/tokens/new?scopes=repo&description=Pulse+sync`

Explain that the token lets Pulse read the repo and sync tasks bidirectionally. It needs `repo` for private repos or `public_repo` for public repos. Reassure the user that the token is stored encrypted per project in Pulse.

Use `configure_git_sync` with the project ID and token.

If webhook creation fails, explain how to add it manually:

- Go to GitHub > repo > Settings > Webhooks > Add webhook.
- URL: `{PULSE_URL}/api/webhooks/github`
- Content type: `application/json`
- Secret: generate one and set it in Pulse project settings.
- Events: pushes only.

## Step 5: First sync

Commit and push the `.pulse/` files:

```bash
git add .pulse/
git commit -m "Initialize Pulse project management"
git push
```

Wait 5 seconds for the webhook to fire, then call `verify_setup` with the project ID.

Show the results. If sync succeeded, tell the user their Pulse project URL.

If sync failed, troubleshoot:

- Webhook not firing: check the GitHub webhook delivery log.
- Tasks not appearing: check that `.pulse/tasks.yml` has valid YAML.
- Statuses not matching: check that `project.yml` status names match task statuses.

## Step 6: Index project for Cortex

Tell the user: "Now I'll scan your codebase so Cortex has knowledge about this project from day one."

Read these files, skipping any that do not exist:

- `README.md` or `README`
- `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, or `pyproject.toml`
- `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or `.github/copilot-instructions.md`
- `.pulse/project.yml`
- Directory listing of `src/`, `app/`, or `lib/` to two levels
- `docs/` or `documentation/`
- `.env.example` or `.env.template`
- `docker-compose.yml` or `Dockerfile`
- `tsconfig.json`, `next.config.js`, `vite.config.ts`, or equivalent config

From what you read, generate wiki pages using `create_wiki_page` with the project ID:

1. `project-overview`, category `entity`: what the project is, what problem it solves, who it is for, current state, and key URLs.
2. `architecture`, category `entity`: tech stack, key directories, entry points, and data flow.
3. `conventions`, category `concept`: code style, naming, file organization, and testing approach.
4. `dependencies`, category `entity`: external services, APIs, libraries, and infrastructure.
5. `decisions`, category `decision`: architecture decisions, trade-offs, and technical debt found in docs or code.

Tell the user how many wiki pages were created and what they cover.

If Cortex is configured, also write each wiki page to Cortex using `cortex_write_wiki` under `{project-name}/`, then update Cortex's `index.md` to include the new project section.

## Step 7: Verify Cortex connection

If Cortex is configured:

1. Call `cortex_list_wiki` and confirm the new project pages appear.
2. Call `cortex_read_wiki` with path `{project-name}/overview.md` and confirm content matches.
3. Call `cortex_chat` with message: `What do you know about {project-name}?`

If any fail, tell the user what went wrong and how to fix it, usually by checking `CORTEX_URL`, `CORTEX_USER`, or `CORTEX_PASS`.

If Cortex is not configured, skip this step and tell the user:

"Cortex is not configured for this project. To connect later, add CORTEX_URL, CORTEX_USER, and CORTEX_PASS to your Pulse MCP env vars."

## Done

Tell the user:

```text
Setup complete!

Kanban board: {pulse_url}/projects/{id}
Cortex has indexed {n} wiki pages about your project
Git sync is active - changes in .pulse files sync both ways
MCP tools are configured for Claude Code and Codex where available
Cortex bridge is active - use cortex_chat, cortex_read_wiki, cortex_write_wiki

What you can do now:
- Open the Kanban board to see and manage your tasks
- Assign a task to Cortex in Pulse to have the agent work on it autonomously
- Ask Cortex about your project: cortex_chat "What is {project-name}?"
- Chat with Cortex via the Brain PWA at {cortex_url}
- Use read_tasks and update_task tools from Claude Code or Codex
- Share knowledge with Cortex: cortex_write_wiki to update the shared wiki
```
