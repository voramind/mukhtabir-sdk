import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
  FetchLike,
  RequestOptions,
} from "./types";

export interface ResolvedRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOnStatuses: Set<number>;
  retryOnMethods: Set<string>;
  respectRetryAfter: boolean;
}

export interface ResolvedMukhtabirOptions {
  apiKey: string;
  baseUrl: string;
  fetch: FetchLike;
  headers: Headers;
  retry: ResolvedRetryPolicy;
  timeoutMs: number;
  userAgent: string;
  sdkVersion: string;
}

export interface RequestConfig extends RequestOptions {
  method: string;
  path: string;
  body?: BodyInit | unknown;
}

export type SuccessEnvelope<T> =
  | ApiSuccessResponse<T>
  | ApiPaginatedResponse<T>;
