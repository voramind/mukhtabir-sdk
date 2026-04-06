import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { registerCandidateResources } from "./resources";
import { registerCandidateTools } from "./tools";

export function registerCandidateDomain(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  registerCandidateTools(server, adapter, authorization, auditLogger);
  registerCandidateResources(server, adapter, authorization);
}
