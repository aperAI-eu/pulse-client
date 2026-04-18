import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function getApiConfig(): { url: string; key: string } {
  const url = process.env.PULSE_API_URL;
  const key = process.env.PULSE_API_KEY;
  if (!url || !key) throw new Error("PULSE_API_URL and PULSE_API_KEY must be set");
  return { url: url.replace(/\/$/, ""), key };
}

async function pulseApi(path: string, options?: RequestInit): Promise<Response> {
  const { url, key } = getApiConfig();
  return fetch(`${url}/api/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

export function registerApiTools(server: McpServer) {

  // ─── get_project_context ───────────────────────────────────────

  server.tool(
    "get_project_context",
    "Get project details, tasks, and statuses from Pulse API. Requires PULSE_API_URL and PULSE_API_KEY env vars.",
    {
      projectId: z.string().describe("Pulse project ID"),
    },
    async ({ projectId }) => {
      try {
        const [projRes, tasksRes, statusesRes] = await Promise.all([
          pulseApi(`/projects/${projectId}`),
          pulseApi(`/projects/${projectId}/tasks`),
          pulseApi(`/projects/${projectId}/statuses`),
        ]);

        if (!projRes.ok) {
          return { content: [{ type: "text" as const, text: `Error fetching project: ${projRes.status} ${await projRes.text()}` }] };
        }

        const project = await projRes.json();
        const tasks = tasksRes.ok ? await tasksRes.json() : [];
        const statuses = statusesRes.ok ? await statusesRes.json() : [];

        const taskSummary = (tasks as { templateCode: string; name: string; status: string; phase?: { name: string } }[])
          .map(t => `${t.templateCode || "?"}: ${t.name} [${t.status}] ${t.phase?.name ? `(${t.phase.name})` : ""}`)
          .join("\n");

        const statusList = (statuses as { name: string; label: string; isFinal: boolean }[])
          .map(s => `${s.name}: ${s.label}${s.isFinal ? " (final)" : ""}`)
          .join(", ");

        return {
          content: [{
            type: "text" as const,
            text: `Project: ${project.name}\nDescription: ${project.description || "—"}\nRepo: ${project.repoUrl || "—"}\nGit sync: ${project.gitSyncEnabled ? "active" : "inactive"}\n\nStatuses: ${statusList}\n\nTasks (${tasks.length}):\n${taskSummary || "No tasks"}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `API error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── add_comment ───────────────────────────────────────────────

  server.tool(
    "add_comment",
    "Add a comment to a task via Pulse API. Requires PULSE_API_URL and PULSE_API_KEY.",
    {
      projectId: z.string().describe("Pulse project ID"),
      taskId: z.string().describe("Pulse task ID"),
      content: z.string().describe("Comment content"),
      category: z.string().optional().describe("Category: question, risk, recommendation, action_item"),
    },
    async ({ projectId, taskId, content, category }) => {
      try {
        const res = await pulseApi(`/projects/${projectId}/tasks/${taskId}/comments`, {
          method: "POST",
          body: JSON.stringify({ content, category }),
        });

        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Error: ${res.status} ${await res.text()}` }] };
        }

        const comment = await res.json();
        return {
          content: [{
            type: "text" as const,
            text: `Comment added to task ${taskId}${category ? ` (${category})` : ""}. ID: ${comment.id}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `API error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── register_project ──────────────────────────────────────────

  server.tool(
    "register_project",
    "Create a new project in Pulse. Returns the project ID. Use this during setup to register a repo with Pulse.",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
      repoUrl: z.string().optional().describe("GitHub repo in owner/repo format"),
    },
    async ({ name, description, repoUrl }) => {
      try {
        const res = await pulseApi("/projects", {
          method: "POST",
          body: JSON.stringify({ name, description, repoUrl }),
        });

        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Error: ${res.status} ${await res.text()}` }] };
        }

        const project = await res.json();
        return {
          content: [{
            type: "text" as const,
            text: `Project created!\nID: ${project.id}\nName: ${project.name}\n\nNext: configure git sync with configure_git_sync tool.`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `API error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── configure_git_sync ───────────────────────────────────────

  server.tool(
    "configure_git_sync",
    "Configure git sync for a project: set GitHub token, enable sync, and auto-create webhook. Run after register_project.",
    {
      projectId: z.string().describe("Pulse project ID"),
      gitToken: z.string().describe("GitHub personal access token with repo scope"),
    },
    async ({ projectId, gitToken }) => {
      try {
        // Set git token and enable sync
        const patchRes = await pulseApi(`/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({ gitToken, gitSyncEnabled: true }),
        });

        if (!patchRes.ok) {
          return { content: [{ type: "text" as const, text: `Error setting token: ${patchRes.status} ${await patchRes.text()}` }] };
        }

        // Auto-create webhook
        const hookRes = await pulseApi(`/projects/${projectId}/setup-webhook`, {
          method: "POST",
        });

        if (!hookRes.ok) {
          const err = await hookRes.text();
          return { content: [{ type: "text" as const, text: `Git token saved but webhook creation failed: ${hookRes.status} ${err}\n\nYou may need to create the webhook manually in GitHub repo settings.` }] };
        }

        const hook = await hookRes.json();
        return {
          content: [{
            type: "text" as const,
            text: `Git sync configured!\n- Token: saved\n- Sync: enabled\n- Webhook: created at ${hook.webhookUrl}\n\nNext: commit and push .pulse/ files, then run verify_setup.`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `API error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── verify_setup ─────────────────────────────────────────────

  server.tool(
    "verify_setup",
    "Verify that a project is properly set up in Pulse: check sync, tasks, and statuses.",
    {
      projectId: z.string().describe("Pulse project ID"),
    },
    async ({ projectId }) => {
      try {
        // Trigger a sync
        const syncRes = await pulseApi(`/projects/${projectId}/sync`, { method: "POST" });
        const syncResult = syncRes.ok ? await syncRes.json() : { error: await syncRes.text() };

        // Check project state
        const projRes = await pulseApi(`/projects/${projectId}`);
        const project = projRes.ok ? await projRes.json() : null;

        const tasksRes = await pulseApi(`/projects/${projectId}/tasks`);
        const tasks = tasksRes.ok ? await tasksRes.json() : [];

        const checks = [
          `Project: ${project ? `${project.name} ✓` : "✗ not found"}`,
          `Repo: ${project?.repoUrl ? `${project.repoUrl} ✓` : "✗ not configured"}`,
          `Git sync: ${project?.gitSyncEnabled ? "enabled ✓" : "✗ disabled"}`,
          `Sync result: ${syncResult.ok ? "success ✓" : `✗ ${syncResult.error || "failed"}`}`,
          `Tasks: ${(tasks as unknown[]).length} found`,
          `Statuses: ${project?.statuses?.length || 0} configured`,
        ];

        const pulseUrl = getApiConfig().url;
        return {
          content: [{
            type: "text" as const,
            text: `Setup verification:\n\n${checks.join("\n")}\n\nPulse URL: ${pulseUrl}/projects/${projectId}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Verification error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── create_wiki_page ─────────────────────────────────────────

  server.tool(
    "create_wiki_page",
    "Create or update a wiki page for Cortex (the org's AI). Used during project indexing to build knowledge.",
    {
      projectId: z.string().describe("Pulse project ID"),
      slug: z.string().describe("Page slug (kebab-case, e.g., 'project-overview')"),
      title: z.string().describe("Page title"),
      category: z.string().optional().describe("Category: entity, concept, decision, source, synthesis. Default: entity"),
      content: z.string().describe("Full markdown content"),
    },
    async ({ projectId, slug, title, category, content }) => {
      try {
        const res = await pulseApi(`/projects/${projectId}/wiki`, {
          method: "POST",
          body: JSON.stringify({ slug, title, category: category || "entity", content }),
        });

        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Error: ${res.status} ${await res.text()}` }] };
        }

        const page = await res.json();
        return {
          content: [{
            type: "text" as const,
            text: `Wiki page saved: "${page.title}" (${page.slug})`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `API error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── list_projects ─────────────────────────────────────────────

  server.tool(
    "list_pulse_projects",
    "List all projects in your Pulse organization. Requires PULSE_API_URL and PULSE_API_KEY.",
    {},
    async () => {
      try {
        const res = await pulseApi("/projects");
        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Error: ${res.status} ${await res.text()}` }] };
        }

        const projects = await res.json() as { id: string; name: string; status: string; _count: { tasks: number } }[];
        const list = projects.map(p => `${p.id}: ${p.name} [${p.status}] (${p._count.tasks} tasks)`).join("\n");

        return {
          content: [{
            type: "text" as const,
            text: projects.length > 0 ? `${projects.length} project(s):\n\n${list}` : "No projects found.",
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `API error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );
}
