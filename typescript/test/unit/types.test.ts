import { describe, expectTypeOf, it } from "vitest";

import { Mukhtabir } from "../../src/index";
import type { ApiPaginatedResponse, ApiSuccessResponse } from "../../src/core";
import type {
  AddInterviewCriteriaResponse,
  AddInterviewQuestionResponse,
  AddInterviewSubquestionResponse,
  CreateInterviewResponse,
  DeleteInterviewCriteriaResponse,
  DeleteInterviewQuestionResponse,
  DeleteInterviewSubquestionResponse,
  FeedbackDetail,
  InterviewDetail,
  InterviewSummary,
  UpdateInterviewCriteriaResponse,
  UpdateInterviewQuestionResponse,
  UpdateInterviewSubquestionResponse,
  Webhook,
} from "../../src/types";
import { parseWebhookEvent } from "../../src/webhooks";
import type { ParsedWebhookEvent } from "../../src/webhooks";

describe("TypeScript surface", () => {
  it("exposes typed resource method responses", () => {
    const client = new Mukhtabir({
      apiKey: "mk_test",
      fetch: async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: [],
            pagination: {
              page: 1,
              page_size: 1,
              total: 0,
              total_pages: 0,
              has_more: false,
            },
            meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
          }),
        ),
      retry: false,
    });

    expectTypeOf(client.interviews.create({ role: "Engineer" })).toEqualTypeOf<
      Promise<ApiSuccessResponse<CreateInterviewResponse>>
    >();
    expectTypeOf(client.interviews.list()).toEqualTypeOf<
      Promise<ApiPaginatedResponse<InterviewSummary>>
    >();
    expectTypeOf(client.interviews.get("int_123")).toEqualTypeOf<
      Promise<ApiSuccessResponse<InterviewDetail>>
    >();
    expectTypeOf(client.feedback.get("fb_123")).toEqualTypeOf<
      Promise<ApiSuccessResponse<FeedbackDetail>>
    >();
    expectTypeOf(client.webhooks.list()).toEqualTypeOf<
      Promise<ApiPaginatedResponse<Webhook>>
    >();
    expectTypeOf(
      client.interviews.addQuestion("int_123", { question: "Explain retries" }),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<AddInterviewQuestionResponse>>
    >();
    expectTypeOf(
      client.interviews.updateQuestion("int_123", "q_123", { disabled: true }),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<UpdateInterviewQuestionResponse>>
    >();
    expectTypeOf(
      client.interviews.deleteQuestion("int_123", "q_123"),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<DeleteInterviewQuestionResponse>>
    >();
    expectTypeOf(
      client.interviews.addSubquestion("int_123", "q_123", {
        subquestion: "Why?",
      }),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<AddInterviewSubquestionResponse>>
    >();
    expectTypeOf(
      client.interviews.updateSubquestion("int_123", "q_123", "sq_123", {
        disabled: false,
      }),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<UpdateInterviewSubquestionResponse>>
    >();
    expectTypeOf(
      client.interviews.deleteSubquestion("int_123", "q_123", "sq_123"),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<DeleteInterviewSubquestionResponse>>
    >();
    expectTypeOf(
      client.interviews.addCriteria("int_123", {
        criteria_title: "Problem solving",
      }),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<AddInterviewCriteriaResponse>>
    >();
    expectTypeOf(
      client.interviews.updateCriteria("int_123", "crit_123", {
        disabled: true,
      }),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<UpdateInterviewCriteriaResponse>>
    >();
    expectTypeOf(
      client.interviews.deleteCriteria("int_123", "crit_123"),
    ).toEqualTypeOf<
      Promise<ApiSuccessResponse<DeleteInterviewCriteriaResponse>>
    >();
  });

  it("limits write operations to the documented request surface", () => {
    const client = new Mukhtabir({
      apiKey: "mk_test",
      fetch: async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { interview_id: "int_123" },
            meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
          }),
        ),
      retry: false,
    });

    client.interviews.create({
      role: "Engineer",
      type: "technical",
      level: "mid",
      duration: 30,
      techstack: ["TypeScript"],
      max_score: 100,
      visibility: "restricted",
    });

    client.interviews.update("int_123", {
      role: "Senior Engineer",
      duration: 45,
      visibility: "public",
      published: true,
    });

    client.interviews.invite("int_123", {
      email: "candidate@example.com",
      name: "Candidate Example",
      expires_in_hours: 72,
    });

    client.interviews.addQuestion("int_123", {
      question: "How do you debug production incidents?",
      subquestions: ["How do you triage first?", "How do you verify fixes?"],
      order_index: 0,
    });

    client.interviews.updateQuestion("int_123", "q_123", {
      question: "How do you design reliable queues?",
      disabled: false,
      order_index: 1,
    });

    client.interviews.addSubquestion("int_123", "q_123", {
      subquestion: "How do you avoid duplicate processing?",
      order_index: 0,
    });

    client.interviews.updateSubquestion("int_123", "q_123", "sq_123", {
      subquestion: "How do you monitor queue lag?",
      disabled: false,
      order_index: 1,
    });

    client.interviews.addCriteria("int_123", {
      criteria_title: "System design",
      description: "Evaluates architecture tradeoffs.",
      order_index: 0,
    });

    client.interviews.updateCriteria("int_123", "crit_123", {
      criteria_title: "System design depth",
      description: "Evaluates architecture tradeoffs and constraints.",
      disabled: false,
      order_index: 1,
    });

    client.interviews.create({
      role: "Staff Engineer",
      type: "scenario-based",
      level: "executive",
    });

    // @ts-expect-error invalid interview types should stay rejected.
    client.interviews.create({ role: "Engineer", type: "coding-screen" });
    client.interviews.create({
      role: "Engineer",
      // @ts-expect-error undocumented interview creation fields are intentionally excluded.
      questions: [{ question: "Explain joins" }],
    });
    // @ts-expect-error undocumented interview update fields are intentionally excluded.
    client.interviews.update("int_123", { max_score: 120 });
    client.interviews.invite("int_123", {
      email: "candidate@example.com",
      name: "Candidate Example",
      // @ts-expect-error undocumented invite options are intentionally excluded.
      send_email: true,
    });
    client.interviews.addQuestion("int_123", {
      question: "Describe caching.",
      // @ts-expect-error add-question only supports question, subquestions, and order_index.
      disabled: true,
    });
    client.interviews.updateQuestion("int_123", "q_123", {
      // @ts-expect-error update-question does not support subquestion payloads.
      subquestion: "Wrong field",
    });
    // @ts-expect-error subquestion text is required for subquestion creation.
    client.interviews.addSubquestion("int_123", "q_123", { order_index: 1 });
    client.interviews.addCriteria("int_123", {
      criteria_title: "Communication",
      // @ts-expect-error criteria create does not allow disabled flags.
      disabled: true,
    });
  });

  it("models nested interview detail reads with stable IDs and ordering metadata", () => {
    const question: InterviewDetail["questions"][number] = {
      id: "q_123",
      question: "How do you handle incident response?",
      disabled: false,
      orderIndex: 0,
      subquestions: [
        {
          id: "sq_123",
          text: "How do you verify the fix?",
          disabled: false,
          orderIndex: 1,
        },
      ],
    };

    const criterion: InterviewDetail["evaluationCriteriaList"][number] = {
      id: "crit_123",
      criteriaTitle: "Operational excellence",
      description: "Evaluates incident response and ownership.",
      scoringGuides: [
        {
          scoreRange: "90-100",
          description: "Balances mitigation speed with clear communication.",
        },
      ],
      disabled: false,
      orderIndex: 0,
    };

    expectTypeOf<
      InterviewDetail["questions"][number]["id"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      InterviewDetail["questions"][number]["orderIndex"]
    >().toEqualTypeOf<number>();
    expectTypeOf<
      InterviewDetail["questions"][number]["subquestions"][number]["id"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      InterviewDetail["questions"][number]["subquestions"][number]["orderIndex"]
    >().toEqualTypeOf<number>();
    expectTypeOf<
      InterviewDetail["evaluationCriteriaList"][number]["id"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      InterviewDetail["evaluationCriteriaList"][number]["orderIndex"]
    >().toEqualTypeOf<number>();

    expectTypeOf(question.subquestions[0].text).toEqualTypeOf<string>();
    expectTypeOf(criterion.criteriaTitle).toEqualTypeOf<string>();

    const legacySubquestions: InterviewDetail["questions"][number]["subquestions"] =
      // @ts-expect-error read-side subquestions are object-shaped and include metadata.
      ["legacy"];
    void legacySubquestions;
  });

  it("exposes auto-pagination as an async iterable", () => {
    const client = new Mukhtabir({
      apiKey: "mk_test",
      fetch: async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: [],
            pagination: {
              page: 1,
              page_size: 1,
              total: 0,
              total_pages: 0,
              has_more: false,
            },
            meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
          }),
        ),
      retry: false,
    });

    expectTypeOf(client.candidates.listAll()).toExtend<
      AsyncIterable<unknown>
    >();
    expectTypeOf(client.interviews.resultsAll("int_123")).toExtend<
      AsyncIterable<unknown>
    >();
    expectTypeOf(client.interviews.listAll({ published: true })).toExtend<
      AsyncIterable<unknown>
    >();
    expectTypeOf(
      client.interviews.resultsAll("int_123", {
        candidate_email: "candidate@example.com",
      }),
    ).toExtend<AsyncIterable<unknown>>();
    expectTypeOf(
      client.webhooks.listAll({ event: "candidate.invited" }),
    ).toExtend<AsyncIterable<unknown>>();
    expectTypeOf(
      client.webhooks.deliveriesAll("wh_123", { status: "failed" }),
    ).toExtend<AsyncIterable<unknown>>();
  });

  it("returns parsed webhook events with typed headers", async () => {
    const parsed = parseWebhookEvent({
      allowUnverified: true,
      body: JSON.stringify({
        event: "candidate.invited",
        timestamp: "2026-03-14T00:00:00Z",
        data: {
          interview_id: "int_123",
          candidate_email: "candidate@example.com",
          candidate_name: "Candidate Example",
        },
      }),
    });

    expectTypeOf(parsed).toEqualTypeOf<Promise<ParsedWebhookEvent>>();
  });
});
