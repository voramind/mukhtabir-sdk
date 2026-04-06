import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import { wrapResourceHandler } from "../shared/handler-wrappers";
import { createJsonResource } from "../shared/mcp-content";
import { getRequiredVariable } from "../shared/input-parsing";
import { CANDIDATE_RESOURCE_TEMPLATE } from "./uris";

export function registerCandidateResources(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
) {
  if (!authorization.allows("read")) {
    return;
  }

  server.registerResource(
    "candidate",
    new ResourceTemplate(CANDIDATE_RESOURCE_TEMPLATE, { list: undefined }),
    {
      title: "Candidate",
      description: "Read a Mukhtabir candidate by email address.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:candidate",
      async (uri, variables) => {
        const email = getRequiredVariable(variables.email, "email");
        const response = await adapter.getCandidate(email);

        return createJsonResource(uri.toString(), response);
      },
      {
        authorization,
        requiredAccess: "read",
      },
    ),
  );
}
