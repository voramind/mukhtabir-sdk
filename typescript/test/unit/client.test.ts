import { describe, expect, it, vi } from "vitest";

import { Mukhtabir } from "../../src/index";
import type { InterviewDetail } from "../../src/types";
import { jsonResponse } from "../helpers/http";

describe("Mukhtabir client", () => {
  it("sends authenticated requests to the default API base URL", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { interview_id: "int_123" },
        meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
      }),
    );

    const client = new Mukhtabir({
      apiKey: "mk_test_123",
      fetch,
      retry: false,
    });

    await client.interviews.create({ role: "Engineer" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];

    expect(url).toBe("https://mukhtabir.hbku.edu.qa/api/v1/interviews");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get("authorization")).toBe(
      "Bearer mk_test_123",
    );
  });

  it("builds interview-content mutation paths for nested resources", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { updated: true },
        meta: { request_id: "req_2", timestamp: "2026-03-14T00:00:00Z" },
      }),
    );

    const client = new Mukhtabir({
      apiKey: "mk_test_123",
      fetch,
      retry: false,
    });

    await client.interviews.updateSubquestion("int/123", "q 123", "sq?123", {
      subquestion: "Updated follow-up",
      disabled: false,
      order_index: 2,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];

    expect(url).toBe(
      "https://mukhtabir.hbku.edu.qa/api/v1/interviews/int%2F123/questions/q%20123/subquestions/sq%3F123",
    );
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(
      JSON.stringify({
        subquestion: "Updated follow-up",
        disabled: false,
        order_index: 2,
      }),
    );
  });

  it("passes through nested interview detail metadata on reads", async () => {
    const interviewDetail = {
      id: "int_123",
      role: "Backend Engineer",
      level: "senior",
      type: "technical",
      userId: "usr_123",
      userName: "Hiring Manager",
      duration: 45,
      finalized: true,
      published: true,
      visibility: "private",
      maxScore: 100,
      createdAt: "2026-03-14T00:00:00Z",
      updatedAt: "2026-03-14T01:00:00Z",
      techstack: ["typescript", "postgres", "redis"],
      questions: [
        {
          id: "q_123",
          question: "How do you design retry safety?",
          disabled: false,
          orderIndex: 0,
          subquestions: [
            {
              id: "sq_123",
              text: "How do you deduplicate work?",
              disabled: false,
              orderIndex: 0,
            },
          ],
        },
      ],
      evaluationCriteriaList: [
        {
          id: "crit_123",
          criteriaTitle: "System design",
          description: "Evaluates tradeoffs and operational safety.",
          scoringGuides: [
            {
              scoreRange: "90-100",
              description: "Demonstrates strong judgment and prioritization.",
            },
          ],
          disabled: false,
          orderIndex: 0,
        },
      ],
      performanceLevels: [
        {
          minScore: 90,
          maxScore: 100,
          label: "Strong hire",
          colorClass: "green",
        },
      ],
      collaborators: [],
      interviewees: [],
      attachmentRequirements: [],
    } satisfies InterviewDetail;

    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: interviewDetail,
        meta: { request_id: "req_3", timestamp: "2026-03-14T00:00:00Z" },
      }),
    );

    const client = new Mukhtabir({
      apiKey: "mk_test_123",
      fetch,
      retry: false,
    });

    const response = await client.interviews.get("int_123");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(response.data.questions[0]).toMatchObject({
      id: "q_123",
      orderIndex: 0,
      disabled: false,
    });
    expect(response.data.questions[0].subquestions[0]).toMatchObject({
      id: "sq_123",
      text: "How do you deduplicate work?",
      orderIndex: 0,
      disabled: false,
    });
    expect(response.data.evaluationCriteriaList[0]).toMatchObject({
      id: "crit_123",
      criteriaTitle: "System design",
      orderIndex: 0,
      disabled: false,
    });
  });
});
