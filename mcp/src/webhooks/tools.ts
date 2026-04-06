import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import {
  createWebhookShape,
  idShape,
  pageShape,
  updateWebhookShape,
} from "../schemas";
import { createResourceLink, createToolResult } from "../shared/mcp-content";
import { createPaginatedItemsPreview } from "../shared/input-parsing";
import { sanitizeWebhookSecret } from "../shared/sanitization";
import {
  createToolRegistrar,
  DESTRUCTIVE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
} from "../shared/tool-registration";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { webhookResourceUri } from "./uris";

type IdInput = { id: string };
type PageInput = { page?: number; page_size?: number };
type CreateWebhookToolArgs = Parameters<
  MukhtabirApiAdapter["createWebhook"]
>[0];
type UpdateWebhookToolArgs = IdInput &
  Parameters<MukhtabirApiAdapter["updateWebhook"]>[1];
type ListWebhookDeliveriesToolArgs = IdInput & PageInput;

export function registerWebhookTools(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  const tools = createToolRegistrar(server, authorization, auditLogger);

  tools.registerWriteTool({
    name: "create_webhook",
    description: "Create a Mukhtabir webhook.",
    inputSchema: createWebhookShape,
    handler: async (args: CreateWebhookToolArgs) => {
      const response = await adapter.createWebhook(args);
      const sanitizedWebhook = sanitizeWebhookSecret(response.data);

      return createToolResult(
        `Created webhook ${response.data.id}. The signing secret is intentionally redacted from MCP output.`,
        {
          webhook: sanitizedWebhook,
          meta: response.meta,
          resource_uri: webhookResourceUri.webhook(response.data.id),
        },
        [
          createResourceLink(
            webhookResourceUri.webhook(response.data.id),
            "Webhook",
            "Read the full webhook resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "update_webhook",
    description: "Update a Mukhtabir webhook.",
    inputSchema: updateWebhookShape,
    handler: async ({ id, ...input }: UpdateWebhookToolArgs) => {
      const response = await adapter.updateWebhook(id, input);

      return createToolResult(
        `Updated webhook ${response.data.id}.`,
        {
          webhook: response.data,
          meta: response.meta,
          resource_uri: webhookResourceUri.webhook(response.data.id),
        },
        [
          createResourceLink(
            webhookResourceUri.webhook(response.data.id),
            "Webhook",
            "Read the updated webhook resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "test_webhook",
    description: "Trigger a Mukhtabir webhook test delivery.",
    inputSchema: idShape,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.testWebhook(id);

      return createToolResult(`Triggered a test delivery for webhook ${id}.`, {
        delivery: response.data,
        meta: response.meta,
      });
    },
  });

  tools.registerReadTool({
    name: "list_webhooks",
    description: "List Mukhtabir webhooks.",
    inputSchema: pageShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async (args: PageInput) => {
      const response = await adapter.listWebhooks(args);

      return createToolResult(
        `Fetched ${response.data.length} webhook(s) from page ${response.pagination.page}.`,
        {
          items: response.data,
          pagination: response.pagination,
          meta: response.meta,
        },
      );
    },
  });

  tools.registerReadTool({
    name: "get_webhook",
    description: "Fetch a Mukhtabir webhook by ID.",
    inputSchema: idShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.getWebhook(id);

      return createToolResult(
        `Fetched webhook ${response.data.id}.`,
        {
          webhook: response.data,
          meta: response.meta,
          resource_uri: webhookResourceUri.webhook(id),
        },
        [
          createResourceLink(
            webhookResourceUri.webhook(id),
            "Webhook",
            "Read the full webhook resource.",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "list_webhook_deliveries",
    description: "List paginated deliveries for a Mukhtabir webhook.",
    inputSchema: {
      ...idShape,
      ...pageShape,
    },
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id, page, page_size }: ListWebhookDeliveriesToolArgs) => {
      const response = await adapter.listWebhookDeliveries(id, {
        page,
        page_size,
      });
      const uri = webhookResourceUri.webhookDeliveries(
        id,
        response.pagination.page,
        response.pagination.page_size,
      );
      const preview = createPaginatedItemsPreview(response.data);

      return createToolResult(
        `Fetched ${preview.item_count} delivery record(s) for webhook ${id}.`,
        {
          ...preview,
          pagination: response.pagination,
          meta: response.meta,
          resource_uri: uri,
        },
        [
          createResourceLink(
            uri,
            "Webhook deliveries",
            "Read the full paginated webhook deliveries resource.",
          ),
        ],
      );
    },
  });

  tools.registerDeleteTool({
    name: "delete_webhook",
    description: "Delete a Mukhtabir webhook.",
    inputSchema: idShape,
    annotations: DESTRUCTIVE_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.deleteWebhook(id);

      return createToolResult(`Deleted webhook ${id}.`, {
        deleted: response.data.deleted,
        webhook_id: id,
        meta: response.meta,
      });
    },
  });
}
