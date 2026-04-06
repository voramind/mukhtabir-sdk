import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "../shared/pagination";

export const WEBHOOK_RESOURCE_TEMPLATES = {
  webhook: "mukhtabir://webhooks/{id}",
  webhookDeliveries: "mukhtabir://webhooks/{id}/deliveries{?page,page_size}",
} as const;

export const webhookResourceUri = {
  webhook: (id: string) => `mukhtabir://webhooks/${encodeURIComponent(id)}`,
  webhookDeliveries: (
    id: string,
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
  ) =>
    `mukhtabir://webhooks/${encodeURIComponent(id)}/deliveries?page=${page}&page_size=${pageSize}`,
};
