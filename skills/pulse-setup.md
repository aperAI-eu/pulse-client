# Pulse Setup Wizard

You are guiding the user through connecting their project to Pulse — a project management system with AI-powered task tracking, wiki knowledge base, and a Claude Code agent (Cortex) that can work on tasks autonomously.

The user may arrive with NOTHING configured. Start from Phase 0.

## Phase 0: Self-configure MCP

Check if the `pulse` MCP server is available by looking for pulse tools (like `list_pulse_projects`).

**If pulse tools are NOT available**, you need to configure them:

1. Check if `.claude/settings.json` exists in this project. Read it if so.

2. Ask the user these questions:
   - **Pulse URL**: "What is your Pulse instance URL?" (default: `https://test-pulse.aperai.eu`)
   - **API Key**: "Do you have a Pulse API key? If not, log in to your Pulse instance → Admin → API Keys → create one. It starts with `pk_`."
   - **Cortex URL**: "Does your org have a Cortex (Claude agent server)? If yes, what is its URL?" (e.g., `https://brain.aperai.eu`). If no, skip Cortex config — the user can add it later.
   - **Cortex credentials**: If Cortex URL was provided: "What is the Cortex username and password?" (basicauth credentials for the brain PWA)

3. Write (or merge into) `.claude/settings.json`:
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
   
   Omit the CORTEX_* env vars entirely if the user doesn't have a Cortex.

4. Tell the user: "MCP configured. Please restart Claude Code (Ctrl+Shift+P → Reload Window in VS Code, or restart the CLI) and run this setup again."

5. **STOP HERE.** The MCP server won't be available until Claude Code restarts. Do not proceed to Step 1.

**If pulse tools ARE available**, skip to Step 1.

## Step 1: Connect to Pulse

Call `list_pulse_projects` to verify the connection.

- If it works: show the org name and existing projects. Continue to Step 2.
- If it fails with auth error: the API key is wrong or expired. Ask the user to check it in Pulse → Admin → API Keys.
- If it fails with connection error: the URL is wrong or Pulse is down.

## Step 2: Initialize .pulse/ files

Check if `.pulse/project.yml` already exists in this repo.

**If it exists**: read it, show the user what's there, ask if they want to re-initialize or keep it. If keeping, skip to Step 3.

**If it doesn't exist**: use the `init_project` tool:

- Detect the project name from (in order): `package.json` name field, `README.md` first heading, directory name
- Ask the user to confirm the name and optionally add a description
- Use the "SW Development" template (default statuses)
- Scan the codebase for TODOs, FIXMEs, open issues — suggest initial tasks
- Let the user confirm/edit the task list before creating them

## Step 3: Register project in Pulse

Check if this repo is already registered: call `list_pulse_projects` and look for a matching name or repoUrl.

**If already registered**: show the project ID and ask if the user wants to link to it or create a new one.

**If not registered**: use `register_project`:
- Pass the project name and description from Step 2
- Detect repoUrl from `git remote get-url origin` (strip `.git` suffix, extract `owner/repo`)
- Save the returned project ID — you'll need it for all subsequent steps

Tell the user: "Project registered in Pulse! ID: {id}"

## Step 4: Configure Git sync

Ask the user for a **GitHub Personal Access Token**:
- Show them the URL: `https://github.com/settings/tokens/new?scopes=repo&description=Pulse+sync`
- Explain: "This token lets Pulse read your repo and sync tasks bidirectionally. It needs the `repo` scope for private repos, or `public_repo` for public ones."
- Reassure: "The token is stored encrypted per-project in Pulse. It's never shared."

Use `configure_git_sync` with the project ID and token.

This will:
- Save the token to the project
- Enable git sync
- Auto-create a GitHub webhook (so pushes trigger Pulse sync)

