import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { registerInterviewPrompts } from "./prompts";
import { registerInterviewResources } from "./resources";
import { registerInterviewTools } from "./tools";

export function registerInterviewDomain(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  registerInterviewTools(server, adapter, authorization, auditLogger);
  registerInterviewResources(server, adapter, authorization);
  registerInterviewPrompts(server, authorization);
}
