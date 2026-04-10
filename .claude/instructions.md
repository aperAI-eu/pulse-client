# Pulse Project Management

This project uses [Pulse](https://github.com/aperAI-eu/pulse-client) for task tracking. Task state lives in `.pulse/` YAML files in this repo — Git is the source of truth.

## How it works

- **`.pulse/project.yml`** — project metadata, statuses, phases
- **`.pulse/tasks.yml`** — ungrouped tasks
- **`.pulse/tasks/<phase>.yml`** — tasks grouped by feature/epic

When you push `.pulse/` changes to the main branch, a webhook syncs them to the Pulse web UI. Changes made in the web UI are committed back to Git.

## Working with tasks

### Creating a task
Edit the appropriate YAML file and add a task entry:
```yaml
- code: FEAT-01
  name: Implement feature X
  status: NOT_STARTED
  priority: MEDIUM
```

Or use the MCP tool: `create_task`

### Updating a task
Change the `status` field in the YAML and commit:
```yaml
- code: FEAT-01
  status: IN_PROGRESS  # was NOT_STARTED
```

Or use the MCP tool: `update_task`

### Statuses (workflow stages)
NOT_STARTED → SPECIFYING → DESIGNING → IN_PROGRESS → IN_REVIEW → TESTING → DONE

### Task codes
Use a prefix that identifies the area: `AUTH-01`, `API-02`, `BUG-03`, `INFRA-04`

## Rules for AI agents

1. **Always commit .pulse/ changes** — don't leave task edits uncommitted
2. **Use meaningful task codes** — prefix by area, increment the number
3. **Update task status when you complete work** — move to DONE when verified
4. **One file per phase** — keeps merge conflicts minimal between agents
5. **Don't edit project.yml** unless adding a new phase or status
