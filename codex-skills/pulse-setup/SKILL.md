---
name: pulse-setup
description: Set up or repair Pulse project management integration from Codex. Use when the user asks to connect a repository to Pulse, install the Pulse MCP server, configure Pulse or Cortex tools for Codex, initialize .pulse project files, sync Pulse tasks, or index the repository wiki for Cortex.
---

# Pulse Setup

Guide the user through connecting the current git repository to Pulse from Codex. Pulse provides a Kanban board, git-backed `.pulse/` task files, an MCP server, and optional Cortex wiki/chat tools.

## Phase 0: Configure MCP

Check whether the `pulse` MCP server is already available.

1. Run `codex mcp list` and look for `pulse`.
2. If `pulse` is missing, collect:
   - Pulse URL, default `https://test-pulse.aperai.eu`
   - Pulse API key, which starts with `pk_`
   - Optional Pulse-hosted Brain URL, default `https://brain.aperai.eu`
   - Optional Pulse organization slug, for example `nyvium`
3. Add the server with Codex CLI:

```powershell
codex mcp add pulse `
  --env PULSE_API_URL="<pulse-url>" `
  --env PULSE_API_KEY="<pulse-api-key>" `
  --env PULSE_BRAIN_URL="<brain-url>" `
  --env PULSE_ORG_SLUG="<org-slug>" `
  -- npx -y github:aperAI-eu/pulse-client
```

Omit the Brain environment variables when Brain is not configured. Do not add
`CORTEX_USER` or `CORTEX_PASS` for the Pulse-hosted org Brain; those are legacy
standalone Brain Basic-auth credentials only.

If `pulse` exists but has stale credentials, remove and re-add it:

```powershell
codex mcp remove pulse
```

Then add it again with the command above.

Tell the user to restart Codex after changing MCP configuration, then run setup again. Stop after this phase because the new MCP tools are loaded on restart.

## Phase 1: Verify Pulse

After restart, call `list_pulse_projects`.

- If it works, summarize the org and visible projects.
- If auth fails, ask the user to verify the Pulse API key in Pulse Admin > API Keys.
- If connection fails, check the URL and whether Pulse is reachable.
- If `describe_pulse_auth_setup` is available, call it and report whether the
  agent is using the current Pulse org auth model or stale `CORTEX_USER` /
  `CORTEX_PASS` variables.

## Phase 2: Initialize Files

Check whether `.pulse/project.yml` exists.

- If it exists, read it and ask whether to keep it or re-initialize.
- If it is missing, use `init_project`.

Detect the project name from `package.json`, the first README heading, then the directory name. Ask the user to confirm the name and optional description. Use the default SW Development template and suggest initial tasks from TODO/FIXME comments, obvious setup gaps, and open spec/task files.

## Phase 3: Register Project

Call `list_pulse_projects` and look for a matching project name or repo URL.

- If found, ask whether to link to the existing project.
- If not found, call `register_project` with the confirmed name, description, and repo URL from `git remote get-url origin`.

Save the returned project ID for the remaining steps.

## Phase 4: Configure Git Sync

Ask for a GitHub personal access token. Show this URL:

`https://github.com/settings/tokens/new?scopes=repo&description=Pulse+sync`

Explain that private repos need `repo`; public repos can use `public_repo`. The token is stored encrypted in Pulse.

Call `configure_git_sync` with the project ID and token. If webhook creation fails, tell the user to create a GitHub webhook manually:

- Payload URL: `{PULSE_URL}/api/webhooks/github`
- Content type: `application/json`
- Events: pushes

## Phase 5: First Sync

Commit and push the `.pulse/` files:

```powershell
git add .pulse/
git commit -m "Initialize Pulse project management"
git push
```

Wait briefly, then call `verify_setup` with the project ID. Show the Pulse project URL if verification succeeds.

## Phase 6: Index Wiki

Read the important project context:

- `README.md` or `README`
- package and dependency files such as `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, or `Cargo.toml`
- agent instructions such as `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or `.github/copilot-instructions.md`
- `.pulse/project.yml`
- top-level source directories such as `src/`, `app/`, or `lib/`
- `docs/` or `documentation/`
- `.env.example` or `.env.template`
- deployment/config files such as `docker-compose.yml`, `Dockerfile`, `vite.config.*`, `next.config.*`, or `tsconfig.json`

Create Pulse wiki pages with `create_wiki_page`:

- `project-overview`, category `entity`
- `architecture`, category `entity`
- `conventions`, category `concept`
- `dependencies`, category `entity`
- `decisions`, category `decision`

If legacy standalone Cortex API credentials are configured, also write the same
knowledge to Cortex with `cortex_write_wiki` under `{project-name}/`, then update
`index.md` to link the new project pages.

For Pulse-hosted org Brain, the Pulse wiki pages are already the organization
Brain's knowledge source.

## Phase 7: Verify Cortex

If legacy standalone Cortex API credentials are configured:

1. Call `cortex_list_wiki`.
2. Read `{project-name}/overview.md`.
3. Call `cortex_chat` with `What do you know about {project-name}?`

If Pulse-hosted org Brain is configured, verify the browser URL:

`{PULSE_BRAIN_URL}/{PULSE_ORG_SLUG}/brain`

Tell the user to sign in with their Pulse email/password and organization.

If Brain is not configured, tell the user they can add `PULSE_BRAIN_URL` and
`PULSE_ORG_SLUG` later by re-adding the Codex MCP server.

## Completion Message

Finish with:

- Pulse board URL
- Number of wiki pages created
- Whether git sync is active
- Whether Pulse-hosted Brain URL is configured
- Useful next actions: manage tasks in Pulse, use `read_tasks` and `update_task`, open the org Brain URL, or assign a task to the Pulse agent
