import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { registerFeedbackPrompts } from "./prompts";
import { registerFeedbackResources } from "./resources";
import { registerFeedbackTools } from "./tools";

export function registerFeedbackDomain(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  registerFeedbackTools(server, adapter, authorization, auditLogger);
  registerFeedbackResources(server, adapter, authorization);
  registerFeedbackPrompts(server, authorization);
}
