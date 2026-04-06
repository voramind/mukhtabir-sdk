import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  computeWebhookSignature,
  parseWebhookEvent,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "../../src/webhooks";

describe("webhook helpers", () => {
  it("computes and verifies webhook signatures", async () => {
    const body = JSON.stringify({
      event: "evaluation.generated",
      timestamp: "2026-03-14T00:00:00Z",
      data: {
        feedback_id: "fb_1",
        total_score: 91,
        category_scores: [{ name: "Technical", score: 91 }],
      },
    });

    const signature = await computeWebhookSignature({
      body,
      secret: "whsec_test",
      timestamp: 1_710_374_400,
    });

    const verified = await verifyWebhookSignature({
      body,
      secret: "whsec_test",
      signature,
      timestamp: 1_710_374_400,
      toleranceSeconds: 10,
      now: 1_710_374_400,
    });

    expect(verified).toBe(true);
  });

  it("rejects stale webhook signatures by default", async () => {
    const timestamp = 1_710_374_400;
    const body = JSON.stringify({
      event: "evaluation.generated",
      timestamp: "2026-03-14T00:00:00Z",
      data: {
        feedback_id: "fb_1",
        total_score: 91,
        category_scores: [{ name: "Technical", score: 91 }],
      },
    });

    const signature = await computeWebhookSignature({
      body,
      secret: "whsec_test",
      timestamp,
    });

    await expect(
      verifyWebhookSignature({
        body,
        secret: "whsec_test",
        signature,
        timestamp,
        now: timestamp + DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1,
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("allows explicitly disabling timestamp freshness checks", async () => {
    const timestamp = 1_710_374_400;
    const body = JSON.stringify({
      event: "evaluation.generated",
      timestamp: "2026-03-14T00:00:00Z",
      data: {
        feedback_id: "fb_1",
        total_score: 91,
        category_scores: [{ name: "Technical", score: 91 }],
      },
    });

    const signature = await computeWebhookSignature({
      body,
      secret: "whsec_test",
      timestamp,
    });

    await expect(
      verifyWebhookSignature({
        body,
        secret: "whsec_test",
        signature,
        timestamp,
        toleranceSeconds: null,
        now: timestamp + DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1,
      }),
    ).resolves.toBe(true);
  });

  it("parses and validates a webhook event", async () => {
    const timestamp = 1_710_374_400;
    const body = JSON.stringify({
      event: "candidate.invited",
      timestamp: "2026-03-14T00:00:00Z",
      data: {
        interview_id: "int_1",
        candidate_email: "candidate@example.com",
        candidate_name: "Candidate Example",
      },
    });

    const signature = await computeWebhookSignature({
      body,
      secret: "whsec_test",
      timestamp,
    });

    const webhook = await parseWebhookEvent({
      body,
      secret: "whsec_test",
      verifySignature: true,
      toleranceSeconds: 10,
      now: timestamp,
      headers: {
        "X-Mukhtabir-Signature": signature,
        "X-Mukhtabir-Timestamp": String(timestamp),
        "X-Mukhtabir-Event": "candidate.invited",
        "X-Mukhtabir-Delivery-Id": "del_1",
      },
    });

    expect(webhook.event.event).toBe("candidate.invited");
    expect(webhook.event.data.candidate_email).toBe("candidate@example.com");
    expect(webhook.headers.deliveryId).toBe("del_1");
  });

  it("coerces webhook header object values with the shared normalizer", async () => {
    const timestamp = 1_710_374_400;
    const body = JSON.stringify({
      event: "candidate.invited",
      timestamp: "2026-03-14T00:00:00Z",
      data: {
        interview_id: "int_1",
        candidate_email: "candidate@example.com",
        candidate_name: "Candidate Example",
      },
    });

    const signature = await computeWebhookSignature({
      body,
      secret: "whsec_test",
      timestamp,
    });

    const webhook = await parseWebhookEvent({
      body,
      secret: "whsec_test",
      verifySignature: true,
      toleranceSeconds: 10,
      now: timestamp,
      headers: {
        "X-Mukhtabir-Signature": signature,
        "X-Mukhtabir-Timestamp": timestamp,
        "X-Mukhtabir-Event": "candidate.invited",
        "X-Mukhtabir-Delivery-Id": 42,
        "X-Ignored": null,
      },
    });

    expect(webhook.headers.timestamp).toBe(String(timestamp));
    expect(webhook.headers.deliveryId).toBe("42");
  });

  it("rejects mismatched webhook headers", async () => {
    const timestamp = 1_710_374_400;
    const body = JSON.stringify({
      event: "candidate.invited",
      timestamp: "2026-03-14T00:00:00Z",
      data: {
        interview_id: "int_1",
        candidate_email: "candidate@example.com",
        candidate_name: "Candidate Example",
      },
    });

    const signature = await computeWebhookSignature({
      body,
      secret: "whsec_test",
      timestamp,
    });

    await expect(
      parseWebhookEvent({
        body,
        secret: "whsec_test",
        verifySignature: true,
        toleranceSeconds: 10,
        now: timestamp,
        headers: {
          "X-Mukhtabir-Signature": signature,
          "X-Mukhtabir-Timestamp": String(timestamp),
          "X-Mukhtabir-Event": "evaluation.generated",
        },
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("fails closed when parsing without verification data", async () => {
    await expect(
      parseWebhookEvent({
        body: JSON.stringify({
          event: "candidate.invited",
          timestamp: "2026-03-14T00:00:00Z",
          data: {
            interview_id: "int_1",
            candidate_email: "candidate@example.com",
            candidate_name: "Candidate Example",
          },
        }),
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("allows explicitly opting into unverified webhook parsing", async () => {
    const webhook = await parseWebhookEvent({
      allowUnverified: true,
      body: JSON.stringify({
        event: "candidate.invited",
        timestamp: "2026-03-14T00:00:00Z",
        data: {
          interview_id: "int_1",
          candidate_email: "candidate@example.com",
          candidate_name: "Candidate Example",
        },
      }),
    });

    expect(webhook.event.event).toBe("candidate.invited");
  });

  it("does not let allowUnverified bypass explicit signature verification", async () => {
    await expect(
      parseWebhookEvent({
        allowUnverified: true,
        verifySignature: true,
        body: JSON.stringify({
          event: "candidate.invited",
          timestamp: "2026-03-14T00:00:00Z",
          data: {
            interview_id: "int_1",
            candidate_email: "candidate@example.com",
            candidate_name: "Candidate Example",
          },
        }),
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });
});
