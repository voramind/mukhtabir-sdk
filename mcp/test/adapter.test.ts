import { describe, expect, it, vi } from "vitest";

import { MukhtabirApiAdapter } from "../src/adapter/mukhtabir";

describe("MukhtabirApiAdapter", () => {
  it("delegates interview creation to the SDK client", async () => {
    const createInterview = vi.fn().mockResolvedValue({
      success: true,
      data: {
        interview_id: "int_created",
      },
      meta: {
        request_id: "req_test_123",
        timestamp: "2026-03-14T00:00:00Z",
      },
    });
    const adapter = new MukhtabirApiAdapter({
      interviews: {
        create: createInterview,
      },
    } as never);

    await adapter.createInterview({
      role: "Backend Engineer",
      type: "technical",
      level: "senior",
    });

    expect(createInterview).toHaveBeenCalledWith({
      role: "Backend Engineer",
      type: "technical",
      level: "senior",
    });
  });

  it("delegates paginated webhook delivery reads to the SDK client", async () => {
    const listDeliveries = vi.fn().mockResolvedValue({
      success: true,
      data: [],
      pagination: {
        page: 2,
        page_size: 10,
        total: 0,
        total_pages: 0,
        has_more: false,
      },
      meta: {
        request_id: "req_test_123",
        timestamp: "2026-03-14T00:00:00Z",
      },
    });
    const adapter = new MukhtabirApiAdapter({
      webhooks: {
        deliveries: listDeliveries,
      },
    } as never);

    await adapter.listWebhookDeliveries("wh_123", {
      page: 2,
      page_size: 10,
    });

    expect(listDeliveries).toHaveBeenCalledWith("wh_123", {
      page: 2,
      page_size: 10,
    });
  });

  it("delegates nested interview-question mutations to the SDK client", async () => {
    const updateQuestion = vi.fn().mockResolvedValue({
      success: true,
      data: {
        question_id: "q_123",
        updated: true,
      },
      meta: {
        request_id: "req_test_123",
        timestamp: "2026-03-14T00:00:00Z",
      },
    });
    const adapter = new MukhtabirApiAdapter({
      interviews: {
        updateQuestion,
      },
    } as never);

    await adapter.updateInterviewQuestion("int_123", "q_123", {
      question: "Updated question",
      disabled: false,
    });

    expect(updateQuestion).toHaveBeenCalledWith("int_123", "q_123", {
      question: "Updated question",
      disabled: false,
    });
  });

  it("delegates nested interview-criteria mutations to the SDK client", async () => {
    const deleteCriteria = vi.fn().mockResolvedValue({
      success: true,
      data: {
        criteria_id: "crit_123",
        deleted: true,
      },
      meta: {
        request_id: "req_test_123",
        timestamp: "2026-03-14T00:00:00Z",
      },
    });
    const adapter = new MukhtabirApiAdapter({
      interviews: {
        deleteCriteria,
      },
    } as never);

    await adapter.deleteInterviewCriteria("int_123", "crit_123");

    expect(deleteCriteria).toHaveBeenCalledWith("int_123", "crit_123");
  });
});
