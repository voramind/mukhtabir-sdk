import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startMukhtabirMcpHttpServer } from "../src/http";
import { mukhtabirMcpLogger } from "../src/shared/logging";

function parseEnvValue(rawValue: string) {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1);

    return trimmed.startsWith('"')
      ? inner
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
      : inner;
  }

  const hashIndex = trimmed.indexOf(" #");

  return (hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed).trim();
}

function loadRepositoryRootEnv() {
  const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
  if (!existsSync(envPath)) {
    return;
  }

  const source = readFileSync(envPath, "utf8");

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length)
      : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = parseEnvValue(normalized.slice(separatorIndex + 1));
    }
  }
}

function formatToolFailure(result: Awaited<ReturnType<Client["callTool"]>>) {
  if (result.structuredContent) {
    return JSON.stringify(result.structuredContent);
  }

  return JSON.stringify(result.content);
}

function getTextContent(entry: { text?: string; blob?: string } | undefined) {
  if (!entry || typeof entry.text !== "string") {
    throw new Error("Expected a text resource payload.");
  }

  return entry.text;
}

function getPromptText(prompt: Awaited<ReturnType<Client["getPrompt"]>>) {
  const message = prompt.messages[0];
  if (!message || message.content.type !== "text") {
    throw new Error("Expected a text prompt payload.");
  }

  return message.content.text;
}

function parseJsonResource<T>(
  entry: { text?: string; blob?: string } | undefined,
) {
  return JSON.parse(getTextContent(entry)) as T;
}

