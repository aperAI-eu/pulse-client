#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/pulse-files.js";
import { registerApiTools } from "./tools/pulse-api.js";

const server = new McpServer({
  name: "pulse",
  version: "0.1.0",
});

// Register all tools
registerFileTools(server);
registerApiTools(server);

// Start with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
