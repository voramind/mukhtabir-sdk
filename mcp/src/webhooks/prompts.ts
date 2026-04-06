import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import { promptWebhookTriageShape } from "../schemas";
import {
  createWorkflowPrompt,
  formatKnownInputs,
} from "../shared/workflow-prompts";

export function registerWebhookPrompts(
  server: McpServer,
  authorization: MukhtabirMcpAuthorizationPolicy,
) {
  if (!authorization.allows("read")) {
    return;
  }

  server.registerPrompt(
    "webhook_delivery_triage",
    {
      description: "Diagnose Mukhtabir webhook delivery problems.",
      argsSchema: promptWebhookTriageShape,
    },
    async (args) =>
      createWorkflowPrompt("Triage webhook delivery failures.", [
        "Call `get_webhook` for the webhook configuration.",
        "Call `list_webhook_deliveries` for recent delivery attempts.",
        "Identify recurring failure patterns, likely causes, and concrete remediation steps.",
        formatKnownInputs([
          ["webhook_id", args.webhook_id],
          ["page_size", args.page_size],
        ]),
      ]),
  );
}
