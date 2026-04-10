import { z } from "zod";

// ─── Wiki Config (wiki.yml) ─────────────────────────────────────

export const wikiConfigSchema = z.object({
  version: z.number().int().default(1),
  categories: z.array(z.string()).default(["entity", "concept", "decision", "source", "synthesis"]),
  conventions: z.object({
    page_naming: z.string().default("kebab-case"),
    frontmatter_required: z.array(z.string()).default(["title", "category", "created", "updated"]),
    link_format: z.string().default("[[page-name]]"),
    confidence_levels: z.array(z.string()).default(["low", "medium", "high", "verified"]),
  }).optional(),
  auto_ingest: z.object({
    on_document_upload: z.boolean().default(true),
    on_meeting_transcript: z.boolean().default(true),
    on_task_completion: z.boolean().default(true),
    on_chat_insight: z.boolean().default(true),
  }).optional(),
});
export type WikiConfig = z.infer<typeof wikiConfigSchema>;

// ─── Page Frontmatter ────────────────────────────────────────────

export const wikiPageFrontmatterSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["entity", "concept", "decision", "source", "synthesis"]),
  created: z.string(), // ISO date
  updated: z.string(), // ISO date
  sources: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  contributors: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high", "verified"]).default("medium"),
});
export type WikiPageFrontmatter = z.infer<typeof wikiPageFrontmatterSchema>;

// ─── Parsed Wiki Page ────────────────────────────────────────────

export interface WikiPage {
  slug: string;           // kebab-case filename without .md
  category: string;       // subdirectory name
  frontmatter: WikiPageFrontmatter;
  content: string;        // markdown body (without frontmatter)
  filePath: string;       // relative path from .pulse/
}

// ─── Index Entry ─────────────────────────────────────────────────

export interface WikiIndexEntry {
  slug: string;
  title: string;
  category: string;
  summary: string;        // one-line description
  updated: string;
}

// ─── Log Entry ───────────────────────────────────────────────────

export interface WikiLogEntry {
  date: string;           // ISO date
  type: "ingest" | "query" | "lint" | "create" | "update";
  title: string;
  details?: string;
  contributor?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatFrontmatter(fm: WikiPageFrontmatter): string {
  const lines = [
    "---",
    `title: ${fm.title}`,
    `category: ${fm.category}`,
    `created: ${fm.created}`,
    `updated: ${fm.updated}`,
  ];
  if (fm.sources.length) lines.push(`sources: [${fm.sources.join(", ")}]`);
  if (fm.related.length) lines.push(`related: [${fm.related.join(", ")}]`);
  if (fm.tags.length) lines.push(`tags: [${fm.tags.join(", ")}]`);
  if (fm.contributors.length) lines.push(`contributors: [${fm.contributors.join(", ")}]`);
  lines.push(`confidence: ${fm.confidence}`);
  lines.push("---");
  return lines.join("\n");
}

export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fmBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Parse arrays: [a, b, c]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

export function formatLogEntry(entry: WikiLogEntry): string {
  const parts = [`## [${entry.date}] ${entry.type} | ${entry.title}`];
  if (entry.details) parts.push(entry.details);
  if (entry.contributor) parts.push(`_by ${entry.contributor}_`);
  return parts.join("\n");
}

export function formatIndexEntry(entry: WikiIndexEntry): string {
  return `- [${entry.title}](wiki/${entry.category}/${entry.slug}.md) — ${entry.summary}`;
}
