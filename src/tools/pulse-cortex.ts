import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function getCortexConfig(): { url: string; auth: string } {
  const url = process.env.CORTEX_URL;
  if (!url) throw new Error("CORTEX_URL must be set (e.g., https://brain.aperai.eu)");
  const user = process.env.CORTEX_USER || "jan";
  const pass = process.env.CORTEX_PASS;
  if (!pass) throw new Error("CORTEX_PASS must be set (basicauth password for the brain)");
  return {
    url: url.replace(/\/$/, ""),
    auth: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
  };
}

async function cortexApi(path: string, options?: RequestInit): Promise<Response> {
  const { url, auth } = getCortexConfig();
  return fetch(`${url}/api${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

export function registerCortexTools(server: McpServer) {

  // ─── cortex_read_wiki ─────────────────────────────────────────

  server.tool(
    "cortex_read_wiki",
    "Read a wiki page from Cortex (the org's AI agent). The wiki is Cortex's persistent memory — shared across all sessions and channels.",
    {
      path: z.string().describe("Wiki page path, e.g., 'index.md', 'distill/overview.md', 'jan/preferences.md'"),
    },
    async ({ path }) => {
      try {
        const res = await cortexApi(`/wiki/${path}`);
        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Wiki page not found: ${path} (${res.status})` }] };
        }
        const content = await res.text();
        return { content: [{ type: "text" as const, text: content }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Cortex error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── cortex_list_wiki ─────────────────────────────────────────

  server.tool(
    "cortex_list_wiki",
    "List all wiki pages in Cortex's memory. Shows what the org's AI knows.",
    {},
    async () => {
      try {
        const res = await cortexApi("/wiki");
        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Error listing wiki: ${res.status}` }] };
        }
        const pages = await res.json() as { path: string; title: string; size: number }[];
        const listing = pages.map(p => `📄 ${p.path} — ${p.title} (${Math.round(p.size / 1024)}K)`).join("\n");
        return {
          content: [{
            type: "text" as const,
            text: pages.length > 0
              ? `Cortex wiki (${pages.length} pages):\n\n${listing}`
              : "Cortex wiki is empty.",
          }],
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Cortex error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── cortex_write_wiki ────────────────────────────────────────

  server.tool(
    "cortex_write_wiki",
    "Write or update a wiki page in Cortex's memory. Use this to share knowledge from your local session with the org's AI.",
    {
      path: z.string().describe("Wiki page path, e.g., 'distill/overview.md', 'research/new-topic.md'"),
      content: z.string().describe("Full markdown content for the page"),
    },
    async ({ path, content }) => {
      try {
        // The brain server doesn't have a write endpoint yet — we'll use cortex_chat to ask it to write
        // For now, use SSH to write directly (if available) or POST to a write endpoint
        const res = await cortexApi("/wiki/" + path, {
          method: "PUT",
          body: JSON.stringify({ content }),
        });

        if (!res.ok) {
          // Fallback: ask Cortex to write it via chat
          const chatRes = await cortexApi("/chat", {
            method: "POST",
            body: JSON.stringify({
              message: `Please update the wiki page at wiki/${path} with the following content. Write it directly to the file, then commit.\n\n---\n${content}\n---`,
            }),
          });

          if (!chatRes.ok) {
            return { content: [{ type: "text" as const, text: `Failed to write wiki page: ${res.status}. Chat fallback also failed.` }] };
          }

          // Read the streamed response
          const reader = chatRes.body?.getReader();
          const decoder = new TextDecoder();
          let responseText = "";
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) responseText += parsed.text;
                } catch { /* skip */ }
              }
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: `Asked Cortex to write wiki/${path}. Response:\n${responseText.slice(0, 500)}`,
            }],
          };
        }

        return { content: [{ type: "text" as const, text: `Wiki page written: ${path}` }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Cortex error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ─── cortex_chat ──────────────────────────────────────────────

  server.tool(
    "cortex_chat",
    "Send a message to Cortex (the org's AI agent) and get a response. Cortex has full CLI power — it can read/write files, run commands, access repos. Use this to delegate work or ask questions that need Cortex's persistent memory.",
    {
      message: z.string().describe("The message to send to Cortex"),
      conversationId: z.string().optional().describe("Continue an existing conversation (optional)"),
    },
    async ({ message, conversationId }) => {
      try {
        const res = await cortexApi("/chat", {
          method: "POST",
          body: JSON.stringify({ message, conversationId }),
        });

        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `Cortex chat error: ${res.status} ${await res.text()}` }] };
        }

        // Read the SSE stream
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let responseText = "";
        let convId = conversationId || "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.conversationId) convId = parsed.conversationId;
                if (parsed.text) responseText += parsed.text;
              } catch { /* skip */ }
            }
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: responseText || "(No response from Cortex)",
          }],
          ...(convId ? { _meta: { conversationId: convId } } : {}),
        };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Cortex error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );
}
