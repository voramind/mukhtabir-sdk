import { parseWebhookEvent } from "../src/index";

import { appLogger } from "./app-logger";

export async function POST(request: Request) {
  const body = await request.text();

  const webhook = await parseWebhookEvent({
    body,
    headers: request.headers,
    secret: process.env.MUKHTABIR_WEBHOOK_SECRET ?? "",
    verifySignature: true,
    toleranceSeconds: 300,
  });

  if (webhook.event.event === "evaluation.generated") {
    appLogger.info("Mukhtabir evaluation generated", {
      feedbackId: webhook.event.data.feedback_id,
    });
  }

  return new Response(null, { status: 200 });
}
