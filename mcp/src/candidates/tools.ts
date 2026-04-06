import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import { emailShape, pageShape, registerCandidateShape } from "../schemas";
import { createResourceLink, createToolResult } from "../shared/mcp-content";
import { sanitizeInvitation } from "../shared/sanitization";
import {
  createToolRegistrar,
  READ_ONLY_TOOL_ANNOTATIONS,
} from "../shared/tool-registration";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { candidateResourceUri } from "./uris";

type EmailInput = { email: string };
type PageInput = { page?: number; page_size?: number };
type RegisterCandidateToolArgs = Parameters<
  MukhtabirApiAdapter["registerCandidate"]
>[0];

export function registerCandidateTools(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  const tools = createToolRegistrar(server, authorization, auditLogger);

  tools.registerWriteTool({
    name: "register_candidate",
    description: "Register a Mukhtabir candidate.",
    inputSchema: registerCandidateShape,
    handler: async (args: RegisterCandidateToolArgs) => {
      const response = await adapter.registerCandidate(args);
      const sanitized = sanitizeInvitation(response.data);

      return createToolResult(
        `Registered candidate ${response.data.email}.`,
        {
          candidate: sanitized,
          meta: response.meta,
          resource_uri: candidateResourceUri(response.data.email),
        },
        [
          createResourceLink(
            candidateResourceUri(response.data.email),
            "Candidate",
            "Read the full candidate resource.",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "list_candidates",
    description: "List Mukhtabir candidates.",
    inputSchema: pageShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async (args: PageInput) => {
      const response = await adapter.listCandidates(args);

      return createToolResult(
        `Fetched ${response.data.length} candidate(s) from page ${response.pagination.page}.`,
        {
          items: response.data,
          pagination: response.pagination,
          meta: response.meta,
        },
      );
    },
  });

  tools.registerReadTool({
    name: "get_candidate",
    description: "Fetch a Mukhtabir candidate by email address.",
    inputSchema: emailShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ email }: EmailInput) => {
      const response = await adapter.getCandidate(email);

      return createToolResult(
        `Fetched candidate ${response.data.email}.`,
        {
          candidate: response.data,
          meta: response.meta,
          resource_uri: candidateResourceUri(email),
        },
        [
          createResourceLink(
            candidateResourceUri(email),
            "Candidate",
            "Read the full candidate resource.",
          ),
        ],
      );
    },
  });
}
