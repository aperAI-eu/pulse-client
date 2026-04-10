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
