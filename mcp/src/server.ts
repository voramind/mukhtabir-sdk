import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { Mukhtabir } from "../../typescript/src";

import { MukhtabirApiAdapter } from "./adapter/mukhtabir";
import { createMukhtabirMcpAuthorizationPolicy } from "./authorization";
import { registerCandidateDomain } from "./candidates";
import type { MukhtabirMcpConfigInput } from "./config";
import { registerFeedbackDomain } from "./feedback";
import { registerInterviewDomain } from "./interviews";
import type { MukhtabirMcpAuditLogger } from "./shared/audit";
import { registerWebhookDomain } from "./webhooks";

const SERVER_NAME = "mukhtabir-mcp";
const SERVER_VERSION = "0.1.0";
const SERVER_INSTRUCTIONS = [
  "Mukhtabir MCP exposes interview, candidate, feedback, and webhook operations.",
  "Use tools for actions and targeted lookups.",
  "Use resources when you need fuller read-only payloads such as interview results, deliveries, or transcripts.",
  "In stdio mode the server reads credentials from MUKHTABIR_API_KEY and optional MUKHTABIR_BASE_URL.",
  "In Streamable HTTP mode the server uses Bearer auth at the transport layer and maps the caller to configured Mukhtabir credentials.",
  "Delete tools are destructive and should only be used when the user clearly asks for deletion.",
].join(" ");

export interface CreateMukhtabirMcpServerOptions extends MukhtabirMcpConfigInput {
  adapter?: MukhtabirApiAdapter;
  client?: Mukhtabir;
  scopes?: string[];
  auditLogger?: MukhtabirMcpAuditLogger;
}

export function createMukhtabirMcpServer(
  options: CreateMukhtabirMcpServerOptions = {},
) {
  const adapter =
    options.adapter ??
    (options.client
      ? new MukhtabirApiAdapter(options.client)
      : MukhtabirApiAdapter.fromConfig(options));
  const authorization = createMukhtabirMcpAuthorizationPolicy(options.scopes);

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  registerInterviewDomain(server, adapter, authorization, options.auditLogger);
  registerCandidateDomain(server, adapter, authorization, options.auditLogger);
  registerFeedbackDomain(server, adapter, authorization, options.auditLogger);
  registerWebhookDomain(server, adapter, authorization, options.auditLogger);

  return {
    server,
    adapter,
  };
}
