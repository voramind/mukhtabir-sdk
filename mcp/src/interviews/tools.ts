import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MukhtabirMcpAuthorizationPolicy } from "../authorization";
import type { MukhtabirApiAdapter } from "../adapter/mukhtabir";
import {
  addInterviewCriteriaSchema,
  addInterviewQuestionSchema,
  addInterviewSubquestionSchema,
  createInterviewShape,
  deleteInterviewCriteriaSchema,
  deleteInterviewQuestionSchema,
  deleteInterviewSubquestionSchema,
  idShape,
  inviteCandidateShape,
  pageShape,
  updateInterviewCriteriaSchema,
  updateInterviewShape,
  updateInterviewQuestionSchema,
  updateInterviewSubquestionSchema,
} from "../schemas";
import { createResourceLink, createToolResult } from "../shared/mcp-content";
import { createPaginatedItemsPreview } from "../shared/input-parsing";
import { sanitizeInvitation } from "../shared/sanitization";
import {
  createToolRegistrar,
  DESTRUCTIVE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
} from "../shared/tool-registration";
import type { MukhtabirMcpAuditLogger } from "../shared/audit";
import { interviewResourceUri } from "./uris";

type IdInput = { id: string };
type PageInput = { page?: number; page_size?: number };
type CreateInterviewToolArgs = Parameters<
  MukhtabirApiAdapter["createInterview"]
>[0];
type UpdateInterviewToolArgs = IdInput &
  Parameters<MukhtabirApiAdapter["updateInterview"]>[1];
type InviteCandidateToolArgs = IdInput &
  Parameters<MukhtabirApiAdapter["inviteCandidateToInterview"]>[1];
type ListInterviewResultsToolArgs = IdInput & PageInput;
type AddInterviewQuestionToolArgs = IdInput &
  Parameters<MukhtabirApiAdapter["addInterviewQuestion"]>[1];
type UpdateInterviewQuestionToolArgs = IdInput & {
  question_id: string;
} & Parameters<MukhtabirApiAdapter["updateInterviewQuestion"]>[2];
type DeleteInterviewQuestionToolArgs = IdInput & { question_id: string };
type AddInterviewSubquestionToolArgs = IdInput & {
  question_id: string;
} & Parameters<MukhtabirApiAdapter["addInterviewSubquestion"]>[2];
type UpdateInterviewSubquestionToolArgs = IdInput & {
  question_id: string;
  subquestion_id: string;
} & Parameters<MukhtabirApiAdapter["updateInterviewSubquestion"]>[3];
type DeleteInterviewSubquestionToolArgs = IdInput & {
  question_id: string;
  subquestion_id: string;
};
type AddInterviewCriteriaToolArgs = IdInput &
  Parameters<MukhtabirApiAdapter["addInterviewCriteria"]>[1];
type UpdateInterviewCriteriaToolArgs = IdInput & {
  criteria_id: string;
} & Parameters<MukhtabirApiAdapter["updateInterviewCriteria"]>[2];
type DeleteInterviewCriteriaToolArgs = IdInput & { criteria_id: string };