function requireFixture(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for the MCP live integration suite. Run it through the Rust launcher or provide the seeded fixture env vars.`,
    );
  }

  return value;
}

const EXPECTED_TOOL_NAMES = [
  "create_interview",
  "list_interviews",
  "get_interview",
  "update_interview",
  "publish_interview",
  "delete_interview",
  "invite_candidate_to_interview",
  "add_interview_question",
  "update_interview_question",
  "delete_interview_question",
  "add_interview_subquestion",
  "update_interview_subquestion",
  "delete_interview_subquestion",
  "add_interview_criteria",
  "update_interview_criteria",
  "delete_interview_criteria",
  "list_interview_results",
  "get_interview_analytics",
  "register_candidate",
  "list_candidates",
  "get_candidate",
  "get_feedback",
  "get_feedback_transcript",
  "get_feedback_recording_url",
  "create_webhook",
  "list_webhooks",
  "get_webhook",
  "update_webhook",
  "delete_webhook",
  "test_webhook",
  "list_webhook_deliveries",
] as const;

const EXPECTED_PROMPT_NAMES = [
  "create_interview_workflow",
  "invite_candidate_workflow",
  "candidate_evaluation_summary",
  "interview_analytics_report",
  "webhook_delivery_triage",
] as const;

const EXPECTED_RESOURCE_TEMPLATES = [
  "mukhtabir://interviews/{id}",
  "mukhtabir://interviews/{id}/analytics",
  "mukhtabir://interviews/{id}/results{?page,page_size}",
  "mukhtabir://candidates/{email}",
  "mukhtabir://feedback/{id}",
  "mukhtabir://feedback/{id}/transcript",
  "mukhtabir://feedback/{id}/recording-url",
  "mukhtabir://webhooks/{id}",
  "mukhtabir://webhooks/{id}/deliveries{?page,page_size}",
] as const;

loadRepositoryRootEnv();

const integrationEnabled = process.env.MUKHTABIR_INTEGRATION === "1";
const apiKey = process.env.MUKHTABIR_API_KEY;
const baseUrl = process.env.MUKHTABIR_BASE_URL;
const describeLive = integrationEnabled && apiKey ? describe : describe.skip;

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const tsxCliPath = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

function createLiveStdioTransport(customApiKey: string) {
  return new StdioClientTransport({
    command: process.execPath,
    args: [tsxCliPath, "src/cli.ts"],
    cwd: packageDir,
    env: {
      ...process.env,
      MUKHTABIR_API_KEY: customApiKey,
      ...(baseUrl ? { MUKHTABIR_BASE_URL: baseUrl } : {}),
    },
    stderr: "pipe",
  });
}

async function withLiveStdioClient<T>(
  customApiKey: string,
  run: (client: Client, getStderr: () => string) => Promise<T>,
) {
  let localStderr = "";
  const transport = createLiveStdioTransport(customApiKey);

  transport.stderr?.on("data", (chunk) => {
    localStderr += chunk.toString();
  });

  const client = new Client({
    name: "mukhtabir-mcp-live-aux-client",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);
    return await run(client, () => localStderr);
  } finally {
    await transport.close().catch(() => undefined);
  }
}

describeLive("Mukhtabir MCP live stdio integration", () => {
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let stderr = "";
  const cleanupInterviewIds = new Set<string>();
  const cleanupWebhookIds = new Set<string>();

  beforeAll(async () => {
    transport = createLiveStdioTransport(apiKey!);

    transport.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    client = new Client({
      name: "mukhtabir-mcp-live-test-client",
      version: "0.1.0",
    });

    await client.connect(transport);
  }, 60_000);

  afterAll(async () => {
    for (const webhookId of cleanupWebhookIds) {
      try {
        const result = await client!.callTool({
          name: "delete_webhook",
          arguments: {
            id: webhookId,
          },
        });

        if (result.isError) {
          mukhtabirMcpLogger.warning(
            "Best-effort live integration cleanup failed.",
            {
              webhook_id: webhookId,
              error: formatToolFailure(result),
            },
          );
        }
      } catch (error) {
        mukhtabirMcpLogger.warning(
          "Best-effort live integration cleanup failed.",
          {
            webhook_id: webhookId,
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : {
                    message: String(error),
                  },
          },
        );
      }
    }

    for (const interviewId of cleanupInterviewIds) {
      try {
        const result = await client!.callTool({
          name: "delete_interview",
          arguments: {
            id: interviewId,
          },
        });

        if (result.isError) {
          mukhtabirMcpLogger.warning(
            "Best-effort live integration cleanup failed.",
            {
              interview_id: interviewId,
              error: formatToolFailure(result),
            },
          );
        }
      } catch (error) {
        mukhtabirMcpLogger.warning(
          "Best-effort live integration cleanup failed.",
          {
            interview_id: interviewId,
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : {
                    message: String(error),
                  },
          },
        );
      }
    }

    if (transport) {
      await transport.close();
    }
  }, 60_000);

  async function callTool<T extends Record<string, unknown>>(
    name: string,
    args: Record<string, unknown>,
  ) {
    const result = await client!.callTool({
      name,
      arguments: args,
    });

    if (result.isError) {
      const toolError = result.structuredContent as
        | {
            error?: {
              status?: number;
              code?: string;
            };
          }
        | undefined;
      const likelyCreateCause =
        name === "create_interview" &&
        toolError?.error?.status === 500 &&
        toolError.error.code === "INTERNAL_ERROR"
          ? " Likely backend cause: the current Mukhtabir create route requires the API key's organization to have an owner/admin organization member."
          : "";

      throw new Error(
        `Tool ${name} failed: ${formatToolFailure(result)}${likelyCreateCause}`,
      );
    }

    return result.structuredContent as T;
  }

  async function createDisposableInterview(role: string) {
    const created = await callTool<{
      interview_id: string;
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("create_interview", {
      role,
      type: "technical",
      level: "senior",
      duration: 45,
      techstack: ["typescript", "node.js"],
      visibility: "private",
    });

    cleanupInterviewIds.add(created.interview_id);
    return created;
  }

  it("exposes the full live discovery surface and seeded interview listings", async () => {
    const seededInterviewId = requireFixture(
      "MUKHTABIR_INTEGRATION_INTERVIEW_ID",
    );
    const [tools, prompts, resourceTemplates] = await Promise.all([
      client!.listTools(),
      client!.listPrompts(),
      client!.listResourceTemplates(),
    ]);

    expect(tools.tools).toHaveLength(EXPECTED_TOOL_NAMES.length);
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([...EXPECTED_TOOL_NAMES]),
    );
    expect(prompts.prompts).toHaveLength(EXPECTED_PROMPT_NAMES.length);
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining([...EXPECTED_PROMPT_NAMES]),
    );
    expect(resourceTemplates.resourceTemplates).toHaveLength(
      EXPECTED_RESOURCE_TEMPLATES.length,
    );
    expect(
      resourceTemplates.resourceTemplates.map(
        (template) => template.uriTemplate,
      ),
    ).toEqual(expect.arrayContaining([...EXPECTED_RESOURCE_TEMPLATES]));

    const interviews = await callTool<{
      items: Array<{ id: string }>;
      pagination: {
        page: number;
        page_size: number;
        total: number;
      };
      meta: {
        request_id: string;
      };
    }>("list_interviews", {
      page: 1,
      page_size: 20,
    });

    expect(interviews.items.length).toBeGreaterThan(0);
    expect(interviews.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: seededInterviewId }),
      ]),
    );
    expect(interviews.pagination.page).toBe(1);
    expect(interviews.pagination.page_size).toBe(20);
    expect(interviews.pagination.total).toBeGreaterThanOrEqual(1);
    expect(interviews.meta.request_id).toEqual(expect.any(String));
    expect(stderr).toBe("");
  }, 60_000);

  it("renders live workflow prompts with seeded identifiers", async () => {
    const seededFeedbackId = requireFixture(
      "MUKHTABIR_INTEGRATION_FEEDBACK_ID",
    );
    const seededWebhookId = requireFixture("MUKHTABIR_INTEGRATION_WEBHOOK_ID");

    const [createPrompt, feedbackPrompt, webhookPrompt] = await Promise.all([
      client!.getPrompt({
        name: "create_interview_workflow",
        arguments: {
          role: "Staff Platform Engineer",
        },
      }),
      client!.getPrompt({
        name: "candidate_evaluation_summary",
        arguments: {
          feedback_id: seededFeedbackId,
        },
      }),
      client!.getPrompt({
        name: "webhook_delivery_triage",
        arguments: {
          webhook_id: seededWebhookId,
        },
      }),
    ]);

    expect(getPromptText(createPrompt)).toContain("Call `create_interview`");
    expect(getPromptText(createPrompt)).toContain(
      "- role: Staff Platform Engineer",
    );
    expect(getPromptText(feedbackPrompt)).toContain("Call `get_feedback`");
    expect(getPromptText(feedbackPrompt)).toContain(
      `- feedback_id: ${seededFeedbackId}`,
    );
    expect(getPromptText(feedbackPrompt)).toContain("Use transcript retrieval");
    expect(getPromptText(webhookPrompt)).toContain(
      "Call `list_webhook_deliveries`",
    );
    expect(getPromptText(webhookPrompt)).toContain(
      `- webhook_id: ${seededWebhookId}`,
    );
  }, 60_000);

  it("covers interview lifecycle, nested mutations, invite flow, and delete verification", async () => {
    const timestamp = new Date().toISOString();
    const initialRole = `MCP Integration Test ${timestamp}`;
    const updatedRole = `${initialRole} Updated`;
    const inviteEmail = `mcp-invite-${Date.now()}@example.com`;

    const created = await createDisposableInterview(initialRole);
    const interviewId = created.interview_id;

    expect(created.interview_id).toEqual(expect.any(String));
    expect(created.resource_uri).toBe(
      `mukhtabir://interviews/${encodeURIComponent(interviewId)}`,
    );
    expect(created.meta.request_id).toEqual(expect.any(String));

    const fetched = await callTool<{
      interview: {
        id: string;
        role: string;
        published: boolean;
      };
      resource_uri: string;
    }>("get_interview", {
      id: interviewId,
    });

    expect(fetched.interview).toMatchObject({
      id: interviewId,
      role: initialRole,
      published: false,
    });
    expect(fetched.resource_uri).toBe(created.resource_uri);

    const interviewResource = await client!.readResource({
      uri: fetched.resource_uri,
    });
    const interviewPayload = parseJsonResource<{
      success: boolean;
      data: {
        id: string;
        role: string;
      };
    }>(interviewResource.contents[0]);

    expect(interviewPayload.success).toBe(true);
    expect(interviewPayload.data).toMatchObject({
      id: interviewId,
      role: initialRole,
    });

    const updated = await callTool<{
      interview: {
        id: string;
        role: string;
        duration: number;
        visibility: string;
      };
    }>("update_interview", {
      id: interviewId,
      role: updatedRole,
      duration: 60,
      visibility: "restricted",
    });

    expect(updated.interview).toMatchObject({
      id: interviewId,
      role: updatedRole,
      duration: 60,
      visibility: "restricted",
    });

    const addedQuestion = await callTool<{
      question_id: string;
      interview_id: string;
      order_index: number;
      resource_uri: string;
    }>("add_interview_question", {
      id: interviewId,
      question: "How do you contain retry storms?",
      subquestions: ["How do you prevent duplicate work?"],
      order_index: 0,
    });

    expect(addedQuestion.interview_id).toBe(interviewId);
    expect(addedQuestion.order_index).toBe(0);

    const updatedQuestion = await callTool<{
      question_id: string;
      updated: boolean;
      resource_uri: string;
    }>("update_interview_question", {
      id: interviewId,
      question_id: addedQuestion.question_id,
      question: "How do you contain large-scale retry storms?",
      disabled: true,
      order_index: 0,
    });

    expect(updatedQuestion).toMatchObject({
      question_id: addedQuestion.question_id,
      updated: true,
      resource_uri: created.resource_uri,
    });

    const addedSubquestion = await callTool<{
      subquestion_id: string;
      question_id: string;
      interview_id: string;
      order_index: number;
    }>("add_interview_subquestion", {
      id: interviewId,
      question_id: addedQuestion.question_id,
      subquestion: "How do you expire deduplication windows?",
      order_index: 1,
    });

    expect(addedSubquestion).toMatchObject({
      question_id: addedQuestion.question_id,
      interview_id: interviewId,
      order_index: 1,
    });

    const updatedSubquestion = await callTool<{
      subquestion_id: string;
      updated: boolean;
      resource_uri: string;
    }>("update_interview_subquestion", {
      id: interviewId,
      question_id: addedQuestion.question_id,
      subquestion_id: addedSubquestion.subquestion_id,
      subquestion: "How do you bound deduplication windows?",
      disabled: true,
      order_index: 1,
    });

    expect(updatedSubquestion).toMatchObject({
      subquestion_id: addedSubquestion.subquestion_id,
      updated: true,
      resource_uri: created.resource_uri,
    });

    const addedCriteria = await callTool<{
      criteria_id: string;
      interview_id: string;
      order_index: number;
      resource_uri: string;
    }>("add_interview_criteria", {
      id: interviewId,
      criteria_title: "Reliability judgment",
      description: "Evaluates retry, deduplication, and rollback tradeoffs.",
      order_index: 0,
    });

    expect(addedCriteria).toMatchObject({
      interview_id: interviewId,
      order_index: 0,
      resource_uri: created.resource_uri,
    });

    const updatedCriteria = await callTool<{
      criteria_id: string;
      updated: boolean;
      resource_uri: string;
    }>("update_interview_criteria", {
      id: interviewId,
      criteria_id: addedCriteria.criteria_id,
      description:
        "Evaluates retries, deduplication, rollback, and observability tradeoffs.",
      disabled: true,
      order_index: 0,
    });

    expect(updatedCriteria).toMatchObject({
      criteria_id: addedCriteria.criteria_id,
      updated: true,
      resource_uri: created.resource_uri,
    });

    const nestedDetail = await callTool<{
      interview: {
        id: string;
        questions: Array<{
          id: string;
          disabled: boolean;
          orderIndex: number;
          subquestions: Array<{
            id: string;
            disabled: boolean;
            orderIndex: number;
          }>;
        }>;
        evaluationCriteriaList: Array<{
          id: string;
          disabled: boolean;
          orderIndex: number;
        }>;
      };
    }>("get_interview", {
      id: interviewId,
    });

    expect(
      nestedDetail.interview.questions.some(
        (question) =>
          question.id === addedQuestion.question_id &&
          question.disabled &&
          question.orderIndex === 0 &&
          question.subquestions.some(
            (subquestion) =>
              subquestion.id === addedSubquestion.subquestion_id &&
              subquestion.disabled &&
              subquestion.orderIndex === 1,
          ),
      ),
    ).toBe(true);
    expect(
      nestedDetail.interview.evaluationCriteriaList.some(
        (criteria) =>
          criteria.id === addedCriteria.criteria_id &&
          criteria.disabled &&
          criteria.orderIndex === 0,
      ),
    ).toBe(true);

    const deletedSubquestion = await callTool<{
      subquestion_id: string;
      deleted: boolean;
      resource_uri: string;
    }>("delete_interview_subquestion", {
      id: interviewId,
      question_id: addedQuestion.question_id,
      subquestion_id: addedSubquestion.subquestion_id,
    });

    expect(deletedSubquestion).toMatchObject({
      subquestion_id: addedSubquestion.subquestion_id,
      deleted: true,
      resource_uri: created.resource_uri,
    });

    const deletedCriteria = await callTool<{
      criteria_id: string;
      deleted: boolean;
      resource_uri: string;
    }>("delete_interview_criteria", {
      id: interviewId,
      criteria_id: addedCriteria.criteria_id,
    });

    expect(deletedCriteria).toMatchObject({
      criteria_id: addedCriteria.criteria_id,
      deleted: true,
      resource_uri: created.resource_uri,
    });

    const deletedQuestion = await callTool<{
      question_id: string;
      deleted: boolean;
      resource_uri: string;
    }>("delete_interview_question", {
      id: interviewId,
      question_id: addedQuestion.question_id,
    });

    expect(deletedQuestion).toMatchObject({
      question_id: addedQuestion.question_id,
      deleted: true,
      resource_uri: created.resource_uri,
    });

    const published = await callTool<{
      published: boolean;
      interview_id: string;
      resource_uri: string;
    }>("publish_interview", {
      id: interviewId,
    });

    expect(published).toMatchObject({
      published: true,
      interview_id: interviewId,
      resource_uri: created.resource_uri,
    });

    const invitation = await callTool<{
      invitation: {
        candidate_email: string;
        candidate_name: string;
        access_token_redacted: boolean;
        interview_url_redacted: boolean;
      };
    }>("invite_candidate_to_interview", {
      id: interviewId,
      email: inviteEmail,
      name: "MCP Invitee",
    });

    expect(invitation.invitation).toMatchObject({
      candidate_email: inviteEmail,
      candidate_name: "MCP Invitee",
      access_token_redacted: true,
      interview_url_redacted: true,
    });

    const deletedInterview = await callTool<{
      deleted: boolean;
      interview_id: string;
    }>("delete_interview", {
      id: interviewId,
    });

    expect(deletedInterview).toMatchObject({
      deleted: true,
      interview_id: interviewId,
    });
    cleanupInterviewIds.delete(interviewId);

    const deletedFetch = await client!.callTool({
      name: "get_interview",
      arguments: {
        id: interviewId,
      },
    });

    expect(deletedFetch.isError).toBe(true);
    expect(deletedFetch.structuredContent).toMatchObject({
      error: {
        status: 404,
        code: "RESOURCE_NOT_FOUND",
      },
    });
    expect(stderr).toBe("");
  }, 90_000);

  it("covers seeded interview read surfaces, candidates, feedback, and webhook handlers", async () => {
    const seededInterviewId = requireFixture(
      "MUKHTABIR_INTEGRATION_INTERVIEW_ID",
    );
    const seededFeedbackId = requireFixture(
      "MUKHTABIR_INTEGRATION_FEEDBACK_ID",
    );
    const seededWebhookId = requireFixture("MUKHTABIR_INTEGRATION_WEBHOOK_ID");
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const candidateEmail = `mcp-candidate-${uniqueSuffix}@example.com`;
    const webhookUrl = `https://example.com/mcp-live-${uniqueSuffix}`;

    const seededInterview = await callTool<{
      interview: {
        id: string;
        techstack: string[];
        questions: Array<{
          id: string;
          orderIndex: number;
          subquestions: Array<{
            id: string;
            orderIndex: number;
          }>;
        }>;
        evaluationCriteriaList: Array<{
          id: string;
          orderIndex: number;
        }>;
      };
      resource_uri: string;
    }>("get_interview", {
      id: seededInterviewId,
    });

    expect(seededInterview.interview.id).toBe(seededInterviewId);
    expect(seededInterview.interview.techstack.length).toBeGreaterThan(0);
    expect(seededInterview.interview.questions.length).toBeGreaterThan(0);
    expect(
      seededInterview.interview.questions[0]?.subquestions.length,
    ).toBeGreaterThan(0);
    expect(
      seededInterview.interview.evaluationCriteriaList.length,
    ).toBeGreaterThan(0);

    const seededInterviewResource = await client!.readResource({
      uri: seededInterview.resource_uri,
    });
    const seededInterviewPayload = parseJsonResource<{
      success: boolean;
      data: {
        id: string;
      };
    }>(seededInterviewResource.contents[0]);
    expect(seededInterviewPayload.success).toBe(true);
    expect(seededInterviewPayload.data.id).toBe(seededInterviewId);

    const results = await callTool<{
      item_count: number;
      items_preview: Array<{ interview_id?: string }>;
      items_truncated: boolean;
      pagination: {
        page: number;
        page_size: number;
      };
      meta: {
        request_id: string;
      };
      resource_uri: string;
    }>("list_interview_results", {
      id: seededInterviewId,
      page: 1,
      page_size: 20,
    });

    expect(results.item_count).toBeGreaterThanOrEqual(1);
    expect(results.items_preview.length).toBeGreaterThanOrEqual(1);
    expect(results.pagination.page).toBe(1);
    expect(results.pagination.page_size).toBe(20);
    expect(results.meta.request_id).toEqual(expect.any(String));
    expect(results.resource_uri).toBe(
      `mukhtabir://interviews/${encodeURIComponent(seededInterviewId)}/results?page=1&page_size=20`,
    );

    const resultsResource = await client!.readResource({
      uri: results.resource_uri,
    });
    const resultsPayload = parseJsonResource<{
      success: boolean;
      data: Array<{ interview_id: string }>;
    }>(resultsResource.contents[0]);
    expect(resultsPayload.success).toBe(true);
    expect(resultsPayload.data[0]?.interview_id).toBe(seededInterviewId);

    const analytics = await callTool<{
      analytics: {
        interview_id: string;
        evaluated_count?: number;
        total_candidates?: number;
      };
      meta: {
        request_id: string;
      };
      resource_uri: string;
    }>("get_interview_analytics", {
      id: seededInterviewId,
    });

    expect(analytics.analytics.interview_id).toBe(seededInterviewId);
    expect(
      analytics.analytics.evaluated_count ??
        analytics.analytics.total_candidates ??
        0,
    ).toBeGreaterThanOrEqual(1);
    expect(analytics.meta.request_id).toEqual(expect.any(String));

    const analyticsResource = await client!.readResource({
      uri: analytics.resource_uri,
    });
    const analyticsPayload = parseJsonResource<{
      success: boolean;
      data: {
        interview_id: string;
      };
    }>(analyticsResource.contents[0]);
    expect(analyticsPayload.success).toBe(true);
    expect(analyticsPayload.data.interview_id).toBe(seededInterviewId);

    const registeredCandidate = await callTool<{
      candidate: {
        email: string;
        access_token_redacted: boolean;
        interview_url_redacted: boolean;
      };
      meta: {
        request_id: string;
      };
    }>("register_candidate", {
      email: candidateEmail,
      name: "MCP Live Candidate",
      interview_id: seededInterviewId,
    });

    expect(registeredCandidate.candidate).toMatchObject({
      email: candidateEmail,
      access_token_redacted: true,
      interview_url_redacted: true,
    });
    expect(registeredCandidate.meta.request_id).toEqual(expect.any(String));

    const listedCandidates = await callTool<{
      items: Array<{ email: string }>;
      pagination: {
        total: number;
      };
      meta: {
        request_id: string;
      };
    }>("list_candidates", {
      page: 1,
      page_size: 100,
    });

    expect(listedCandidates.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: candidateEmail }),
      ]),
    );
    expect(listedCandidates.pagination.total).toBeGreaterThanOrEqual(1);
    expect(listedCandidates.meta.request_id).toEqual(expect.any(String));

    const candidate = await callTool<{
      candidate: {
        email: string;
      };
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("get_candidate", {
      email: candidateEmail,
    });

    expect(candidate.candidate.email).toBe(candidateEmail);
    expect(candidate.meta.request_id).toEqual(expect.any(String));

    const candidateResource = await client!.readResource({
      uri: candidate.resource_uri,
    });
    const candidatePayload = parseJsonResource<{
      success: boolean;
      data: {
        email: string;
      };
    }>(candidateResource.contents[0]);
    expect(candidatePayload.success).toBe(true);
    expect(candidatePayload.data.email).toBe(candidateEmail);

    const feedback = await callTool<{
      feedback: {
        id: string;
        final_assessment: string;
      };
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("get_feedback", {
      id: seededFeedbackId,
    });

    expect(feedback.feedback).toMatchObject({
      id: seededFeedbackId,
      final_assessment: "Strong hire",
    });
    expect(feedback.meta.request_id).toEqual(expect.any(String));

    const feedbackResource = await client!.readResource({
      uri: feedback.resource_uri,
    });
    const feedbackPayload = parseJsonResource<{
      success: boolean;
      data: {
        id: string;
        evaluation_model: string;
      };
    }>(feedbackResource.contents[0]);
    expect(feedbackPayload.success).toBe(true);
    expect(feedbackPayload.data.id).toBe(seededFeedbackId);
    expect(feedbackPayload.data.evaluation_model).toBe("gpt-5");

    const transcript = await callTool<{
      feedback_id: string;
      has_transcript: boolean;
      transcript: string;
      transcript_truncated: boolean;
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("get_feedback_transcript", {
      id: seededFeedbackId,
    });

    expect(transcript.feedback_id).toBe(seededFeedbackId);
    expect(transcript.has_transcript).toBe(true);
    expect(transcript.transcript_truncated).toBe(false);
    expect(transcript.transcript).toContain("Transcript text");
    expect(transcript.meta.request_id).toEqual(expect.any(String));

    const transcriptResource = await client!.readResource({
      uri: transcript.resource_uri,
    });
    expect(getTextContent(transcriptResource.contents[0])).toContain(
      "Transcript text",
    );

    const recording = await callTool<{
      recording: {
        feedback_id: string;
        source: string;
        recording_url: string;
      };
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("get_feedback_recording_url", {
      id: seededFeedbackId,
    });

    expect(recording.recording.feedback_id).toBe(seededFeedbackId);
    expect(recording.recording.source).toBe("local");
    expect(recording.recording.recording_url).toContain("/api/recordings/");
    expect(recording.meta.request_id).toEqual(expect.any(String));

    const recordingResource = await client!.readResource({
      uri: recording.resource_uri,
    });
    const recordingPayload = parseJsonResource<{
      success: boolean;
      data: {
        feedback_id: string;
        source: string;
        recording_url: string;
      };
    }>(recordingResource.contents[0]);
    expect(recordingPayload.success).toBe(true);
    expect(recordingPayload.data.feedback_id).toBe(seededFeedbackId);
    expect(recordingPayload.data.source).toBe("local");
    expect(recordingPayload.data.recording_url).toContain("/api/recordings/");

    const listedWebhooks = await callTool<{
      items: Array<{ id: string }>;
      pagination: {
        total: number;
      };
      meta: {
        request_id: string;
      };
    }>("list_webhooks", {
      page: 1,
      page_size: 100,
    });

    expect(listedWebhooks.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: seededWebhookId }),
      ]),
    );
    expect(listedWebhooks.pagination.total).toBeGreaterThanOrEqual(1);
    expect(listedWebhooks.meta.request_id).toEqual(expect.any(String));

    const seededWebhook = await callTool<{
      webhook: {
        id: string;
      };
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("get_webhook", {
      id: seededWebhookId,
    });

    expect(seededWebhook.webhook.id).toBe(seededWebhookId);
    expect(seededWebhook.meta.request_id).toEqual(expect.any(String));

    const seededWebhookResource = await client!.readResource({
      uri: seededWebhook.resource_uri,
    });
    const seededWebhookPayload = parseJsonResource<{
      success: boolean;
      data: {
        id: string;
      };
    }>(seededWebhookResource.contents[0]);
    expect(seededWebhookPayload.success).toBe(true);
    expect(seededWebhookPayload.data.id).toBe(seededWebhookId);

    const createdWebhook = await callTool<{
      webhook: {
        id: string;
        url: string;
        secret_redacted: boolean;
        secret_preview: string;
      };
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("create_webhook", {
      url: webhookUrl,
      events: ["interview.completed"],
      description: "mcp live integration",
    });

    cleanupWebhookIds.add(createdWebhook.webhook.id);
    expect(createdWebhook.webhook).toMatchObject({
      url: webhookUrl,
      secret_redacted: true,
      secret_preview: expect.any(String),
    });
    expect(createdWebhook.webhook).not.toHaveProperty("secret");
    expect(createdWebhook.meta.request_id).toEqual(expect.any(String));

    const updatedWebhook = await callTool<{
      webhook: {
        id: string;
        description: string;
        is_active: boolean;
      };
      meta: {
        request_id: string;
      };
    }>("update_webhook", {
      id: createdWebhook.webhook.id,
      description: "mcp live integration updated",
      is_active: false,
    });

    expect(updatedWebhook.webhook).toMatchObject({
      id: createdWebhook.webhook.id,
      description: "mcp live integration updated",
      is_active: false,
    });
    expect(updatedWebhook.meta.request_id).toEqual(expect.any(String));

    const testedWebhook = await callTool<{
      delivery: {
        delivery_id: string;
        status: string;
      };
      meta: {
        request_id: string;
      };
    }>("test_webhook", {
      id: seededWebhookId,
    });

    expect(testedWebhook.delivery.delivery_id).toEqual(expect.any(String));
    expect(testedWebhook.delivery.status).toBe("delivered");
    expect(testedWebhook.meta.request_id).toEqual(expect.any(String));

    const deliveries = await callTool<{
      item_count: number;
      items_preview: Array<{ id: string }>;
      pagination: {
        page: number;
        page_size: number;
      };
      resource_uri: string;
      meta: {
        request_id: string;
      };
    }>("list_webhook_deliveries", {
      id: seededWebhookId,
      page: 1,
      page_size: 20,
    });

    expect(deliveries.item_count).toBeGreaterThanOrEqual(1);
    expect(deliveries.items_preview.length).toBeGreaterThanOrEqual(1);
    expect(deliveries.pagination.page).toBe(1);
    expect(deliveries.pagination.page_size).toBe(20);
    expect(deliveries.meta.request_id).toEqual(expect.any(String));

    const deliveriesResource = await client!.readResource({
      uri: deliveries.resource_uri,
    });
    const deliveriesPayload = parseJsonResource<{
      success: boolean;
      data: Array<{ id: string }>;
    }>(deliveriesResource.contents[0]);
    expect(deliveriesPayload.success).toBe(true);
    expect(deliveriesPayload.data.length).toBeGreaterThanOrEqual(1);

    const deletedWebhook = await callTool<{
      deleted: boolean;
      webhook_id: string;
      meta: {
        request_id: string;
      };
    }>("delete_webhook", {
      id: createdWebhook.webhook.id,
    });

    expect(deletedWebhook).toMatchObject({
      deleted: true,
      webhook_id: createdWebhook.webhook.id,
    });
    cleanupWebhookIds.delete(createdWebhook.webhook.id);
    expect(stderr).toBe("");
  }, 90_000);

  it("maps live validation and missing-resource failures into MCP-safe errors", async () => {
    const invalidCandidate = await client!.callTool({
      name: "register_candidate",
      arguments: {
        email: "not-an-email",
        name: "Invalid Candidate",
      },
    });

    expect(invalidCandidate.isError).toBe(true);
    expect(invalidCandidate.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringMatching(/email/i),
        }),
      ]),
    );

    const missingFeedback = await client!.callTool({
      name: "get_feedback",
      arguments: {
        id: randomUUID(),
      },
    });

    expect(missingFeedback.isError).toBe(true);
    expect(missingFeedback.structuredContent).toMatchObject({
      error: {
        status: 404,
        code: "RESOURCE_NOT_FOUND",
      },
    });

    let missingFeedbackResourceError: unknown;

    try {
      await client!.readResource({
        uri: `mukhtabir://feedback/${encodeURIComponent(randomUUID())}`,
      });
    } catch (error) {
      missingFeedbackResourceError = error;
    }

    expect(missingFeedbackResourceError).toBeInstanceOf(McpError);
    expect((missingFeedbackResourceError as McpError).data).toMatchObject({
      error: {
        status: 404,
        code: "RESOURCE_NOT_FOUND",
      },
    });
    expect(stderr).toBe("");
  }, 60_000);

  it("maps live backend auth failures into MCP-safe tool and resource errors", async () => {
    const seededFeedbackId = requireFixture(
      "MUKHTABIR_INTEGRATION_FEEDBACK_ID",
    );
    const limitedApiKey = requireFixture(
      "MUKHTABIR_INTEGRATION_LIMITED_API_KEY",
    );
    const revokedApiKey = requireFixture(
      "MUKHTABIR_INTEGRATION_REVOKED_API_KEY",
    );

    await withLiveStdioClient(
      limitedApiKey,
      async (limitedClient, getLimitedStderr) => {
        const insufficientScope = await limitedClient.callTool({
          name: "get_feedback",
          arguments: {
            id: seededFeedbackId,
          },
        });

        expect(insufficientScope.isError).toBe(true);
        expect(insufficientScope.structuredContent).toMatchObject({
          error: {
            status: 403,
            code: "INSUFFICIENT_SCOPE",
          },
        });

        let insufficientScopeResourceError: unknown;

        try {
          await limitedClient.readResource({
            uri: `mukhtabir://feedback/${encodeURIComponent(seededFeedbackId)}`,
          });
        } catch (error) {
          insufficientScopeResourceError = error;
        }

        expect(insufficientScopeResourceError).toBeInstanceOf(McpError);
        expect((insufficientScopeResourceError as McpError).data).toMatchObject(
          {
            error: {
              status: 403,
              code: "INSUFFICIENT_SCOPE",
            },
          },
        );
        expect(getLimitedStderr()).toBe("");
      },
    );

    await withLiveStdioClient(
      revokedApiKey,
      async (revokedClient, getRevokedStderr) => {
        const revoked = await revokedClient.callTool({
          name: "list_interviews",
          arguments: {
            page: 1,
            page_size: 1,
          },
        });

        expect(revoked.isError).toBe(true);
        expect(revoked.structuredContent).toMatchObject({
          error: {
            status: 403,
            code: "API_KEY_REVOKED",
          },
        });
        expect(getRevokedStderr()).toBe("");
      },
    );

    expect(stderr).toBe("");
  }, 60_000);
});

