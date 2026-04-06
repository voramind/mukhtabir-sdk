import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import { promptFeedbackSummaryShape } from "../schemas";
import {
  createWorkflowPrompt,
  formatKnownInputs,
} from "../shared/workflow-prompts";

export function registerFeedbackPrompts(
  server: McpServer,
  authorization: MukhtabirMcpAuthorizationPolicy,
) {
  if (!authorization.allows("read")) {
    return;
  }

  server.registerPrompt(
    "candidate_evaluation_summary",
    {
      description: "Summarize a candidate evaluation from Mukhtabir feedback.",
      argsSchema: promptFeedbackSummaryShape,
    },
    async (args) =>
      createWorkflowPrompt("Summarize a candidate evaluation.", [
        "Call `get_feedback` for the supplied feedback ID.",
        args.include_transcript
          ? "Also call `get_feedback_transcript` or read the transcript resource to ground the summary in transcript evidence."
          : "Use transcript retrieval only if the feedback summary is insufficient.",
        "Produce a concise hiring recommendation with strengths, risks, notable evidence, and follow-up questions.",
        formatKnownInputs([
          ["feedback_id", args.feedback_id],
          ["include_transcript", args.include_transcript],
        ]),
      ]),
  );
}
