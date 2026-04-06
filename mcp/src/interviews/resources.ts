import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import { wrapResourceHandler } from "../shared/handler-wrappers";
import { createJsonResource } from "../shared/mcp-content";
import { getRequiredVariable, readPageQuery } from "../shared/input-parsing";
import { INTERVIEW_RESOURCE_TEMPLATES } from "./uris";

export function registerInterviewResources(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
) {
  const readAccess = {
    authorization,
    requiredAccess: "read" as const,
  };

  if (!authorization.allows("read")) {
    return;
  }

  server.registerResource(
    "interview",
    new ResourceTemplate(INTERVIEW_RESOURCE_TEMPLATES.interview, {
      list: undefined,
    }),
    {
      title: "Interview",
      description: "Read a Mukhtabir interview by ID.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:interview",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const response = await adapter.getInterview(id);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );

  server.registerResource(
    "interview-analytics",
    new ResourceTemplate(INTERVIEW_RESOURCE_TEMPLATES.interviewAnalytics, {
      list: undefined,
    }),
    {
      title: "Interview Analytics",
      description: "Read interview analytics by interview ID.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:interview_analytics",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const response = await adapter.getInterviewAnalytics(id);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );

  server.registerResource(
    "interview-results",
    new ResourceTemplate(INTERVIEW_RESOURCE_TEMPLATES.interviewResults, {
      list: undefined,
    }),
    {
      title: "Interview Results",
      description: "Read a paginated interview results page.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:interview_results",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const page = readPageQuery(uri);
        const response = await adapter.listInterviewResults(id, page);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );
}
