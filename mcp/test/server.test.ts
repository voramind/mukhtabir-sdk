import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMockMukhtabirApi } from "./mock-api";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const tsxCliPath = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

describe("Mukhtabir MCP stdio server", () => {
  const mockApi = createMockMukhtabirApi();
  let client: Client;
  let transport: StdioClientTransport;
  let stderr = "";

  beforeAll(async () => {
    mockApi.listen(0, "127.0.0.1");
    await once(mockApi, "listening");

    const { port } = mockApi.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCliPath, "src/cli.ts"],
      cwd: packageDir,
      env: {
        ...process.env,
        MUKHTABIR_API_KEY: "mk_test_123",
        MUKHTABIR_BASE_URL: baseUrl,
      },
      stderr: "pipe",
    });

    transport.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    client = new Client({
      name: "mukhtabir-mcp-test-client",
      version: "0.1.0",
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await transport.close();
    mockApi.close();
  });

  it("registers the planned tools, prompts, and resource templates", async () => {
    const [tools, prompts, resourceTemplates] = await Promise.all([
      client.listTools(),
      client.listPrompts(),
      client.listResourceTemplates(),
    ]);

    expect(tools.tools).toHaveLength(31);
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
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
      ]),
    );
    expect(prompts.prompts).toHaveLength(5);
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining([
        "create_interview_workflow",
        "invite_candidate_workflow",
        "candidate_evaluation_summary",
        "interview_analytics_report",
        "webhook_delivery_triage",
      ]),
    );
    expect(resourceTemplates.resourceTemplates).toHaveLength(9);
    expect(
      resourceTemplates.resourceTemplates.map(
        (template) => template.uriTemplate,
      ),
    ).toEqual(
      expect.arrayContaining([
        "mukhtabir://interviews/{id}",
        "mukhtabir://interviews/{id}/analytics",
        "mukhtabir://interviews/{id}/results{?page,page_size}",
        "mukhtabir://candidates/{email}",
        "mukhtabir://feedback/{id}",
        "mukhtabir://feedback/{id}/transcript",
        "mukhtabir://feedback/{id}/recording-url",
        "mukhtabir://webhooks/{id}",
        "mukhtabir://webhooks/{id}/deliveries{?page,page_size}",
      ]),
    );
    expect(stderr).toBe("");
  });

  it("returns workflow prompt content for guided MCP flows", async () => {
    const prompt = await client.getPrompt({
      name: "interview_analytics_report",
      arguments: {
        interview_id: "int_123",
      },
    });

    expect(prompt.messages).toHaveLength(1);
    expect(prompt.messages[0]).toMatchObject({
      role: "user",
      content: {
        type: "text",
        text: expect.stringContaining("Call `get_interview_analytics`"),
      },
    });
    expect(
      "text" in prompt.messages[0].content
        ? prompt.messages[0].content.text
        : "",
    ).toContain("interview_id: int_123");
  });

  it("keeps invite workflow guidance aligned with redacted invitation output", async () => {
    const prompt = await client.getPrompt({
      name: "invite_candidate_workflow",
      arguments: {
        interview_id: "int_123",
        candidate_name: "Candidate Example",
        candidate_email: "candidate@example.com",
      },
    });

    expect(prompt.messages).toHaveLength(1);
    expect(
      "text" in prompt.messages[0].content
        ? prompt.messages[0].content.text
        : "",
    ).toContain("Return the redacted invitation URL and expiry time.");
  });

  it("supports the interview create, publish, and invite happy path", async () => {
    const createResult = await client.callTool({
      name: "create_interview",
      arguments: {
        role: "Backend Engineer",
        type: "technical",
        level: "senior",
        duration: 45,
      },
    });

    const created = createResult.structuredContent as {
      interview_id: string;
      resource_uri: string;
    };

    expect(createResult.isError).not.toBe(true);
    expect(created.interview_id).toBe("int_created");
    expect(created.resource_uri).toBe("mukhtabir://interviews/int_created");

    const publishResult = await client.callTool({
      name: "publish_interview",
      arguments: {
        id: created.interview_id,
      },
    });

    const published = publishResult.structuredContent as {
      published: boolean;
      interview_id: string;
    };

    expect(publishResult.isError).not.toBe(true);
    expect(published).toMatchObject({
      published: true,
      interview_id: "int_created",
    });

    const inviteResult = await client.callTool({
      name: "invite_candidate_to_interview",
      arguments: {
        id: created.interview_id,
        email: "candidate@example.com",
        name: "Candidate Example",
      },
    });

    const invitation = inviteResult.structuredContent as {
      invitation: {
        candidate_email: string;
        candidate_name: string;
        access_token_redacted: boolean;
        interview_url_redacted: boolean;
        interview_url: string;
      };
    };

    expect(inviteResult.isError).not.toBe(true);
    expect(invitation.invitation).toMatchObject({
      candidate_email: "candidate@example.com",
      candidate_name: "Candidate Example",
      access_token_redacted: true,
      interview_url_redacted: true,
    });
    expect(invitation.invitation.interview_url).toBe(
      "https://mukhtabir.example/interviews/int_created",
    );
  });

  it("redacts candidate access tokens in tool output", async () => {
    const result = await client.callTool({
      name: "register_candidate",
      arguments: {
        email: "candidate@example.com",
        name: "Candidate Example",
        interview_id: "int_123",
      },
    });

    const structured = result.structuredContent as {
      candidate: {
        access_token_redacted: boolean;
        interview_url_redacted: boolean;
        interview_url: string;
      };
    };

    expect(result.isError).not.toBe(true);
    expect(structured.candidate.access_token_redacted).toBe(true);
    expect(structured.candidate.interview_url_redacted).toBe(true);
    expect(structured.candidate.interview_url).toBe(
      "https://mukhtabir.example/interviews/int_123",
    );
  });

  it("supports interview-content question, subquestion, and criteria mutation tools", async () => {
    const addQuestionResult = await client.callTool({
      name: "add_interview_question",
      arguments: {
        id: "int_123",
        question: "How do you operate distributed queues?",
        subquestions: ["How do you handle retries?"],
        order_index: 1,
      },
    });

    const addedQuestion = addQuestionResult.structuredContent as {
      question_id: string;
      interview_id: string;
      order_index: number;
      resource_uri: string;
    };

    expect(addQuestionResult.isError).not.toBe(true);
    expect(addedQuestion).toMatchObject({
      question_id: "q_created",
      interview_id: "int_123",
      order_index: 1,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const updateQuestionResult = await client.callTool({
      name: "update_interview_question",
      arguments: {
        id: "int_123",
        question_id: "q_created",
        question: "How do you operate durable queues?",
        disabled: false,
      },
    });

    expect(updateQuestionResult.isError).not.toBe(true);
    expect(updateQuestionResult.structuredContent).toMatchObject({
      question_id: "q_created",
      updated: true,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const addSubquestionResult = await client.callTool({
      name: "add_interview_subquestion",
      arguments: {
        id: "int_123",
        question_id: "q_created",
        subquestion: "How do you design idempotency keys?",
        order_index: 1,
      },
    });

    const addedSubquestion = addSubquestionResult.structuredContent as {
      subquestion_id: string;
      question_id: string;
      interview_id: string;
      order_index: number;
    };

    expect(addSubquestionResult.isError).not.toBe(true);
    expect(addedSubquestion).toMatchObject({
      subquestion_id: "sq_created",
      question_id: "q_created",
      interview_id: "int_123",
      order_index: 1,
    });

    const updateSubquestionResult = await client.callTool({
      name: "update_interview_subquestion",
      arguments: {
        id: "int_123",
        question_id: "q_created",
        subquestion_id: "sq_created",
        subquestion: "How do you validate dedup windows?",
        disabled: false,
      },
    });

    expect(updateSubquestionResult.isError).not.toBe(true);
    expect(updateSubquestionResult.structuredContent).toMatchObject({
      subquestion_id: "sq_created",
      updated: true,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const deleteSubquestionResult = await client.callTool({
      name: "delete_interview_subquestion",
      arguments: {
        id: "int_123",
        question_id: "q_created",
        subquestion_id: "sq_created",
      },
    });

    expect(deleteSubquestionResult.isError).not.toBe(true);
    expect(deleteSubquestionResult.structuredContent).toMatchObject({
      subquestion_id: "sq_created",
      deleted: true,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const deleteQuestionResult = await client.callTool({
      name: "delete_interview_question",
      arguments: {
        id: "int_123",
        question_id: "q_created",
      },
    });

    expect(deleteQuestionResult.isError).not.toBe(true);
    expect(deleteQuestionResult.structuredContent).toMatchObject({
      question_id: "q_created",
      deleted: true,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const addCriteriaResult = await client.callTool({
      name: "add_interview_criteria",
      arguments: {
        id: "int_123",
        criteria_title: "Architecture depth",
        description: "Evaluate tradeoffs, latency, and durability.",
        order_index: 1,
      },
    });

    expect(addCriteriaResult.isError).not.toBe(true);
    expect(addCriteriaResult.structuredContent).toMatchObject({
      criteria_id: "crit_created",
      interview_id: "int_123",
      order_index: 1,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const updateCriteriaResult = await client.callTool({
      name: "update_interview_criteria",
      arguments: {
        id: "int_123",
        criteria_id: "crit_created",
        criteria_title: "Architecture and reliability depth",
        disabled: false,
      },
    });

    expect(updateCriteriaResult.isError).not.toBe(true);
    expect(updateCriteriaResult.structuredContent).toMatchObject({
      criteria_id: "crit_created",
      updated: true,
      resource_uri: "mukhtabir://interviews/int_123",
    });

    const deleteCriteriaResult = await client.callTool({
      name: "delete_interview_criteria",
      arguments: {
        id: "int_123",
        criteria_id: "crit_created",
      },
    });

    expect(deleteCriteriaResult.isError).not.toBe(true);
    expect(deleteCriteriaResult.structuredContent).toMatchObject({
      criteria_id: "crit_created",
      deleted: true,
      resource_uri: "mukhtabir://interviews/int_123",
    });
  });

  it("supports interview detail, analytics, update, and delete flows", async () => {
    const listResult = await client.callTool({
      name: "list_interviews",
      arguments: {
        page: 1,
        page_size: 20,
      },
    });

    const listed = listResult.structuredContent as {
      items: Array<{ id: string; role: string }>;
      pagination: {
        total: number;
      };
    };

    expect(listResult.isError).not.toBe(true);
    expect(listed.items).toEqual([
      expect.objectContaining({
        id: "int_123",
        role: "Backend Engineer",
      }),
    ]);
    expect(listed.pagination.total).toBe(1);

    const getResult = await client.callTool({
      name: "get_interview",
      arguments: {
        id: "int_123",
      },
    });

    const fetched = getResult.structuredContent as {
      interview: {
        id: string;
        role: string;
        techstack: string[];
        questions: Array<{
          id: string;
          question: string;
          disabled: boolean;
          orderIndex: number;
          subquestions: Array<{
            id: string;
            text: string;
            disabled: boolean;
            orderIndex: number;
          }>;
        }>;
        evaluationCriteriaList: Array<{
          id: string;
          criteriaTitle: string;
          disabled: boolean;
          orderIndex: number;
        }>;
      };
      resource_uri: string;
    };

    expect(getResult.isError).not.toBe(true);
    expect(fetched.interview).toMatchObject({
      id: "int_123",
      role: "Backend Engineer",
    });
    expect(fetched.interview.questions).toEqual([
      expect.objectContaining({
        id: "q_123",
        question: "How would you scale an event-driven system?",
        disabled: false,
        orderIndex: 0,
        subquestions: [
          expect.objectContaining({
            id: "sq_123",
            text: "How do you handle retries?",
            disabled: false,
            orderIndex: 0,
          }),
          expect.objectContaining({
            id: "sq_124",
            text: "How do you handle idempotency?",
            disabled: true,
            orderIndex: 1,
          }),
        ],
      }),
    ]);
    expect(fetched.interview.evaluationCriteriaList).toEqual([
      expect.objectContaining({
        id: "crit_123",
        criteriaTitle: "System design",
        disabled: false,
        orderIndex: 0,
      }),
    ]);
    expect(fetched.interview.techstack).toContain("redis");
    expect(fetched.resource_uri).toBe("mukhtabir://interviews/int_123");

    const interviewResource = await client.readResource({
      uri: fetched.resource_uri,
    });

    expect(interviewResource.contents).toHaveLength(1);
    expect(
      "text" in interviewResource.contents[0]
        ? interviewResource.contents[0].text
        : "",
    ).toContain('"userName": "Hiring Manager"');
    expect(
      "text" in interviewResource.contents[0]
        ? interviewResource.contents[0].text
        : "",
    ).toContain('"orderIndex": 0');
    expect(
      "text" in interviewResource.contents[0]
        ? interviewResource.contents[0].text
        : "",
    ).toContain('"id": "q_123"');
    expect(
      "text" in interviewResource.contents[0]
        ? interviewResource.contents[0].text
        : "",
    ).toContain('"id": "sq_123"');
    expect(
      "text" in interviewResource.contents[0]
        ? interviewResource.contents[0].text
        : "",
    ).toContain('"id": "crit_123"');

    const updateResult = await client.callTool({
      name: "update_interview",
      arguments: {
        id: "int_123",
        role: "Principal Backend Engineer",
        duration: 60,
        visibility: "restricted",
        published: false,
      },
    });

    const updated = updateResult.structuredContent as {
      interview: {
        id: string;
        role: string;
        duration: number;
        visibility: string;
        published: boolean;
      };
    };

    expect(updateResult.isError).not.toBe(true);
    expect(updated.interview).toMatchObject({
      id: "int_123",
      role: "Principal Backend Engineer",
      duration: 60,
      visibility: "restricted",
      published: false,
    });

    const analyticsResult = await client.callTool({
      name: "get_interview_analytics",
      arguments: {
        id: "int_123",
      },
    });

    const analytics = analyticsResult.structuredContent as {
      analytics: {
        interview_id: string;
        total_candidates: number;
        completion: {
          completed: number;
        };
      };
      resource_uri: string;
    };

    expect(analyticsResult.isError).not.toBe(true);
    expect(analytics.analytics).toMatchObject({
      interview_id: "int_123",
      total_candidates: 6,
      completion: {
        completed: 5,
      },
    });
    expect(analytics.resource_uri).toBe(
      "mukhtabir://interviews/int_123/analytics",
    );

    const analyticsResource = await client.readResource({
      uri: analytics.resource_uri,
    });

    expect(
      "text" in analyticsResource.contents[0]
        ? analyticsResource.contents[0].text
        : "",
    ).toContain('"average_score": 91');

    const deleteResult = await client.callTool({
      name: "delete_interview",
      arguments: {
        id: "int_123",
      },
    });

    const deleted = deleteResult.structuredContent as {
      deleted: boolean;
      interview_id: string;
    };

    expect(deleteResult.isError).not.toBe(true);
    expect(deleted).toMatchObject({
      deleted: true,
      interview_id: "int_123",
    });
  });

  it("returns preview-shaped output for interview results pages", async () => {
    const result = await client.callTool({
      name: "list_interview_results",
      arguments: {
        id: "int_123",
        page: 1,
        page_size: 20,
      },
    });

    const structured = result.structuredContent as {
      item_count: number;
      items_preview: Array<{ id: string }>;
      items_truncated: boolean;
      resource_uri: string;
    };

    expect(result.isError).not.toBe(true);
    expect(structured.item_count).toBe(6);
    expect(structured.items_preview).toHaveLength(5);
    expect(structured.items_truncated).toBe(true);
    expect(structured.resource_uri).toBe(
      "mukhtabir://interviews/int_123/results?page=1&page_size=20",
    );
    expect(structured).not.toHaveProperty("items");

    const resource = await client.readResource({
      uri: structured.resource_uri,
    });

    expect(resource.contents).toHaveLength(1);
    expect(
      "text" in resource.contents[0] ? resource.contents[0].text : "",
    ).toContain('"id": "result_1"');
  });

  it("serves transcripts through both the tool and the resource", async () => {
    const toolResult = await client.callTool({
      name: "get_feedback_transcript",
      arguments: {
        id: "fb_123",
      },
    });

    const structured = toolResult.structuredContent as {
      has_transcript: boolean;
      transcript: string;
      transcript_truncated: boolean;
      resource_uri: string;
    };

    expect(toolResult.isError).not.toBe(true);
    expect(structured.has_transcript).toBe(true);
    expect(structured.transcript_truncated).toBe(false);
    expect(structured.resource_uri).toBe(
      "mukhtabir://feedback/fb_123/transcript",
    );
    expect(structured.transcript).toContain("queue-based fan-out");

    const resource = await client.readResource({
      uri: "mukhtabir://feedback/fb_123/transcript",
    });

    expect(resource.contents).toHaveLength(1);
    expect(
      "text" in resource.contents[0] ? resource.contents[0].text : "",
    ).toContain("idempotent workers");
  });

  it("supports the remaining candidate, feedback, and webhook handlers", async () => {
    const listCandidatesResult = await client.callTool({
      name: "list_candidates",
      arguments: {
        page: 1,
        page_size: 20,
      },
    });

    const candidates = listCandidatesResult.structuredContent as {
      items: Array<{ email: string; completed_interviews: number }>;
      pagination: {
        total: number;
      };
    };

    expect(listCandidatesResult.isError).not.toBe(true);
    expect(candidates.items).toEqual([
      expect.objectContaining({
        email: "candidate@example.com",
        completed_interviews: 1,
      }),
    ]);
    expect(candidates.pagination.total).toBe(1);

    const getCandidateResult = await client.callTool({
      name: "get_candidate",
      arguments: {
        email: "candidate@example.com",
      },
    });

    const candidate = getCandidateResult.structuredContent as {
      candidate: {
        email: string;
        feedback: Array<{ feedback_id: string }>;
      };
      resource_uri: string;
    };

    expect(getCandidateResult.isError).not.toBe(true);
    expect(candidate.candidate.email).toBe("candidate@example.com");
    expect(candidate.candidate.feedback).toEqual([
      expect.objectContaining({
        feedback_id: "fb_123",
      }),
    ]);

    const candidateResource = await client.readResource({
      uri: candidate.resource_uri,
    });

    expect(
      "text" in candidateResource.contents[0]
        ? candidateResource.contents[0].text
        : "",
    ).toContain('"interview_role": "Backend Engineer"');

    const feedbackResult = await client.callTool({
      name: "get_feedback",
      arguments: {
        id: "fb_123",
      },
    });

    const feedback = feedbackResult.structuredContent as {
      feedback: {
        id: string;
        final_assessment: string;
      };
      resource_uri: string;
    };

    expect(feedbackResult.isError).not.toBe(true);
    expect(feedback.feedback).toMatchObject({
      id: "fb_123",
      final_assessment: "Strong hire.",
    });

    const feedbackResource = await client.readResource({
      uri: feedback.resource_uri,
    });

    expect(
      "text" in feedbackResource.contents[0]
        ? feedbackResource.contents[0].text
        : "",
    ).toContain('"evaluation_model": "gpt-4.1-mini"');

    const recordingResult = await client.callTool({
      name: "get_feedback_recording_url",
      arguments: {
        id: "fb_123",
      },
    });

    const recording = recordingResult.structuredContent as {
      recording: {
        feedback_id: string;
        recording_url: string;
        source: string;
      };
      resource_uri: string;
    };

    expect(recordingResult.isError).not.toBe(true);
    expect(recording.recording).toMatchObject({
      feedback_id: "fb_123",
      source: "external",
    });
    expect(recording.recording.recording_url).toContain(
      "/recordings/fb_123.mp4",
    );

    const recordingResource = await client.readResource({
      uri: recording.resource_uri,
    });

    expect(
      "text" in recordingResource.contents[0]
        ? recordingResource.contents[0].text
        : "",
    ).toContain(
      '"recording_url": "https://cdn.example.test/recordings/fb_123.mp4"',
    );

    const listWebhooksResult = await client.callTool({
      name: "list_webhooks",
      arguments: {
        page: 1,
        page_size: 20,
      },
    });

    const webhooks = listWebhooksResult.structuredContent as {
      items: Array<{ id: string; failure_count: number }>;
      pagination: {
        total: number;
      };
    };

    expect(listWebhooksResult.isError).not.toBe(true);
    expect(webhooks.items).toEqual([
      expect.objectContaining({
        id: "wh_123",
        failure_count: 1,
      }),
    ]);
    expect(webhooks.pagination.total).toBe(1);

    const getWebhookResult = await client.callTool({
      name: "get_webhook",
      arguments: {
        id: "wh_123",
      },
    });

    const webhook = getWebhookResult.structuredContent as {
      webhook: {
        id: string;
        is_active: boolean;
      };
      resource_uri: string;
    };

    expect(getWebhookResult.isError).not.toBe(true);
    expect(webhook.webhook).toMatchObject({
      id: "wh_123",
      is_active: true,
    });

    const webhookResource = await client.readResource({
      uri: webhook.resource_uri,
    });

    expect(
      "text" in webhookResource.contents[0]
        ? webhookResource.contents[0].text
        : "",
    ).toContain('"failure_count": 1');

    const updateWebhookResult = await client.callTool({
      name: "update_webhook",
      arguments: {
        id: "wh_123",
        description: "Secondary delivery target",
        is_active: false,
      },
    });

    const updatedWebhook = updateWebhookResult.structuredContent as {
      webhook: {
        id: string;
        description: string;
        is_active: boolean;
      };
    };

    expect(updateWebhookResult.isError).not.toBe(true);
    expect(updatedWebhook.webhook).toMatchObject({
      id: "wh_123",
      description: "Secondary delivery target",
      is_active: false,
    });

    const deleteWebhookResult = await client.callTool({
      name: "delete_webhook",
      arguments: {
        id: "wh_123",
      },
    });

    const deletedWebhook = deleteWebhookResult.structuredContent as {
      deleted: boolean;
      webhook_id: string;
    };

    expect(deleteWebhookResult.isError).not.toBe(true);
    expect(deletedWebhook).toMatchObject({
      deleted: true,
      webhook_id: "wh_123",
    });
  });

  it("maps Mukhtabir API failures into MCP-safe tool errors", async () => {
    const result = await client.callTool({
      name: "get_webhook",
      arguments: {
        id: "wh_missing",
      },
    });

    const structured = result.structuredContent as {
      error: {
        status: number;
        code: string;
        request_id: string;
      };
    };

    expect(result.isError).toBe(true);
    expect(structured.error.status).toBe(404);
    expect(structured.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(structured.error.request_id).toBe("req_test_123");
  });

  it("preserves retry-after details when Mukhtabir rate limits a tool call", async () => {
    const result = await client.callTool({
      name: "list_interviews",
      arguments: {
        page: 429,
      },
    });

    const structured = result.structuredContent as {
      error: {
        status: number;
        code: string;
        retry_after: string;
      };
    };

    expect(result.isError).toBe(true);
    expect(structured.error.status).toBe(429);
    expect(structured.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(structured.error.retry_after).toBe("0");
  });

  it("supports webhook creation, delivery inspection, and test delivery flows", async () => {
    const createResult = await client.callTool({
      name: "create_webhook",
      arguments: {
        url: "https://hooks.example.test/mukhtabir",
        events: ["evaluation.generated", "candidate.invited"],
        description: "Primary delivery target",
      },
    });

    const created = createResult.structuredContent as {
      webhook: {
        id: string;
        secret_preview: string;
        secret_redacted: boolean;
      };
      resource_uri: string;
    };

    expect(createResult.isError).not.toBe(true);
    expect(created.webhook.id).toBe("wh_created");
    expect(created.webhook.secret_preview).toBe("whsec_...redacted");
    expect(created.webhook.secret_redacted).toBe(true);
    expect(created.webhook).not.toHaveProperty("secret");
    expect(created.resource_uri).toBe("mukhtabir://webhooks/wh_created");

    const deliveriesResult = await client.callTool({
      name: "list_webhook_deliveries",
      arguments: {
        id: "wh_123",
        page: 1,
        page_size: 20,
      },
    });

    const deliveries = deliveriesResult.structuredContent as {
      item_count: number;
      items_preview: Array<{ id: string; status: string }>;
      items_truncated: boolean;
      resource_uri: string;
    };

    expect(deliveriesResult.isError).not.toBe(true);
    expect(deliveries.item_count).toBe(6);
    expect(deliveries.items_preview).toHaveLength(5);
    expect(deliveries.items_truncated).toBe(true);
    expect(deliveries.resource_uri).toBe(
      "mukhtabir://webhooks/wh_123/deliveries?page=1&page_size=20",
    );

    const deliveriesResource = await client.readResource({
      uri: deliveries.resource_uri,
    });

    expect(
      "text" in deliveriesResource.contents[0]
        ? deliveriesResource.contents[0].text
        : "",
    ).toContain('"event_type": "evaluation.generated"');

    const testResult = await client.callTool({
      name: "test_webhook",
      arguments: {
        id: "wh_123",
      },
    });

    const delivery = testResult.structuredContent as {
      delivery: {
        delivery_id: string;
        status: string;
      };
    };

    expect(testResult.isError).not.toBe(true);
    expect(delivery.delivery).toMatchObject({
      delivery_id: "wd_test_123",
      status: "pending",
    });
  });

  it("surfaces validation failures for invalid tool inputs", async () => {
    const invalidEmailResult = await client.callTool({
      name: "register_candidate",
      arguments: {
        email: "not-an-email",
        name: "Candidate Example",
      },
    });

    expect(invalidEmailResult.isError).toBe(true);
    expect(invalidEmailResult.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringMatching(/email/i),
        }),
      ]),
    );

    const undocumentedFieldResult = await client.callTool({
      name: "add_interview_question",
      arguments: {
        id: "int_123",
        question: "How do you design retries?",
        disabled: true,
      },
    });

    expect(undocumentedFieldResult.isError).toBe(true);
    expect(undocumentedFieldResult.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringMatching(/unrecognized/i),
        }),
      ]),
    );
  });

  it("maps Mukhtabir API failures into safe resource errors", async () => {
    await expect(
      client.readResource({
        uri: "mukhtabir://feedback/fb_missing",
      }),
    ).rejects.toThrow(/Feedback not found|RESOURCE_NOT_FOUND|status 404/);
  });

  it("preserves structured error metadata for resource failures", async () => {
    let caught: unknown;

    try {
      await client.readResource({
        uri: "mukhtabir://webhooks/wh_retry/deliveries?page=1&page_size=20",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(McpError);
    expect((caught as McpError).data).toMatchObject({
      error: {
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        retry_after: "0",
        details: [
          {
            field: "page",
            issue: "Too many requests for deliveries.",
          },
        ],
      },
    });
  });
});
