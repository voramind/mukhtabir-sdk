export const DEFAULT_BASE_URL = "https://mukhtabir.hbku.edu.qa/api/v1";

export const API_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  INVALID_API_KEY: "INVALID_API_KEY",
  API_KEY_EXPIRED: "API_KEY_EXPIRED",
  API_KEY_REVOKED: "API_KEY_REVOKED",
  INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
  ORGANIZATION_INACTIVE: "ORGANIZATION_INACTIVE",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  FORBIDDEN: "FORBIDDEN",
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiResponseMeta {
  request_id: string;
  timestamp: string;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
  meta: ApiResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode | string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: ApiResponseMeta;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_more: boolean;
}

export interface PageParams {
  page?: number;
  page_size?: number;
}

export type PaginatedQueryParams = QueryParams & PageParams;

export type HeadersLike =
  | Headers
  | Array<[string, string]>
  | Record<string, string | number | boolean | null | undefined>;

export type QueryValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | Array<string | number | boolean | Date>;

export type QueryParams = Record<string, QueryValue>;

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface RetryPolicy {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatuses?: number[];
  retryOnMethods?: string[];
  respectRetryAfter?: boolean;
}

export interface RequestOptions {
  headers?: HeadersLike;
  query?: QueryParams;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface MukhtabirOptions {
  apiKey: string;
  baseUrl?: string;
  allowInsecureBaseUrl?: boolean;
  fetch?: FetchLike;
  headers?: HeadersLike;
  retry?: RetryPolicy | false;
  timeoutMs?: number;
  userAgent?: string;
}
