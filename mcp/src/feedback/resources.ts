import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import { wrapResourceHandler } from "../shared/handler-wrappers";
import { createJsonResource, createTextResource } from "../shared/mcp-content";
import { getRequiredVariable } from "../shared/input-parsing";
import { FEEDBACK_RESOURCE_TEMPLATES } from "./uris";

export function registerFeedbackResources(
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
    "feedback",
    new ResourceTemplate(FEEDBACK_RESOURCE_TEMPLATES.feedback, {
      list: undefined,
    }),
    {
      title: "Feedback",
      description: "Read a Mukhtabir feedback record by ID.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:feedback",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const response = await adapter.getFeedback(id);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );

  server.registerResource(
    "feedback-transcript",
    new ResourceTemplate(FEEDBACK_RESOURCE_TEMPLATES.feedbackTranscript, {
      list: undefined,
    }),
    {
      title: "Feedback Transcript",
      description: "Read the full transcript for a Mukhtabir feedback record.",
      mimeType: "text/plain",
    },
    wrapResourceHandler(
      server,
      "resource:feedback_transcript",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const response = await adapter.getFeedbackTranscript(id);

        return createTextResource(
          uri.toString(),
          response.data.transcript ?? "",
        );
      },
      readAccess,
    ),
  );

  server.registerResource(
    "feedback-recording-url",
    new ResourceTemplate(FEEDBACK_RESOURCE_TEMPLATES.feedbackRecordingUrl, {
      list: undefined,
    }),
    {
      title: "Feedback Recording URL",
      description: "Read the recording URL for a Mukhtabir feedback record.",
      mimeType: "application/json",
    },
    wrapResourceHandler(
      server,
      "resource:feedback_recording_url",
      async (uri, variables) => {
        const id = getRequiredVariable(variables.id, "id");
        const response = await adapter.getFeedbackRecordingUrl(id);

        return createJsonResource(uri.toString(), response);
      },
      readAccess,
    ),
  );
}