export function registerInterviewTools(
  server: McpServer,
  adapter: MukhtabirApiAdapter,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  const tools = createToolRegistrar(server, authorization, auditLogger);

  tools.registerWriteTool({
    name: "create_interview",
    description: "Create a new Mukhtabir interview.",
    inputSchema: createInterviewShape,
    handler: async (args: CreateInterviewToolArgs) => {
      const response = await adapter.createInterview(args);
      const interviewId = response.data.interview_id;

      return createToolResult(
        `Created interview ${interviewId}.`,
        {
          interview_id: interviewId,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(interviewId),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(interviewId),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "list_interviews",
    description: "List Mukhtabir interviews.",
    inputSchema: pageShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async (args: PageInput) => {
      const response = await adapter.listInterviews(args);

      return createToolResult(
        `Fetched ${response.data.length} interview(s) from page ${response.pagination.page}.`,
        {
          items: response.data,
          pagination: response.pagination,
          meta: response.meta,
        },
      );
    },
  });

  tools.registerReadTool({
    name: "get_interview",
    description: "Fetch a Mukhtabir interview by ID.",
    inputSchema: idShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.getInterview(id);

      return createToolResult(
        `Fetched interview ${response.data.id} for ${response.data.role}.`,
        {
          interview: response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "list_interview_results",
    description: "List paginated results for a Mukhtabir interview.",
    inputSchema: {
      ...idShape,
      ...pageShape,
    },
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id, page, page_size }: ListInterviewResultsToolArgs) => {
      const response = await adapter.listInterviewResults(id, {
        page,
        page_size,
      });
      const uri = interviewResourceUri.interviewResults(
        id,
        response.pagination.page,
        response.pagination.page_size,
      );
      const preview = createPaginatedItemsPreview(response.data);

      return createToolResult(
        `Fetched ${preview.item_count} result(s) for interview ${id}.`,
        {
          ...preview,
          pagination: response.pagination,
          meta: response.meta,
          resource_uri: uri,
        },
        [
          createResourceLink(
            uri,
            "Interview results",
            "Read the full paginated interview results resource.",
          ),
        ],
      );
    },
  });

  tools.registerReadTool({
    name: "get_interview_analytics",
    description: "Fetch analytics for a Mukhtabir interview.",
    inputSchema: idShape,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.getInterviewAnalytics(id);

      return createToolResult(
        `Fetched analytics for interview ${id}.`,
        {
          analytics: response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interviewAnalytics(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interviewAnalytics(id),
            "Interview analytics",
            "Read the full interview analytics resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "update_interview",
    description: "Update a Mukhtabir interview.",
    inputSchema: updateInterviewShape,
    handler: async ({ id, ...input }: UpdateInterviewToolArgs) => {
      const response = await adapter.updateInterview(id, input);

      return createToolResult(
        `Updated interview ${response.data.id}.`,
        {
          interview: response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(response.data.id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(response.data.id),
            "Interview",
            "Read the updated interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "publish_interview",
    description: "Publish a Mukhtabir interview.",
    inputSchema: idShape,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.publishInterview(id);

      return createToolResult(
        `Published interview ${response.data.interview_id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(
            response.data.interview_id,
          ),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(response.data.interview_id),
            "Interview",
            "Read the published interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "invite_candidate_to_interview",
    description: "Invite a candidate to a Mukhtabir interview.",
    inputSchema: inviteCandidateShape,
    handler: async ({ id, ...input }: InviteCandidateToolArgs) => {
      const response = await adapter.inviteCandidateToInterview(id, input);
      const sanitized = sanitizeInvitation(response.data);

      return createToolResult(
        `Created an interview invitation for ${response.data.candidate_email}.`,
        {
          invitation: sanitized,
          meta: response.meta,
        },
      );
    },
  });

  tools.registerWriteTool({
    name: "add_interview_question",
    description: "Add a question to a Mukhtabir interview.",
    inputSchema: addInterviewQuestionSchema,
    handler: async ({ id, ...input }: AddInterviewQuestionToolArgs) => {
      const response = await adapter.addInterviewQuestion(id, input);

      return createToolResult(
        `Added question ${response.data.question_id} to interview ${id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "update_interview_question",
    description: "Update a question in a Mukhtabir interview.",
    inputSchema: updateInterviewQuestionSchema,
    handler: async ({
      id,
      question_id,
      ...input
    }: UpdateInterviewQuestionToolArgs) => {
      const response = await adapter.updateInterviewQuestion(
        id,
        question_id,
        input,
      );

      return createToolResult(
        `Updated question ${response.data.question_id} in interview ${id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerDeleteTool({
    name: "delete_interview_question",
    description: "Delete a question from a Mukhtabir interview.",
    inputSchema: deleteInterviewQuestionSchema,
    annotations: DESTRUCTIVE_TOOL_ANNOTATIONS,
    handler: async ({ id, question_id }: DeleteInterviewQuestionToolArgs) => {
      const response = await adapter.deleteInterviewQuestion(id, question_id);

      return createToolResult(
        `Deleted question ${response.data.question_id} from interview ${id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "add_interview_subquestion",
    description: "Add a subquestion to a Mukhtabir interview question.",
    inputSchema: addInterviewSubquestionSchema,
    handler: async ({
      id,
      question_id,
      ...input
    }: AddInterviewSubquestionToolArgs) => {
      const response = await adapter.addInterviewSubquestion(
        id,
        question_id,
        input,
      );

      return createToolResult(
        `Added subquestion ${response.data.subquestion_id} to question ${question_id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "update_interview_subquestion",
    description: "Update a subquestion in a Mukhtabir interview question.",
    inputSchema: updateInterviewSubquestionSchema,
    handler: async ({
      id,
      question_id,
      subquestion_id,
      ...input
    }: UpdateInterviewSubquestionToolArgs) => {
      const response = await adapter.updateInterviewSubquestion(
        id,
        question_id,
        subquestion_id,
        input,
      );

      return createToolResult(
        `Updated subquestion ${response.data.subquestion_id} in question ${question_id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerDeleteTool({
    name: "delete_interview_subquestion",
    description: "Delete a subquestion from a Mukhtabir interview question.",
    inputSchema: deleteInterviewSubquestionSchema,
    annotations: DESTRUCTIVE_TOOL_ANNOTATIONS,
    handler: async ({
      id,
      question_id,
      subquestion_id,
    }: DeleteInterviewSubquestionToolArgs) => {
      const response = await adapter.deleteInterviewSubquestion(
        id,
        question_id,
        subquestion_id,
      );

      return createToolResult(
        `Deleted subquestion ${response.data.subquestion_id} from question ${question_id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "add_interview_criteria",
    description: "Add evaluation criteria to a Mukhtabir interview.",
    inputSchema: addInterviewCriteriaSchema,
    handler: async ({ id, ...input }: AddInterviewCriteriaToolArgs) => {
      const response = await adapter.addInterviewCriteria(id, input);

      return createToolResult(
        `Added criteria ${response.data.criteria_id} to interview ${id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerWriteTool({
    name: "update_interview_criteria",
    description: "Update evaluation criteria in a Mukhtabir interview.",
    inputSchema: updateInterviewCriteriaSchema,
    handler: async ({
      id,
      criteria_id,
      ...input
    }: UpdateInterviewCriteriaToolArgs) => {
      const response = await adapter.updateInterviewCriteria(
        id,
        criteria_id,
        input,
      );

      return createToolResult(
        `Updated criteria ${response.data.criteria_id} in interview ${id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerDeleteTool({
    name: "delete_interview_criteria",
    description: "Delete evaluation criteria from a Mukhtabir interview.",
    inputSchema: deleteInterviewCriteriaSchema,
    annotations: DESTRUCTIVE_TOOL_ANNOTATIONS,
    handler: async ({ id, criteria_id }: DeleteInterviewCriteriaToolArgs) => {
      const response = await adapter.deleteInterviewCriteria(id, criteria_id);

      return createToolResult(
        `Deleted criteria ${response.data.criteria_id} from interview ${id}.`,
        {
          ...response.data,
          meta: response.meta,
          resource_uri: interviewResourceUri.interview(id),
        },
        [
          createResourceLink(
            interviewResourceUri.interview(id),
            "Interview",
            "Read the full interview resource.",
          ),
        ],
      );
    },
  });

  tools.registerDeleteTool({
    name: "delete_interview",
    description: "Delete a Mukhtabir interview.",
    inputSchema: idShape,
    annotations: DESTRUCTIVE_TOOL_ANNOTATIONS,
    handler: async ({ id }: IdInput) => {
      const response = await adapter.deleteInterview(id);

      return createToolResult(`Deleted interview ${id}.`, {
        deleted: response.data.deleted,
        interview_id: id,
        meta: response.meta,
      });
    },
  });
}
