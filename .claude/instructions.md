# Pulse Project Management

This project uses [Pulse](https://github.com/aperAI-eu/pulse-client) for task tracking. Task state lives in `.pulse/` YAML files in this repo — Git is the source of truth.

## How it works

- **`.pulse/project.yml`** — project metadata, statuses, phases
- **`.pulse/tasks.yml`** — ungrouped tasks
- **`.pulse/tasks/<phase>.yml`** — tasks grouped by feature/epic

When you push `.pulse/` changes to the main branch, a webhook syncs them to the Pulse web UI. Changes made in the web UI are committed back to Git.

## Task YAML format (STRICT — follow exactly)

Every task MUST use these exact field names:

```yaml
tasks:
  - code: FEAT-01          # REQUIRED — unique task identifier (use: code, NOT id)
    name: Implement feature X  # REQUIRED — task title (use: name, NOT title)
    status: NOT_STARTED    # REQUIRED — must match a project status
    priority: MEDIUM       # LOW | MEDIUM | HIGH | CRITICAL
    description: Details   # optional
    assignee: user@email   # optional — email address
    dependsOn: [FEAT-00]   # optional — array of task codes
    dueDate: "2026-05-01"  # optional — ISO date
    tags: [area, type]     # optional
```

**IMPORTANT field names:**
- Use `code:` (NOT `id:`)
- Use `name:` (NOT `title:`)
- Use `status:` with exact status names from project.yml
- Use `priority:` with exact values: LOW, MEDIUM, HIGH, CRITICAL

**ALWAYS use the MCP tools** (`create_task`, `update_task`) when available — they guarantee correct format. Only edit YAML manually if MCP tools are not loaded.

### Statuses (workflow stages)
NOT_STARTED → SPECIFYING → DESIGNING → IN_PROGRESS → IN_REVIEW → TESTING → DONE

### Task codes
Use a prefix that identifies the area: `AUTH-01`, `API-02`, `BUG-03`, `INFRA-04`

## Rules for AI agents

1. **Use MCP tools first** — `create_task`, `update_task` guarantee correct YAML format
2. **Always commit .pulse/ changes** — don't leave task edits uncommitted
3. **Use meaningful task codes** — prefix by area, increment the number
4. **Use `code:` and `name:` fields** — NEVER use `id:` or `title:` (sync will fail)
5. **Update task status when you complete work** — move to DONE when verified
6. **One file per phase** — keeps merge conflicts minimal between agents
7. **Don't edit project.yml** unless adding a new phase or status
