import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import { wrapResourceHandler } from "../shared/handler-wrappers";
import { createJsonResource } from "../shared/mcp-content";
import { getRequiredVariable, readPageQuery } from "../shared/input-parsing";
import { WEBHOOK_RESOURCE_TEMPLATES } from "./uris";

export function registerWebhookResources(
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
    "webhook",
    new ResourceTemplate(WEBHOOK_RESOURCE_TEMPLATES.webhook, {
      list: undefined,
    }),
    {
      title: "Webhook",
      description: "Read a Mukhtabir webhook by ID.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:webhook",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const response = await adapter.getWebhook(id);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );

  server.registerResource(
    "webhook-deliveries",
    new ResourceTemplate(WEBHOOK_RESOURCE_TEMPLATES.webhookDeliveries, {
      list: undefined,
    }),
    {
      title: "Webhook Deliveries",
      description: "Read a paginated Mukhtabir webhook deliveries page.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:webhook_deliveries",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const page = readPageQuery(uri);
        const response = await adapter.listWebhookDeliveries(id, page);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );
}
