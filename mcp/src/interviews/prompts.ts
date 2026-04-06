import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import {
  promptInterviewAnalyticsShape,
  promptInterviewWorkflowShape,
  promptInviteWorkflowShape,
} from "../schemas";
import {
  createWorkflowPrompt,
  formatKnownInputs,
} from "../shared/workflow-prompts";

export function registerInterviewPrompts(
  server: McpServer,
  authorization: MukhtabirMcpAuthorizationPolicy,
) {
  if (authorization.allows("write")) {
    server.registerPrompt(
      "create_interview_workflow",
      {
        description: "Guide interview creation and optional publishing.",
        argsSchema: promptInterviewWorkflowShape,
      },
      async (args) =>
        createWorkflowPrompt(
          "Create and optionally publish a Mukhtabir interview.",
          [
            "Gather any missing interview requirements before calling tools.",
            "Call `create_interview` with the confirmed values.",
            "If the user wants the interview live immediately, call `publish_interview` after creation.",
            "Summarize the created interview ID, publish state, and any next recommended action.",
            formatKnownInputs([
              ["role", args.role],
              ["type", args.type],
              ["level", args.level],
              ["duration", args.duration],
              ["visibility", args.visibility],
              ["techstack", args.techstack],
              ["publish_after_create", args.publish_after_create],
            ]),
          ],
        ),
    );

    server.registerPrompt(
      "invite_candidate_workflow",
      {
        description: "Guide candidate invitation for an interview.",
        argsSchema: promptInviteWorkflowShape,
      },
      async (args) =>
        createWorkflowPrompt("Invite a candidate to an interview.", [
          "Confirm any missing candidate details before calling tools.",
          "Call `invite_candidate_to_interview` once the user confirms the target interview and candidate details.",
          "Return the redacted invitation URL and expiry time.",
          formatKnownInputs([
            ["interview_id", args.interview_id],
            ["candidate_name", args.candidate_name],
            ["candidate_email", args.candidate_email],
          ]),
        ]),
    );
  }

  if (!authorization.allows("read")) {
    return;
  }

  server.registerPrompt(
    "interview_analytics_report",
    {
      description: "Create an analytics report for a Mukhtabir interview.",
      argsSchema: promptInterviewAnalyticsShape,
    },
    async (args) =>
      createWorkflowPrompt("Produce an interview analytics report.", [
        "Call `get_interview_analytics` for the supplied interview ID.",
        "If the user wants underlying evidence, call `list_interview_results` or read the results resource.",
        "Summarize completion, score distribution, category averages, and practical follow-up actions.",
        formatKnownInputs([["interview_id", args.interview_id]]),
      ]),
  );
}
