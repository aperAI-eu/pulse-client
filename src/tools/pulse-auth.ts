import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function configured(value: string | undefined): boolean {
  return Boolean(value && value.trim() && !value.includes("your_") && !value.includes("<"));
}

export function registerAuthGuidanceTools(server: McpServer) {
  server.tool(
    "describe_pulse_auth_setup",
    "Explain the current Pulse/Cortex auth setup and how to migrate from legacy CORTEX_USER/CORTEX_PASS to org-based Pulse auth. Use this before creating or editing MCP config.",
    {},
    async () => {
      const pulseUrl = process.env.PULSE_API_URL || "https://test-pulse.aperai.eu";
      const brainUrl = process.env.PULSE_BRAIN_URL || process.env.BRAIN_URL || "https://brain.aperai.eu";
      const orgSlug = process.env.PULSE_ORG_SLUG || process.env.BRAIN_ORG_SLUG || "";
      const hasPulseKey = configured(process.env.PULSE_API_KEY);
      const hasLegacyCortexBasic = configured(process.env.CORTEX_PASS);
      const legacyUser = process.env.CORTEX_USER || "jan";
      const orgBrainUrl = orgSlug
        ? `${brainUrl.replace(/\/$/, "")}/${orgSlug}/brain`
        : `${brainUrl.replace(/\/$/, "")}/<org-slug>/brain`;

      const lines = [
        "Pulse auth setup",
        "",
        "Current model:",
        "- MCP tools authenticate to Pulse with PULSE_API_URL + PULSE_API_KEY.",
        "- Brain/Cortex browser access uses Pulse org login: email + password + organization.",
        "- New org-scoped Brain URLs are served from the Pulse app, for example:",
        `  ${orgBrainUrl}`,
        "",
        "Recommended MCP env:",
        `- PULSE_API_URL=${pulseUrl}`,
        `- PULSE_API_KEY=${hasPulseKey ? "<configured>" : "<missing>"}`,
        `- PULSE_BRAIN_URL=${brainUrl}`,
        orgSlug ? `- PULSE_ORG_SLUG=${orgSlug}` : "- PULSE_ORG_SLUG=<your-org-slug>",
        "",
        "Do not add CORTEX_USER or CORTEX_PASS for the Pulse-hosted org Brain. Those were for the legacy standalone Brain Basic-auth API.",
      ];

      if (hasLegacyCortexBasic) {
        lines.push(
          "",
          "Legacy config detected:",
          `- CORTEX_USER=${legacyUser}`,
          "- CORTEX_PASS=<configured>",
          "",
          "For Pulse-hosted Brain, remove CORTEX_USER and CORTEX_PASS from the MCP config and restart the agent. Keep only PULSE_* env vars."
        );
      }

      lines.push(
        "",
        "Standalone Brain fallback:",
        "Only set CORTEX_URL + CORTEX_USER + CORTEX_PASS when connecting to an old standalone Brain server that still exposes /api/wiki and /api/chat behind Basic auth."
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
