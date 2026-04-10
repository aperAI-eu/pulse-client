import { z } from "zod";

// ─── Status Definition ───────────────────────────────────────────

export const pulseStatusSchema = z.object({
  name: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6b7280"),
  order: z.number().int().min(0),
  isFinal: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});
export type PulseStatus = z.infer<typeof pulseStatusSchema>;

// ─── Phase Definition ────────────────────────────────────────────

export const pulsePhaseSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100), // kebab-case slug, used as filename
  order: z.number().int().min(0),
});
export type PulsePhase = z.infer<typeof pulsePhaseSchema>;

// ─── Task Definition ─────────────────────────────────────────────

export const pulseTaskSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  status: z.string().default("NOT_STARTED"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assignee: z.string().optional(),         // email or identifier
  dueDate: z.string().optional(),          // ISO date string
  startDate: z.string().optional(),
  description: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
  isLongLead: z.boolean().default(false),
  leadTimeDays: z.number().int().optional(),
});
export type PulseTask = z.infer<typeof pulseTaskSchema>;

// ─── Project File (project.yml) ──────────────────────────────────

export const pulseProjectFileSchema = z.object({
  version: z.number().int().default(1),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  repo: z.string().optional(),             // "owner/repo"
  statuses: z.array(pulseStatusSchema).min(1),
  phases: z.array(pulsePhaseSchema).default([]),
});
export type PulseProjectFile = z.infer<typeof pulseProjectFileSchema>;

// ─── Task File (tasks.yml or tasks/<phase>.yml) ──────────────────

export const pulseTaskFileSchema = z.object({
  phase: z.string().optional(),            // phase category — omit for unphased tasks
  tasks: z.array(pulseTaskSchema).default([]),
});
export type PulseTaskFile = z.infer<typeof pulseTaskFileSchema>;

// ─── Full Project State (all files combined) ─────────────────────

export interface PulseProjectState {
  project: PulseProjectFile;
  taskFiles: PulseTaskFile[];              // one per file (tasks.yml + tasks/*.yml)
}
