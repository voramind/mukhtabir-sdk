import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import { idShape } from "../schemas";
import { createResourceLink, createToolResult } from "../shared/mcp-content";
import { truncateText } from "../shared/sanitization";
import {
  createToolRegistrar,
  READ_ONLY_TOOL_ANNOTATIONS,
} from "../shared/tool-registration";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { feedbackResourceUri } from "./uris";

type IdInput = { id: string };

export function registerFeedbackTools(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  const tools = createToolRegistrar(server, authorization, auditLogger);

  tools.registerReadTool({
    name: "get_feedback",
    description: "Fetch a Mukhtabir feedback record.",
    inputSchema: idShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.getFeedback(id);

      return createToolResult(
        `Fetched feedback ${response.data.id} for ${response.data.interviewee_name}.`,
        {
          feedback: response.data,
          meta: response.meta,
          resource_uri: feedbackResourceUri.feedback(id),
        },
        [
          createResourceLink(
            feedbackResourceUri.feedback(id),
            "Feedback",
            "Read the full feedback resource.",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "get_feedback_transcript",
    description: "Fetch a Mukhtabir feedback transcript.",
    inputSchema: idShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.getFeedbackTranscript(id);
      const transcript = response.data.transcript ?? "";
      const preview = truncateText(transcript, 2_000);

      return createToolResult(
        transcript
          ? `Fetched transcript for feedback ${id}${preview.truncated ? " (truncated preview)." : "."}`
          : `No transcript is available for feedback ${id}.`,
        {
          feedback_id: response.data.feedback_id,
          interview_id: response.data.interview_id,
          transcript: preview.text,
          has_transcript: transcript.length > 0,
          transcript_truncated: preview.truncated,
          meta: response.meta,
          resource_uri: feedbackResourceUri.feedbackTranscript(id),
        },
        [
          createResourceLink(
            feedbackResourceUri.feedbackTranscript(id),
            "Feedback transcript",
            "Read the full transcript resource.",
            "text/plain",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "get_feedback_recording_url",
    description: "Fetch the recording URL for a Mukhtabir feedback record.",
    inputSchema: idShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.getFeedbackRecordingUrl(id);

      return createToolResult(
        `Fetched recording URL for feedback ${id}.`,
        {
          recording: response.data,
          meta: response.meta,
          resource_uri: feedbackResourceUri.feedbackRecordingUrl(id),
        },
        [
          createResourceLink(
            feedbackResourceUri.feedbackRecordingUrl(id),
            "Feedback recording URL",
            "Read the recording URL resource.",
          ),
        ],
      );
    },
  });
}
