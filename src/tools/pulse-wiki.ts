import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import {
  toSlug,
  formatFrontmatter,
  parseFrontmatter,
  formatLogEntry,
  formatIndexEntry,
  type WikiPageFrontmatter,
  type WikiIndexEntry,
  type WikiLogEntry,
} from "../schema/wiki-schema.js";

function getWikiDir(): string {
  return path.join(process.cwd(), ".pulse", "wiki");
}

function getWikiConfigPath(): string {
  return path.join(process.cwd(), ".pulse", "wiki.yml");
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function registerWikiTools(server: McpServer) {

  // ─── init_wiki ─────────────────────────────────────────────────

  server.tool(
    "init_wiki",
    "Initialize .pulse/wiki/ directory with config, empty index, and log. Run this after init_project.",
    {},
    async () => {
      const wikiDir = getWikiDir();
      const configPath = getWikiConfigPath();

      if (fs.existsSync(path.join(wikiDir, "index.md"))) {
        return { content: [{ type: "text" as const, text: "Wiki already initialized. Use create_wiki_page to add pages." }] };
      }

      // Create directories
      for (const cat of ["entities", "concepts", "decisions", "sources", "synthesis"]) {
        fs.mkdirSync(path.join(wikiDir, cat), { recursive: true });
      }

      // Write wiki.yml config
      const config = {
        version: 1,
        categories: ["entity", "concept", "decision", "source", "synthesis"],
        conventions: {
          page_naming: "kebab-case",
          frontmatter_required: ["title", "category", "created", "updated"],
          link_format: "[[page-name]]",
          confidence_levels: ["low", "medium", "high", "verified"],
        },
        auto_ingest: {
          on_document_upload: true,
          on_meeting_transcript: true,
          on_task_completion: true,
          on_chat_insight: true,
        },
      };
      fs.writeFileSync(configPath, YAML.stringify(config, { indent: 2 }));

      // Write empty index.md
      const indexContent = `# Wiki Index

_This index is maintained by the LLM. Each page is listed with a one-line summary._

## Entities

## Concepts

## Decisions

## Sources

## Synthesis
`;
      fs.writeFileSync(path.join(wikiDir, "index.md"), indexContent);

      // Write log.md
      const logContent = `# Wiki Log

_Append-only chronicle of ingests, queries, and maintenance._

${formatLogEntry({ date: today(), type: "create", title: "Wiki initialized", contributor: "pulse-setup" })}
`;
      fs.writeFileSync(path.join(wikiDir, "log.md"), logContent);

      return {
        content: [{
          type: "text" as const,
          text: `Wiki initialized at .pulse/wiki/\n\nCreated:\n- wiki.yml (config)\n- wiki/index.md (empty index)\n- wiki/log.md (chronicle)\n- wiki/entities/, concepts/, decisions/, sources/, synthesis/ (category dirs)\n\nNext: use create_wiki_page to add knowledge pages. Commit and push to sync.`,
        }],
      };
    }
  );

  // ─── create_wiki_page ──────────────────────────────────────────

  server.tool(
    "create_wiki_page",
    "Create a new wiki page with YAML frontmatter. Automatically updates index.md and log.md.",
    {
      title: z.string().describe("Page title (e.g., 'User Authentication System')"),
      category: z.enum(["entity", "concept", "decision", "source", "synthesis"]).describe("Page category"),
      content: z.string().describe("Markdown content (body, without frontmatter)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      sources: z.array(z.string()).optional().describe("Source page slugs this was derived from"),
      related: z.array(z.string()).optional().describe("Related page slugs to cross-link"),
      confidence: z.enum(["low", "medium", "high", "verified"]).optional().describe("Confidence level"),
      summary: z.string().optional().describe("One-line summary for the index"),
    },
    async ({ title, category, content, tags, sources, related, confidence, summary }) => {
      const wikiDir = getWikiDir();
      if (!fs.existsSync(path.join(wikiDir, "index.md"))) {
        return { content: [{ type: "text" as const, text: "Wiki not initialized. Run init_wiki first." }] };
      }

      const slug = toSlug(title);
      const categoryDir = category === "entity" ? "entities" :
                          category === "concept" ? "concepts" :
                          category === "decision" ? "decisions" :
                          category === "source" ? "sources" : "synthesis";
      const filePath = path.join(wikiDir, categoryDir, `${slug}.md`);

      if (fs.existsSync(filePath)) {
        return { content: [{ type: "text" as const, text: `Page "${slug}" already exists in ${categoryDir}/. Use update_wiki_page to modify it.` }] };
      }

      // Build frontmatter
      const fm: WikiPageFrontmatter = {
        title,
        category,
        created: today(),
        updated: today(),
        sources: sources ?? [],
        related: related ?? [],
        tags: tags ?? [],
        contributors: ["claude-agent"],
        confidence: confidence ?? "medium",
      };

      // Write page
      const pageContent = `${formatFrontmatter(fm)}\n\n${content}\n`;
      fs.writeFileSync(filePath, pageContent);

      // Update index.md
      const indexPath = path.join(wikiDir, "index.md");
      const indexContent = fs.readFileSync(indexPath, "utf-8");
      const sectionHeader = `## ${categoryDir.charAt(0).toUpperCase() + categoryDir.slice(1)}`;
      const entry = formatIndexEntry({
        slug,
        title,
        category: categoryDir,
        summary: summary ?? title,
        updated: today(),
      });

      const updatedIndex = indexContent.replace(
        sectionHeader,
        `${sectionHeader}\n${entry}`
      );
      fs.writeFileSync(indexPath, updatedIndex);

      // Append to log.md
      const logPath = path.join(wikiDir, "log.md");
      const logEntry = formatLogEntry({
        date: today(),
        type: "create",
        title: `Created: ${title}`,
        details: `Category: ${category}. Tags: ${(tags ?? []).join(", ") || "none"}.`,
        contributor: "claude-agent",
      });
      fs.appendFileSync(logPath, `\n${logEntry}\n`);

      return {
        content: [{
          type: "text" as const,
          text: `Created wiki page: ${categoryDir}/${slug}.md\nTitle: ${title}\nCategory: ${category}\nIndex updated. Log updated.\n\nRemember to git commit and push.`,
        }],
      };
    }
  );

  // ─── update_wiki_page ──────────────────────────────────────────

  server.tool(
    "update_wiki_page",
    "Update an existing wiki page's content or frontmatter.",
    {
      slug: z.string().describe("Page slug (kebab-case filename without .md)"),
      content: z.string().optional().describe("New markdown body (replaces existing)"),
      appendContent: z.string().optional().describe("Markdown to append to existing body"),
      tags: z.array(z.string()).optional().describe("Replace tags"),
      related: z.array(z.string()).optional().describe("Replace related links"),
      confidence: z.enum(["low", "medium", "high", "verified"]).optional().describe("Update confidence"),
    },
    async ({ slug, content: newContent, appendContent, tags, related, confidence }) => {
      const wikiDir = getWikiDir();

      // Find the page across categories
      let filePath: string | null = null;
      for (const cat of ["entities", "concepts", "decisions", "sources", "synthesis"]) {
        const p = path.join(wikiDir, cat, `${slug}.md`);
        if (fs.existsSync(p)) { filePath = p; break; }
      }

      if (!filePath) {
        return { content: [{ type: "text" as const, text: `Page "${slug}" not found in any wiki category.` }] };
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(raw);

      // Update frontmatter
      frontmatter.updated = today();
      if (tags) frontmatter.tags = tags;
      if (related) frontmatter.related = related;
      if (confidence) frontmatter.confidence = confidence;

      // Add contributor if not present
      const contributors = (frontmatter.contributors as string[]) || [];
      if (!contributors.includes("claude-agent")) {
        contributors.push("claude-agent");
        frontmatter.contributors = contributors;
      }

      // Update content
      let finalBody = body;
      if (newContent) finalBody = newContent;
      else if (appendContent) finalBody = body.trimEnd() + "\n\n" + appendContent;

      // Rebuild page
      const fm = frontmatter as unknown as WikiPageFrontmatter;
      const pageContent = `${formatFrontmatter(fm)}\n\n${finalBody.trim()}\n`;
      fs.writeFileSync(filePath, pageContent);

      // Log
      const logPath = path.join(wikiDir, "log.md");
      if (fs.existsSync(logPath)) {
        fs.appendFileSync(logPath, `\n${formatLogEntry({
          date: today(),
          type: "update",
          title: `Updated: ${frontmatter.title || slug}`,
          contributor: "claude-agent",
        })}\n`);
      }

      return {
        content: [{
          type: "text" as const,
          text: `Updated wiki page: ${slug}\nRemember to git commit and push.`,
        }],
      };
    }
  );

  // ─── read_wiki_page ────────────────────────────────────────────

  server.tool(
    "read_wiki_page",
    "Read a wiki page's content and frontmatter.",
    {
      slug: z.string().describe("Page slug, or 'index' for the index, or 'log' for the log"),
    },
    async ({ slug }) => {
      const wikiDir = getWikiDir();

      if (slug === "index") {
        const indexPath = path.join(wikiDir, "index.md");
        if (!fs.existsSync(indexPath)) return { content: [{ type: "text" as const, text: "Wiki not initialized." }] };
        return { content: [{ type: "text" as const, text: fs.readFileSync(indexPath, "utf-8") }] };
      }

      if (slug === "log") {
        const logPath = path.join(wikiDir, "log.md");
        if (!fs.existsSync(logPath)) return { content: [{ type: "text" as const, text: "Wiki not initialized." }] };
        return { content: [{ type: "text" as const, text: fs.readFileSync(logPath, "utf-8") }] };
      }

      // Search across categories
      for (const cat of ["entities", "concepts", "decisions", "sources", "synthesis"]) {
        const filePath = path.join(wikiDir, cat, `${slug}.md`);
        if (fs.existsSync(filePath)) {
          return { content: [{ type: "text" as const, text: fs.readFileSync(filePath, "utf-8") }] };
        }
      }

      return { content: [{ type: "text" as const, text: `Page "${slug}" not found.` }] };
    }
  );

  // ─── search_wiki_local ─────────────────────────────────────────

  server.tool(
    "search_wiki_local",
    "Search wiki pages by keyword (case-insensitive text search across titles and content).",
    {
      query: z.string().describe("Search query"),
    },
    async ({ query }) => {
      const wikiDir = getWikiDir();
      if (!fs.existsSync(wikiDir)) {
        return { content: [{ type: "text" as const, text: "Wiki not initialized." }] };
      }

      const q = query.toLowerCase();
      const results: { slug: string; category: string; title: string; matchLine: string }[] = [];

      for (const cat of ["entities", "concepts", "decisions", "sources", "synthesis"]) {
        const catDir = path.join(wikiDir, cat);
        if (!fs.existsSync(catDir)) continue;

        for (const file of fs.readdirSync(catDir)) {
          if (!file.endsWith(".md")) continue;
          const content = fs.readFileSync(path.join(catDir, file), "utf-8");
          if (!content.toLowerCase().includes(q)) continue;

          const { frontmatter } = parseFrontmatter(content);
          const title = (frontmatter.title as string) || file.replace(".md", "");

          // Find first matching line for context
          const lines = content.split("\n");
          const matchLine = lines.find(l => l.toLowerCase().includes(q)) || "";

          results.push({
            slug: file.replace(".md", ""),
            category: cat,
            title,
            matchLine: matchLine.trim().slice(0, 100),
          });
        }
      }

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No wiki pages match "${query}".` }] };
      }

      const list = results.map(r =>
        `- **${r.title}** (${r.category}/${r.slug})\n  ${r.matchLine}`
      ).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: `Found ${results.length} page(s) matching "${query}":\n\n${list}`,
        }],
      };
    }
  );
}
