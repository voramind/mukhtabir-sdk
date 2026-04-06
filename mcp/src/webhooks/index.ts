import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { registerWebhookPrompts } from "./prompts";
import { registerWebhookResources } from "./resources";
import { registerWebhookTools } from "./tools";

export function registerWebhookDomain(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  registerWebhookTools(server, adapter, authorization, auditLogger);
  registerWebhookResources(server, adapter, authorization);
  registerWebhookPrompts(server, authorization);
}
