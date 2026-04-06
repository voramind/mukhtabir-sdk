import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  ConflictError,
  Mukhtabir,
  MukhtabirError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from "../../src/index";

const integrationEnabled = process.env.MUKHTABIR_INTEGRATION === "1";
const apiKey = process.env.MUKHTABIR_API_KEY;
const baseUrl = process.env.MUKHTABIR_BASE_URL;

const describeIf = integrationEnabled && apiKey ? describe : describe.skip;
const client = apiKey
  ? new Mukhtabir({
      apiKey,
      baseUrl,
      retry: false,
      timeoutMs: 30_000,
    })
  : null;

function integrationFailure(step: string, error: unknown): Error {
  if (error instanceof MukhtabirError) {
    const details = [
      error.status ? `status ${error.status}` : null,
      error.code ? `code ${error.code}` : null,
      error.requestId ? `request ID ${error.requestId}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const suffix = details ? ` (${details})` : "";
    return new Error(
      `Live integration failed during ${step}${suffix}: ${error.message}`,
      { cause: error },
    );
  }

  return new Error(`Live integration failed during ${step}.`, { cause: error });
}

async function takeFirst<T>(iterable: AsyncIterable<T>): Promise<T | null> {
  for await (const item of iterable) {
    return item;
  }

  return null;
}

async function collectExpectedKeys<T>(
  iterable: AsyncIterable<T>,
  expectedKeys: readonly string[],
  selectKey: (item: T) => string,
): Promise<string[]> {
  const expected = new Set(expectedKeys);
  const found = new Set<string>();

  for await (const item of iterable) {
    const key = selectKey(item);
    if (!expected.has(key)) {
      continue;
    }

    found.add(key);
    if (found.size === expected.size) {
      break;
    }
  }

  return Array.from(found);
}

function requireFixture(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required for the live integration suite. Run it through the Rust launcher or provide the seeded fixture env vars.`,
    );
  }

  return value;
}

