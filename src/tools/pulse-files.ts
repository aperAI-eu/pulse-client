import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";

// Default SW Dev template statuses
const DEFAULT_STATUSES = [
  { name: "NOT_STARTED", label: "Not Started", color: "#6b7280", order: 1, isFinal: false, isDefault: true },
  { name: "SPECIFYING", label: "Specifying", color: "#8b5cf6", order: 2, isFinal: false, isDefault: false },
  { name: "DESIGNING", label: "Designing", color: "#6366f1", order: 3, isFinal: false, isDefault: false },
  { name: "IN_PROGRESS", label: "In Progress", color: "#3b82f6", order: 4, isFinal: false, isDefault: false },
  { name: "IN_REVIEW", label: "In Review", color: "#f59e0b", order: 5, isFinal: false, isDefault: false },
  { name: "TESTING", label: "Testing", color: "#f97316", order: 6, isFinal: false, isDefault: false },
  { name: "BLOCKED", label: "Blocked", color: "#ef4444", order: 7, isFinal: false, isDefault: false },
  { name: "DONE", label: "Done", color: "#22c55e", order: 8, isFinal: true, isDefault: false },
  { name: "CANCELLED", label: "Cancelled", color: "#9ca3af", order: 9, isFinal: true, isDefault: false },
];

function getPulseDir(): string {
  return path.join(process.cwd(), ".pulse");
}

