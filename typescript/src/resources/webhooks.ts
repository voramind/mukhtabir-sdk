import { paginate } from "../core/pagination";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PaginatedQueryParams,
  RequestOptions,
} from "../core/types";
import { MukhtabirTransport } from "../core/transport";
import type {
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookCreateResponse,
  WebhookDelivery,
  WebhookTestResponse,
  WebhookUpdateResponse,
} from "../types/webhooks";
import type { DeleteResponse } from "../types/common";

export class WebhooksResource {
  constructor(private readonly transport: MukhtabirTransport) {}

  create(
    input: CreateWebhookRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<WebhookCreateResponse>> {
    return this.transport.request({
      method: "POST",
      path: "/webhooks",
      body: input,
      ...options,
    });
  }

  list(
    query: RequestOptions["query"] = {},
    options: Omit<RequestOptions, "query"> = {},
  ): Promise<ApiPaginatedResponse<Webhook>> {
    return this.transport.request({
      method: "GET",
      path: "/webhooks",
      query,
      ...options,
    });
  }

  listAll(
    query: PaginatedQueryParams = {},
    options: Omit<RequestOptions, "query"> = {},
  ) {
    return paginate((page) => this.list({ ...query, ...page }, options), query);
  }

  get(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<Webhook>> {
    return this.transport.request({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}`,
      ...options,
    });
  }

  update(
    id: string,
    input: UpdateWebhookRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<WebhookUpdateResponse>> {
    return this.transport.request({
      method: "PATCH",
      path: `/webhooks/${encodeURIComponent(id)}`,
      body: input,
      ...options,
    });
  }

  delete(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<DeleteResponse>> {
    return this.transport.request({
      method: "DELETE",
      path: `/webhooks/${encodeURIComponent(id)}`,
      ...options,
    });
  }

  test(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<WebhookTestResponse>> {
    return this.transport.request({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/test`,
      ...options,
    });
  }

  deliveries(
    id: string,
    query: RequestOptions["query"] = {},
    options: Omit<RequestOptions, "query"> = {},
  ): Promise<ApiPaginatedResponse<WebhookDelivery>> {
    return this.transport.request({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}/deliveries`,
      query,
      ...options,
    });
  }

  deliveriesAll(
    id: string,
    query: PaginatedQueryParams = {},
    options: Omit<RequestOptions, "query"> = {},
  ) {
    return paginate(
      (page) => this.deliveries(id, { ...query, ...page }, options),
      query,
    );
  }
}
