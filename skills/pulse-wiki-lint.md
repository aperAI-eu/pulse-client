---
name: pulse-wiki-lint
description: Health-check the project wiki. Find orphan pages, missing cross-links, contradictions, stale content, and knowledge gaps.
---

# /pulse-wiki-lint — Wiki Health Check

You are performing a maintenance pass on the project's `.pulse/wiki/` knowledge base. This is Karpathy's "lint" operation — systematic quality improvement.

## Process

### Step 1: Read the wiki

1. Read `wiki/index.md` to get the full page inventory
2. Read `wiki/log.md` to understand recent activity
3. Read each page listed in the index

### Step 2: Check for issues

For each page, check:

**Orphan pages** — pages not linked from any other page
- Scan all `[[page-name]]` links across all pages
- If a page has zero inbound links (except from index), it's an orphan

**Missing cross-links** — pages that should reference each other but don't
- If page A mentions a concept that has its own page B, but doesn't link to B → suggest adding `[[page-b]]`

**Stale content** — pages that may be outdated
- Compare `updated` date to recent log entries
- If significant activity happened after a page was last updated, it may need revision

**Contradictions** — pages that disagree with each other
- Look for conflicting claims across pages (e.g., "we use JWT" vs "we use sessions")
- Flag with specific quotes from both pages

**Missing pages** — concepts referenced but not having their own page
- If multiple pages reference "deployment pipeline" but no page exists for it → suggest creating one

**Knowledge gaps** — important project areas with no wiki coverage
- Compare wiki content against `.pulse/tasks.yml` and `.pulse/project.yml`
- Major project areas without wiki pages are gaps

### Step 3: Report findings

Present findings organized by severity:

```
## Wiki Health Report

### Critical (contradictions)
- ...

### Important (missing pages, knowledge gaps)
- ...

### Suggestions (orphans, missing links, stale content)
- ...
```

### Step 4: Fix (with confirmation)

For each finding, propose a fix:
- **Orphan pages**: add links from relevant pages
- **Missing cross-links**: add `[[page-name]]` links
- **Stale content**: read recent sources and update the page
- **Missing pages**: create the page with available knowledge
- **Contradictions**: research which claim is correct, update the wrong page

Ask the user: "Should I apply these fixes?"

If yes, use `create_wiki_page` and `update_wiki_page` tools to make changes. Commit all changes together.