describeLive("Mukhtabir MCP live HTTP integration", () => {
  it("serves live authenticated HTTP requests and filters read-only tenants", async () => {
    const seededInterviewId = requireFixture(
      "MUKHTABIR_INTEGRATION_INTERVIEW_ID",
    );
    const configuredBaseUrl = requireFixture("MUKHTABIR_BASE_URL");
    const fullToken = "mcp_live_http_full";
    const readonlyToken = "mcp_live_http_readonly";
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [configuredBaseUrl],
      tenants: [
        {
          tenantId: "tenant-full",
          bearerToken: fullToken,
          apiKey: apiKey!,
          baseUrl: configuredBaseUrl,
        },
        {
          tenantId: "tenant-readonly",
          bearerToken: readonlyToken,
          apiKey: apiKey!,
          baseUrl: configuredBaseUrl,
          scopes: ["read"],
        },
      ],
    });
    const fullTransport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: `Bearer ${fullToken}`,
          },
        },
      },
    );
    const readonlyTransport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: `Bearer ${readonlyToken}`,
          },
        },
      },
    );
    const invalidTransport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer wrong_token",
          },
        },
      },
    );
    const fullClient = new Client({
      name: "mukhtabir-mcp-live-http-client",
      version: "0.1.0",
    });
    const readonlyClient = new Client({
      name: "mukhtabir-mcp-live-http-readonly-client",
      version: "0.1.0",
    });
    const invalidClient = new Client({
      name: "mukhtabir-mcp-live-http-invalid-client",
      version: "0.1.0",
    });

    try {
      await fullClient.connect(fullTransport);
      expect(fullTransport.sessionId).toEqual(expect.any(String));

      const fetched = await fullClient.callTool({
        name: "get_interview",
        arguments: {
          id: seededInterviewId,
        },
      });

      expect(fetched.isError).not.toBe(true);
      expect(fetched.structuredContent).toMatchObject({
        interview: {
          id: seededInterviewId,
        },
      });

      await expect(invalidClient.connect(invalidTransport)).rejects.toThrow(
        /unauthorized|token|401/i,
      );

      await readonlyClient.connect(readonlyTransport);

      const [tools, prompts] = await Promise.all([
        readonlyClient.listTools(),
        readonlyClient.listPrompts(),
      ]);

      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "list_interviews",
          "get_interview",
          "get_feedback",
          "list_webhooks",
        ]),
      );
      expect(tools.tools.map((tool) => tool.name)).not.toEqual(
        expect.arrayContaining([
          "create_interview",
          "update_interview",
          "delete_interview",
          "register_candidate",
          "create_webhook",
          "delete_webhook",
        ]),
      );
      expect(prompts.prompts.map((prompt) => prompt.name)).not.toEqual(
        expect.arrayContaining([
          "create_interview_workflow",
          "invite_candidate_workflow",
        ]),
      );
    } finally {
      await fullTransport.terminateSession().catch(() => undefined);
      await readonlyTransport.terminateSession().catch(() => undefined);
      await fullTransport.close().catch(() => undefined);
      await readonlyTransport.close().catch(() => undefined);
      await invalidTransport.close().catch(() => undefined);
      await httpServer.close();
    }
  }, 60_000);

  it("rate-limits live HTTP follow-up requests", async () => {
    const configuredBaseUrl = requireFixture("MUKHTABIR_BASE_URL");
    const rateLimitedToken = "mcp_live_http_rate_limited";
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [configuredBaseUrl],
      rateLimit: {
        windowMs: 1_000,
        maxRequests: 2,
        maxInitializeRequests: 1,
      },
      tenants: [
        {
          tenantId: "tenant-rate-limited",
          bearerToken: rateLimitedToken,
          apiKey: apiKey!,
          baseUrl: configuredBaseUrl,
        },
      ],
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: `Bearer ${rateLimitedToken}`,
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-live-http-rate-limit-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      expect(transport.sessionId).toEqual(expect.any(String));

      const response = await fetch(httpServer.url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${rateLimitedToken}`,
          "content-type": "application/json",
          "mcp-session-id": transport.sessionId as string,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      });

      expect(response.status).toBe(429);
      expect(await response.text()).toMatch(/rate limit/i);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  }, 60_000);
});