export function registerFileTools(server: McpServer) {

  // ─── init_project ──────────────────────────────────────────────

  server.tool(
    "init_project",
    "Create .pulse/ directory with project.yml and tasks.yml from a template. Run this in the repo root.",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
      repo: z.string().optional().describe("GitHub repo in owner/repo format"),
      template: z.string().optional().describe("Template name (default: SW Development)"),
    },
    async ({ name, description, repo }) => {
      const pulseDir = getPulseDir();

      if (fs.existsSync(path.join(pulseDir, "project.yml"))) {
        return { content: [{ type: "text" as const, text: "Error: .pulse/project.yml already exists. Use read_tasks to view existing tasks." }] };
      }

      // Create directories
      fs.mkdirSync(path.join(pulseDir, "tasks"), { recursive: true });

      // Write project.yml
      const projectData = {
        version: 1,
        name,
        description: description || undefined,
        repo: repo || undefined,
        statuses: DEFAULT_STATUSES,
        phases: [],
      };
      fs.writeFileSync(path.join(pulseDir, "project.yml"), YAML.stringify(projectData, { indent: 2 }));

      // Write empty tasks.yml
      fs.writeFileSync(path.join(pulseDir, "tasks.yml"), YAML.stringify({ tasks: [] }, { indent: 2 }));

      return {
        content: [{
          type: "text" as const,
          text: `Created .pulse/ directory with project "${name}".\n\nFiles:\n- .pulse/project.yml (${DEFAULT_STATUSES.length} statuses)\n- .pulse/tasks.yml (empty)\n- .pulse/tasks/ (for phase-specific task files)\n\nNext: use create_task to add tasks, then git commit + push.`,
        }],
      };
    }
  );

  // ─── read_tasks ────────────────────────────────────────────────

  server.tool(
    "read_tasks",
    "Read all tasks from .pulse/ YAML files in the current repo.",
    {
      status: z.string().optional().describe("Filter by status"),
      phase: z.string().optional().describe("Filter by phase category"),
    },
    async ({ status, phase }) => {
      const pulseDir = getPulseDir();
      if (!fs.existsSync(path.join(pulseDir, "project.yml"))) {
        return { content: [{ type: "text" as const, text: "No .pulse/project.yml found. Run init_project first." }] };
      }

      const tasks: { code: string; name: string; status: string; priority: string; phase?: string; assignee?: string }[] = [];

      // Read root tasks.yml
      const rootPath = path.join(pulseDir, "tasks.yml");
      if (fs.existsSync(rootPath)) {
        const data = YAML.parse(fs.readFileSync(rootPath, "utf-8"));
        for (const t of data?.tasks || []) {
          if (status && t.status !== status) continue;
          if (phase) continue; // root tasks have no phase
          tasks.push({ code: t.code, name: t.name, status: t.status, priority: t.priority || "MEDIUM", assignee: t.assignee });
        }
      }

      // Read tasks/*.yml
      const tasksDir = path.join(pulseDir, "tasks");
      if (fs.existsSync(tasksDir)) {
        for (const file of fs.readdirSync(tasksDir)) {
          if (!file.endsWith(".yml")) continue;
          const data = YAML.parse(fs.readFileSync(path.join(tasksDir, file), "utf-8"));
          const phaseCategory = data?.phase || file.replace(".yml", "");
          if (phase && phaseCategory !== phase) continue;
          for (const t of data?.tasks || []) {
            if (status && t.status !== status) continue;
            tasks.push({ code: t.code, name: t.name, status: t.status, priority: t.priority || "MEDIUM", phase: phaseCategory, assignee: t.assignee });
          }
        }
      }

      const summary = tasks.map(t =>
        `${t.code}: ${t.name} [${t.status}] ${t.phase ? `(${t.phase})` : ""} ${t.assignee ? `@${t.assignee}` : ""}`
      ).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: tasks.length > 0 ? `${tasks.length} task(s):\n\n${summary}` : "No tasks found.",
        }],
      };
    }
  );

  // ─── update_task ───────────────────────────────────────────────

  server.tool(
    "update_task",
    "Update a task's status, priority, or assignee in the .pulse/ YAML files.",
    {
      code: z.string().describe("Task code (e.g., AUTH-01)"),
      status: z.string().optional().describe("New status"),
      priority: z.string().optional().describe("New priority (LOW, MEDIUM, HIGH, CRITICAL)"),
      assignee: z.string().optional().describe("Assignee email"),
    },
    async ({ code, status: newStatus, priority, assignee }) => {
      const pulseDir = getPulseDir();
      const files = [
        { path: path.join(pulseDir, "tasks.yml"), isRoot: true },
        ...fs.existsSync(path.join(pulseDir, "tasks"))
          ? fs.readdirSync(path.join(pulseDir, "tasks")).filter(f => f.endsWith(".yml")).map(f => ({ path: path.join(pulseDir, "tasks", f), isRoot: false }))
          : [],
      ];

      for (const file of files) {
        if (!fs.existsSync(file.path)) continue;
        const raw = fs.readFileSync(file.path, "utf-8");
        const data = YAML.parse(raw);
        const tasks = data?.tasks as { code: string; status?: string; priority?: string; assignee?: string }[] || [];
        const idx = tasks.findIndex(t => t.code === code);
        if (idx === -1) continue;

        if (newStatus) tasks[idx].status = newStatus;
        if (priority) tasks[idx].priority = priority;
        if (assignee !== undefined) tasks[idx].assignee = assignee || undefined;

        fs.writeFileSync(file.path, YAML.stringify(data, { indent: 2 }));

        const changes = [newStatus && `status → ${newStatus}`, priority && `priority → ${priority}`, assignee !== undefined && `assignee → ${assignee || "unassigned"}`].filter(Boolean).join(", ");
        return {
          content: [{
            type: "text" as const,
            text: `Updated ${code}: ${changes}\n\nRemember to git commit and push for changes to sync to Pulse.`,
          }],
        };
      }

      return { content: [{ type: "text" as const, text: `Task ${code} not found in .pulse/ files.` }] };
    }
  );

  // ─── create_task ───────────────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task in .pulse/ YAML files.",
    {
      code: z.string().describe("Task code (e.g., AUTH-01, BUG-05)"),
      name: z.string().describe("Task name"),
      phase: z.string().optional().describe("Phase category (creates tasks/<phase>.yml if needed)"),
      status: z.string().optional().describe("Initial status (default: NOT_STARTED)"),
      priority: z.string().optional().describe("Priority (default: MEDIUM)"),
      assignee: z.string().optional().describe("Assignee email"),
      description: z.string().optional().describe("Task description"),
    },
    async ({ code, name, phase, status: initialStatus, priority, assignee, description }) => {
      const pulseDir = getPulseDir();
      if (!fs.existsSync(path.join(pulseDir, "project.yml"))) {
        return { content: [{ type: "text" as const, text: "No .pulse/project.yml found. Run init_project first." }] };
      }

      const task: Record<string, unknown> = {
        code,
        name,
        status: initialStatus || "NOT_STARTED",
        priority: priority || "MEDIUM",
      };
      if (assignee) task.assignee = assignee;
      if (description) task.description = description;
      task.dependsOn = [];

      let filePath: string;
      if (phase) {
        filePath = path.join(pulseDir, "tasks", `${phase}.yml`);
        fs.mkdirSync(path.join(pulseDir, "tasks"), { recursive: true });
      } else {
        filePath = path.join(pulseDir, "tasks.yml");
      }

      let data: { phase?: string; tasks: Record<string, unknown>[] };
      if (fs.existsSync(filePath)) {
        data = YAML.parse(fs.readFileSync(filePath, "utf-8")) || { tasks: [] };
        if (!data.tasks) data.tasks = [];
      } else {
        data = { tasks: [] };
        if (phase) data.phase = phase;
      }

      // Check duplicate
      if (data.tasks.some(t => t.code === code)) {
        return { content: [{ type: "text" as const, text: `Task ${code} already exists in ${phase || "root"} tasks.` }] };
      }

      data.tasks.push(task);
      fs.writeFileSync(filePath, YAML.stringify(data, { indent: 2 }));

      return {
        content: [{
          type: "text" as const,
          text: `Created task ${code}: "${name}" in ${phase ? `phase ${phase}` : "ungrouped tasks"}.\n\nRemember to git commit and push for changes to sync to Pulse.`,
        }],
      };
    }
  );
}
