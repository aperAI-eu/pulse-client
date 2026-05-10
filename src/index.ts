#!/usr/bin/env node

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/pulse-files.js";
import { registerApiTools } from "./tools/pulse-api.js";
import { registerCortexTools } from "./tools/pulse-cortex.js";
import { registerAuthGuidanceTools } from "./tools/pulse-auth.js";

// Load pulse.config.json — single source of truth for credentials.
// Env vars from IDE configs still override (for CI/CD, Docker, etc).
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "..", "pulse.config.json");
try {
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  for (const [key, value] of Object.entries(config)) {
    if (!process.env[key] && typeof value === "string") {
      process.env[key] = value;
    }
  }
} catch {
  // No config file — rely on env vars from IDE config
}

const server = new McpServer({
  name: "pulse",
  version: "0.1.0",
});

// Register all tools
registerFileTools(server);
registerApiTools(server);
registerCortexTools(server);
registerAuthGuidanceTools(server);

// Start with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