describeIf("live Mukhtabir integration", () => {
  it("lists interviews with real authentication", async () => {
    const page = await client!.interviews.list({ page: 1, page_size: 1 });

    expect(page.success).toBe(true);
    expect(Array.isArray(page.data)).toBe(true);
    expect(page.pagination.page).toBeGreaterThanOrEqual(1);
    expect(page.pagination.page_size).toBeGreaterThanOrEqual(1);
    expect(page.meta.request_id).toEqual(expect.any(String));
  });

  it("creates, reads, updates, and deletes a disposable interview", async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialRole = `TypeScript SDK Integration ${uniqueSuffix}`;
    const updatedRole = `${initialRole} Updated`;

    let interviewId: string | null = null;
    let questionId: string | null = null;
    let deleteResult: Awaited<
      ReturnType<Mukhtabir["interviews"]["delete"]>
    > | null = null;

    try {
      const created = await client!.interviews
        .create({
          role: initialRole,
          type: "scenario-based",
          level: "intermediate",
          duration: 30,
          techstack: ["TypeScript"],
          max_score: 100,
          visibility: "restricted",
        })
        .catch((error: unknown) => {
          throw integrationFailure("temporary interview creation", error);
        });

      expect(created.success).toBe(true);
      expect(created.meta.request_id).toEqual(expect.any(String));

      interviewId = created.data.interview_id;

      expect(interviewId).toEqual(expect.any(String));

      const detail = await client!.interviews.get(interviewId);

      expect(detail.success).toBe(true);
      expect(detail.data.id).toBe(interviewId);
      expect(detail.data.role).toBe(initialRole);
      expect(detail.data.type).toBe("scenario-based");
      expect(detail.data.level).toBe("intermediate");
      expect(detail.meta.request_id).toEqual(expect.any(String));

      const listedInterview = await takeFirst(
        client!.interviews.listAll({ page_size: 1 }),
      );

      if (!listedInterview) {
        throw new Error(
          "expected live interview pagination to yield at least one item",
        );
      }

      expect(listedInterview).toMatchObject({
        id: expect.any(String),
        role: expect.any(String),
      });

      const updated = await client!.interviews.update(interviewId, {
        role: updatedRole,
        duration: 45,
        visibility: "private",
      });

      expect(updated.success).toBe(true);
      expect(updated.data.id).toBe(interviewId);
      expect(updated.data.role).toBe(updatedRole);
      expect(updated.data.duration).toBe(45);
      expect(updated.data.visibility).toBe("private");
      expect(updated.meta.request_id).toEqual(expect.any(String));

      const addedQuestion = await client!.interviews
        .addQuestion(interviewId, {
          question: `What are the tradeoffs of retries? ${uniqueSuffix}`,
          subquestions: ["How do you avoid retry storms?"],
          order_index: 0,
        })
        .catch((error: unknown) => {
          throw integrationFailure("interview question creation", error);
        });

      expect(addedQuestion.success).toBe(true);
      expect(addedQuestion.data.question_id).toEqual(expect.any(String));
      expect(addedQuestion.data.interview_id).toBe(interviewId);
      expect(addedQuestion.meta.request_id).toEqual(expect.any(String));

      questionId = addedQuestion.data.question_id;

      const updatedQuestion = await client!.interviews
        .updateQuestion(interviewId, questionId, {
          question: `How do you evaluate retry backoff strategy? ${uniqueSuffix}`,
          disabled: true,
          order_index: 0,
        })
        .catch((error: unknown) => {
          throw integrationFailure("interview question update", error);
        });

      expect(updatedQuestion.success).toBe(true);
      expect(updatedQuestion.data.question_id).toBe(questionId);
      expect(updatedQuestion.data.updated).toBe(true);
      expect(updatedQuestion.meta.request_id).toEqual(expect.any(String));

      const addedSubquestion = await client!.interviews
        .addSubquestion(interviewId, questionId, {
          subquestion: "How do you avoid retry storms?",
          order_index: 1,
        })
        .catch((error: unknown) => {
          throw integrationFailure("interview subquestion creation", error);
        });

      expect(addedSubquestion.success).toBe(true);
      expect(addedSubquestion.data.question_id).toBe(questionId);
      expect(addedSubquestion.data.interview_id).toBe(interviewId);
      expect(addedSubquestion.meta.request_id).toEqual(expect.any(String));

      const subquestionId = addedSubquestion.data.subquestion_id;

      const updatedSubquestion = await client!.interviews
        .updateSubquestion(interviewId, questionId, subquestionId, {
          subquestion: "How do you contain retry storms?",
          disabled: true,
          order_index: 1,
        })
        .catch((error: unknown) => {
          throw integrationFailure("interview subquestion update", error);
        });

      expect(updatedSubquestion.success).toBe(true);
      expect(updatedSubquestion.data.subquestion_id).toBe(subquestionId);
      expect(updatedSubquestion.data.updated).toBe(true);
      expect(updatedSubquestion.meta.request_id).toEqual(expect.any(String));

      const addedCriteria = await client!.interviews
        .addCriteria(interviewId, {
          criteria_title: `Systems judgment ${uniqueSuffix}`,
          description: "Explains operational tradeoffs clearly",
          order_index: 0,
        })
        .catch((error: unknown) => {
          throw integrationFailure("interview criteria creation", error);
        });

      expect(addedCriteria.success).toBe(true);
      expect(addedCriteria.data.interview_id).toBe(interviewId);
      expect(addedCriteria.meta.request_id).toEqual(expect.any(String));

      const criteriaId = addedCriteria.data.criteria_id;

      const updatedCriteria = await client!.interviews
        .updateCriteria(interviewId, criteriaId, {
          description: "Explains system and API tradeoffs clearly",
          disabled: true,
          order_index: 0,
        })
        .catch((error: unknown) => {
          throw integrationFailure("interview criteria update", error);
        });

      expect(updatedCriteria.success).toBe(true);
      expect(updatedCriteria.data.criteria_id).toBe(criteriaId);
      expect(updatedCriteria.data.updated).toBe(true);
      expect(updatedCriteria.meta.request_id).toEqual(expect.any(String));

      const nestedDetail = await client!.interviews.get(interviewId);
      expect(nestedDetail.success).toBe(true);
      expect(
        nestedDetail.data.questions.some(
          (question) =>
            question.id === questionId &&
            question.disabled &&
            question.orderIndex === 0 &&
            question.subquestions.some(
              (subquestion) =>
                subquestion.id === subquestionId &&
                subquestion.disabled &&
                subquestion.orderIndex === 1,
            ),
        ),
      ).toBe(true);
      expect(
        nestedDetail.data.evaluationCriteriaList.some(
          (criteria) =>
            criteria.id === criteriaId &&
            criteria.disabled &&
            criteria.orderIndex === 0,
        ),
      ).toBe(true);

      const deletedSubquestion = await client!.interviews
        .deleteSubquestion(interviewId, questionId, subquestionId)
        .catch((error: unknown) => {
          throw integrationFailure("interview subquestion deletion", error);
        });

      expect(deletedSubquestion.success).toBe(true);
      expect(deletedSubquestion.data.subquestion_id).toBe(subquestionId);
      expect(deletedSubquestion.data.deleted).toBe(true);
      expect(deletedSubquestion.meta.request_id).toEqual(expect.any(String));

      const deletedCriteria = await client!.interviews
        .deleteCriteria(interviewId, criteriaId)
        .catch((error: unknown) => {
          throw integrationFailure("interview criteria deletion", error);
        });

      expect(deletedCriteria.success).toBe(true);
      expect(deletedCriteria.data.criteria_id).toBe(criteriaId);
      expect(deletedCriteria.data.deleted).toBe(true);
      expect(deletedCriteria.meta.request_id).toEqual(expect.any(String));

      const deletedQuestion = await client!.interviews
        .deleteQuestion(interviewId, questionId)
        .catch((error: unknown) => {
          throw integrationFailure("interview question deletion", error);
        });

      expect(deletedQuestion.success).toBe(true);
      expect(deletedQuestion.data.question_id).toBe(questionId);
      expect(deletedQuestion.data.deleted).toBe(true);
      expect(deletedQuestion.meta.request_id).toEqual(expect.any(String));
      questionId = null;

      const published = await client!.interviews
        .publish(interviewId)
        .catch((error: unknown) => {
          throw integrationFailure("interview publish", error);
        });

      expect(published.success).toBe(true);
      expect(published.data.interview_id).toBe(interviewId);
      expect(published.data.published).toBe(true);
      expect(published.meta.request_id).toEqual(expect.any(String));
    } finally {
      if (interviewId) {
        deleteResult = await client!.interviews
          .delete(interviewId)
          .catch((error: unknown) => {
            throw integrationFailure(
              `temporary interview cleanup for ${interviewId}`,
              error,
            );
          });
        interviewId = null;
      }
    }

    expect(deleteResult).not.toBeNull();
    expect(deleteResult!.success).toBe(true);
    expect(deleteResult!.data.deleted).toBe(true);
    expect(deleteResult!.meta.request_id).toEqual(expect.any(String));
  });

  it("covers candidate, webhook, and conflict surfaces", async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inviteEmail = `sdk-invite-${uniqueSuffix}@example.com`;
    const candidateEmail = `sdk-create-${uniqueSuffix}@example.com`;
    const webhookUrl = `https://example.com/sdk-live-${uniqueSuffix}`;

    let interviewId: string | null = null;

    try {
      const createdInterview = await client!.interviews.create({
        role: `TypeScript SDK Live Integration ${uniqueSuffix}`,
        type: "technical",
        level: "mid",
        duration: 30,
        techstack: ["TypeScript"],
        max_score: 100,
        visibility: "restricted",
      });

      expect(createdInterview.success).toBe(true);
      interviewId = createdInterview.data.interview_id;

      const invited = await client!.interviews.invite(interviewId, {
        email: inviteEmail,
        name: "SDK Invitee",
        expires_in_hours: 24,
      });

      expect(invited.success).toBe(true);
      expect(invited.data.candidate_email).toBe(inviteEmail);

      await expect(
        client!.interviews.invite(interviewId, {
          email: inviteEmail,
          name: "SDK Invitee",
          expires_in_hours: 24,
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      const invitedCandidate = await client!.candidates.get(inviteEmail);
      expect(invitedCandidate.success).toBe(true);
      expect(invitedCandidate.data.email).toBe(inviteEmail);
      expect(invitedCandidate.data.interviews.length).toBeGreaterThanOrEqual(1);
      expect(invitedCandidate.meta.request_id).toEqual(expect.any(String));

      const createdCandidate = await client!.candidates.create({
        email: candidateEmail,
        name: "TypeScript SDK Candidate",
      });

      expect(createdCandidate.success).toBe(true);
      expect(createdCandidate.data.email).toBe(candidateEmail);

      const paginatedCandidateEmails = await collectExpectedKeys(
        client!.candidates.listAll({ page_size: 1 }),
        [inviteEmail, candidateEmail],
        (candidate) => candidate.email,
      );
      expect(new Set(paginatedCandidateEmails)).toEqual(
        new Set([inviteEmail, candidateEmail]),
      );

      const createdWebhook = await client!.webhooks.create({
        url: webhookUrl,
        events: ["evaluation.generated"],
        description: "typescript sdk live integration",
      });

      expect(createdWebhook.success).toBe(true);
      expect(createdWebhook.data.url).toBe(webhookUrl);

      const webhookPage = await takeFirst(
        client!.webhooks.listAll({ page_size: 1 }),
      );
      if (!webhookPage) {
        throw new Error(
          "expected webhook pagination to yield at least one item",
        );
      }

      expect(webhookPage).toMatchObject({
        id: expect.any(String),
        url: expect.any(String),
      });

      const updatedWebhook = await client!.webhooks.update(
        createdWebhook.data.id,
        {
          description: "typescript sdk live integration updated",
          is_active: false,
        },
      );

      expect(updatedWebhook.success).toBe(true);
      expect(updatedWebhook.data.is_active).toBe(false);

      const deletedWebhook = await client!.webhooks.delete(
        createdWebhook.data.id,
      );
      expect(deletedWebhook.success).toBe(true);
      expect(deletedWebhook.data.deleted).toBe(true);

      const webhookListing = await client!.webhooks.list({
        page: 1,
        page_size: 1,
      });
      expect(webhookListing.success).toBe(true);
      expect(webhookListing.meta.request_id).toEqual(expect.any(String));
    } finally {
      if (interviewId) {
        await client!.interviews.delete(interviewId);
      }
    }
  });

  it("iterates through multiple live pages for helper-backed resources", async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seededInterviewId = requireFixture("MUKHTABIR_INTERVIEW_ID");
    const seededFeedbackId = requireFixture("MUKHTABIR_FEEDBACK_ID");
    const secondFeedbackId = requireFixture("MUKHTABIR_SECOND_FEEDBACK_ID");
    const seededWebhookId = requireFixture("MUKHTABIR_WEBHOOK_ID");

    const createdInterviewIds: string[] = [];
    const createdWebhookIds: string[] = [];

    try {
      for (const index of [0, 1]) {
        const createdInterview = await client!.interviews.create({
          role: `TypeScript SDK Pagination ${uniqueSuffix} ${index}`,
          type: "very-technical",
          level: "executive",
          duration: 30,
          techstack: ["TypeScript"],
          max_score: 100,
          visibility: "restricted",
        });

        createdInterviewIds.push(createdInterview.data.interview_id);
      }

      const paginatedInterviewIds = await collectExpectedKeys(
        client!.interviews.listAll({ page_size: 1 }),
        createdInterviewIds,
        (interview) => interview.id,
      );
      expect(new Set(paginatedInterviewIds)).toEqual(
        new Set(createdInterviewIds),
      );

      const paginatedResultIds = await collectExpectedKeys(
        client!.interviews.resultsAll(seededInterviewId, { page_size: 1 }),
        [seededFeedbackId, secondFeedbackId],
        (result) => result.id,
      );
      expect(new Set(paginatedResultIds)).toEqual(
        new Set([seededFeedbackId, secondFeedbackId]),
      );

      for (const index of [0, 1]) {
        const createdWebhook = await client!.webhooks.create({
          url: `https://example.com/sdk-live-pagination-${uniqueSuffix}-${index}`,
          events: ["evaluation.generated"],
          description: `typescript sdk live pagination ${index}`,
        });

        createdWebhookIds.push(createdWebhook.data.id);
      }

      const paginatedWebhookIds = await collectExpectedKeys(
        client!.webhooks.listAll({ page_size: 1 }),
        createdWebhookIds,
        (webhook) => webhook.id,
      );
      expect(new Set(paginatedWebhookIds)).toEqual(new Set(createdWebhookIds));

      const firstDelivery = await client!.webhooks.test(seededWebhookId);
      const secondDelivery = await client!.webhooks.test(seededWebhookId);

      const paginatedDeliveryIds = await collectExpectedKeys(
        client!.webhooks.deliveriesAll(seededWebhookId, { page_size: 1 }),
        [firstDelivery.data.delivery_id, secondDelivery.data.delivery_id],
        (delivery) => delivery.id,
      );
      expect(new Set(paginatedDeliveryIds)).toEqual(
        new Set([
          firstDelivery.data.delivery_id,
          secondDelivery.data.delivery_id,
        ]),
      );
    } finally {
      for (const webhookId of createdWebhookIds.reverse()) {
        await client!.webhooks.delete(webhookId);
      }

      for (const interviewId of createdInterviewIds.reverse()) {
        await client!.interviews.delete(interviewId);
      }
    }
  });

  it("covers seeded interview results, feedback, and webhook delivery surfaces", async () => {
    const seededInterviewId = requireFixture("MUKHTABIR_INTERVIEW_ID");
    const seededFeedbackId = requireFixture("MUKHTABIR_FEEDBACK_ID");
    const seededWebhookId = requireFixture("MUKHTABIR_WEBHOOK_ID");

    const results = await client!.interviews.results(seededInterviewId, {
      page: 1,
      page_size: 10,
    });

    expect(results.success).toBe(true);
    expect(results.data.length).toBeGreaterThanOrEqual(1);
    expect(results.data[0]?.interview_id).toBe(seededInterviewId);
    expect(results.meta.request_id).toEqual(expect.any(String));

    const firstResult = await takeFirst(
      client!.interviews.resultsAll(seededInterviewId, { page_size: 1 }),
    );
    if (!firstResult) {
      throw new Error(
        "expected seeded interview results pagination to yield at least one item",
      );
    }

    expect(firstResult.interview_id).toBe(seededInterviewId);

    const analytics = await client!.interviews.analytics(seededInterviewId);
    expect(analytics.success).toBe(true);
    expect(analytics.data.interview_id).toBe(seededInterviewId);
    expect(analytics.data.evaluated_count).toBeGreaterThanOrEqual(1);
    expect(analytics.meta.request_id).toEqual(expect.any(String));

    const feedback = await client!.feedback.get(seededFeedbackId);
    expect(feedback.success).toBe(true);
    expect(feedback.data.id).toBe(seededFeedbackId);
    expect(feedback.meta.request_id).toEqual(expect.any(String));

    const transcript = await client!.feedback.transcript(seededFeedbackId);
    expect(transcript.success).toBe(true);
    expect(transcript.data.feedback_id).toBe(seededFeedbackId);
    expect(transcript.data.transcript).toEqual(expect.any(String));
    expect(transcript.meta.request_id).toEqual(expect.any(String));

    const recordingUrl = await client!.feedback.recordingUrl(seededFeedbackId);
    expect(recordingUrl.success).toBe(true);
    expect(recordingUrl.data.feedback_id).toBe(seededFeedbackId);
    expect(recordingUrl.data.source).toBe("local");
    expect(recordingUrl.meta.request_id).toEqual(expect.any(String));

    const webhook = await client!.webhooks.get(seededWebhookId);
    expect(webhook.success).toBe(true);
    expect(webhook.data.id).toBe(seededWebhookId);
    expect(webhook.meta.request_id).toEqual(expect.any(String));

    const testedWebhook = await client!.webhooks.test(seededWebhookId);
    expect(testedWebhook.success).toBe(true);
    expect(testedWebhook.data.delivery_id).toEqual(expect.any(String));
    expect(testedWebhook.data.status).toBe("delivered");
    expect(testedWebhook.meta.request_id).toEqual(expect.any(String));

    const deliveries = await client!.webhooks.deliveries(seededWebhookId, {
      page: 1,
      page_size: 10,
    });
    expect(deliveries.success).toBe(true);
    expect(deliveries.data.length).toBeGreaterThanOrEqual(1);
    expect(deliveries.meta.request_id).toEqual(expect.any(String));

    const firstDelivery = await takeFirst(
      client!.webhooks.deliveriesAll(seededWebhookId, { page_size: 1 }),
    );
    if (!firstDelivery) {
      throw new Error(
        "expected seeded webhook deliveries pagination to yield at least one item",
      );
    }

    expect(firstDelivery.id).toEqual(expect.any(String));
  });

  it("maps missing feedback records to a not found error", async () => {
    const missingFeedbackId = randomUUID();

    await expect(
      client!.feedback.get(missingFeedbackId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps validation, authentication, and permission failures to typed errors", async () => {
    const invalidClient = new Mukhtabir({
      apiKey: `invalid-${apiKey}`,
      baseUrl,
      retry: false,
      timeoutMs: 30_000,
    });
    const permissionDeniedClient = new Mukhtabir({
      apiKey: process.env.MUKHTABIR_LIMITED_API_KEY ?? "mk_invalid",
      baseUrl,
      retry: false,
      timeoutMs: 30_000,
    });
    const permissionDeniedEmail = `sdk-permission-${randomUUID()}@example.com`;

    await expect(
      client!.candidates.create({
        email: "not-an-email",
        name: "Invalid Candidate",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      invalidClient.interviews.list({ page: 1, page_size: 1 }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      permissionDeniedClient.candidates.create({
        email: permissionDeniedEmail,
        name: "Permission Denied Candidate",
      }),
    ).rejects.toBeInstanceOf(PermissionError);
  });
});
