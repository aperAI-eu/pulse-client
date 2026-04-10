---
name: pulse-sync
description: Manually sync .pulse/ tasks with Pulse server. Use after editing task files or to check sync status.
---

# /pulse-sync — Sync tasks with Pulse

You are helping the user sync their local `.pulse/` task files with the Pulse server.

## When to use

- After editing `.pulse/tasks.yml` or `.pulse/tasks/*.yml` manually
- To verify the current sync state
- To pull updates from the Pulse web UI (if someone changed tasks there)

## Process

### Check state

1. Verify `.pulse/project.yml` exists
2. Check if there are uncommitted changes to `.pulse/` files: `git status .pulse/`
3. Read the current tasks from `.pulse/` files

### If there are local changes (uncommitted .pulse/ edits)

Ask: **"You have uncommitted changes to .pulse/ files. Commit and push to sync?"**

If yes:
```bash
git add .pulse/
git commit -m "[pulse] sync task updates"
git push
```

The push triggers the webhook which syncs to Pulse DB.

### If everything is committed and pushed

Tell the user: "All .pulse/ changes are committed and pushed. Pulse should be up to date."

If they suspect sync issues, suggest:
1. Check the Pulse web UI for the project
2. Verify the GitHub webhook is configured and delivering
3. Check webhook delivery history at `https://github.com/<owner>/<repo>/settings/hooks`

### Show current task summary

Read all `.pulse/` task files and display a summary:
- Total tasks by status
- Any tasks assigned to the current user
- Recently changed tasks (if git log shows recent .pulse/ changes)