If webhook creation fails (e.g., token doesn't have admin:repo_hook scope), tell the user how to add it manually:
- Go to GitHub → repo → Settings → Webhooks → Add webhook
- URL: `{PULSE_URL}/api/webhooks/github`
- Content type: `application/json`
- Secret: (tell them to generate one and set it in Pulse project settings)
- Events: Just pushes

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
- "Webhook not firing?" → check GitHub webhook delivery log
- "Tasks not appearing?" → check that `.pulse/tasks.yml` has valid YAML
- "Statuses not matching?" → check `project.yml` status names match task statuses

## Step 6: Index project for Cortex

Tell the user: "Now I'll scan your codebase so Cortex (the org's AI) has knowledge about this project from day one."

Read these files (skip any that don't exist):
- `README.md` or `README`
- `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` / `pyproject.toml`
- `CLAUDE.md` or `.cursorrules` or `.github/copilot-instructions.md`
- `.pulse/project.yml`
- Directory listing of `src/` or `app/` or `lib/` (top 2 levels)
- `docs/` or `documentation/` directory (list + read key files)
- `.env.example` or `.env.template`
- `docker-compose.yml` or `Dockerfile`
- `tsconfig.json` / `next.config.js` / `vite.config.ts` / equivalent config

From what you read, generate wiki pages using `create_wiki_page` (use the project ID from Step 3):

1. **`project-overview`** (category: entity)
   - What this project is, what problem it solves, who it's for
   - Current state (alpha/beta/production)
   - Key URLs (live site, staging, docs)

2. **`architecture`** (category: entity)
   - Tech stack (language, framework, database, hosting)
   - Key directories and what they contain
   - Entry points (main server file, app router, CLI entry)
   - Data flow (request → handler → DB → response)

3. **`conventions`** (category: concept)
   - Code style (detected from config or patterns)
   - Naming conventions (files, functions, components)
   - File organization patterns
   - Testing approach (if tests exist)

4. **`dependencies`** (category: entity)
   - External services and APIs used
   - Key libraries and their purpose
   - Infrastructure (database, cache, queues, storage)

5. **`decisions`** (category: decision)
   - Architecture decisions found in docs, CLAUDE.md, comments
   - Why certain technologies were chosen (if documented)
   - Known trade-offs or technical debt mentioned

Tell the user how many wiki pages were created and what they cover.

**If Cortex is configured** (CORTEX_URL was provided in Phase 0):

Also write each wiki page to Cortex's local wiki using `cortex_write_wiki`. This ensures Cortex has the knowledge both in Pulse DB (for the Brain web chat) and on disk (for CLI sessions). Use the project name as a subdirectory:
- `cortex_write_wiki` with path `{project-name}/overview.md` → content of project-overview
- `cortex_write_wiki` with path `{project-name}/architecture.md` → content of architecture
- etc.

Then update Cortex's `index.md` to include the new project section:
1. Read current index: `cortex_read_wiki` path `index.md`
2. Append the new project's pages to it
3. Write back: `cortex_write_wiki` path `index.md`

## Step 7: Verify Cortex connection

**If Cortex is configured**, verify the bridge works:

1. Call `cortex_list_wiki` — confirm the new project's pages appear
2. Call `cortex_read_wiki` with path `{project-name}/overview.md` — confirm content matches
3. Call `cortex_chat` with message: "What do you know about {project-name}?" — Cortex should answer using the just-indexed wiki pages

If any of these fail, tell the user what went wrong and how to fix it (usually CORTEX_URL/CORTEX_PASS misconfigured).

**If Cortex is NOT configured**, skip this step. Tell the user:
"Cortex is not configured for this project. To connect later, add CORTEX_URL, CORTEX_USER, and CORTEX_PASS to your MCP env vars."

## Done!

Tell the user:

```
Setup complete!

📋 Kanban board: {pulse_url}/projects/{id}
🧠 Cortex has indexed {n} wiki pages about your project
🔄 Git sync is active — changes in .pulse/ files sync both ways
🛠️ MCP tools are configured — you can manage tasks from Claude Code
🔗 Cortex bridge is active — use cortex_chat, cortex_read_wiki, cortex_write_wiki

What you can do now:
- Open the kanban board to see and manage your tasks
- Assign a task to "Claude" in Pulse to have Cortex work on it autonomously
- Ask Cortex about your project: cortex_chat "What is {project-name}?"
- Chat with Cortex via the Brain PWA at {cortex_url}
- Use read_tasks and update_task tools right here in Claude Code
- Share knowledge with Cortex: cortex_write_wiki to update the shared wiki
```
