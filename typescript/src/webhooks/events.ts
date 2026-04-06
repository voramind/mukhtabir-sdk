import { WEBHOOK_EVENTS } from "../types/webhooks";
import type { WebhookEventType } from "../types/webhooks";

const WEBHOOK_EVENT_TYPE_SET = new Set<string>(WEBHOOK_EVENTS);

export function isWebhookEventType(value: string): value is WebhookEventType {
  return WEBHOOK_EVENT_TYPE_SET.has(value);
}
