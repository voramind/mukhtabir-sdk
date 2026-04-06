import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
  HeadersLike,
} from "./types";

export interface MukhtabirErrorOptions {
  status?: number;
  code?: ApiErrorCode | string;
  details?: ApiErrorDetail[];
  requestId?: string | null;
  retryAfter?: string | null;
  headers?: HeadersLike;
  cause?: unknown;
  body?: unknown;
}

export class MukhtabirError extends Error {
  readonly status?: number;
  readonly code?: ApiErrorCode | string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string | null;
  readonly retryAfter?: string | null;
  readonly headers?: HeadersLike;
  readonly body?: unknown;

  constructor(message: string, options: MukhtabirErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.headers = options.headers;
    this.body = options.body;
  }
}

export class AuthenticationError extends MukhtabirError {}
export class PermissionError extends MukhtabirError {}
export class ValidationError extends MukhtabirError {}
export class NotFoundError extends MukhtabirError {}
export class ConflictError extends MukhtabirError {}
export class RateLimitError extends MukhtabirError {}
export class ServerError extends MukhtabirError {}
export class ConnectionError extends MukhtabirError {}
export class TimeoutError extends MukhtabirError {}
export class WebhookVerificationError extends MukhtabirError {}

function buildErrorOptions(
  status: number,
  errorResponse: ApiErrorResponse | null,
  headers: Headers,
  body?: unknown,
): MukhtabirErrorOptions {
  return {
    status,
    code: errorResponse?.error.code,
    details: errorResponse?.error.details,
    requestId: errorResponse?.meta.request_id ?? headers.get("x-request-id"),
    retryAfter: headers.get("retry-after"),
    headers,
    body,
  };
}

export function createApiError(
  status: number,
  errorResponse: ApiErrorResponse | null,
  headers: Headers,
  fallbackMessage: string,
  body?: unknown,
): MukhtabirError {
  const message = errorResponse?.error.message ?? fallbackMessage;
  const options = buildErrorOptions(status, errorResponse, headers, body);

  if (status === 400 || errorResponse?.error.code === "VALIDATION_ERROR") {
    return new ValidationError(message, options);
  }
  if (status === 401) {
    return new AuthenticationError(message, options);
  }
  if (status === 403) {
    return new PermissionError(message, options);
  }
  if (status === 404) {
    return new NotFoundError(message, options);
  }
  if (status === 409) {
    return new ConflictError(message, options);
  }
  if (status === 429) {
    return new RateLimitError(message, options);
  }
  if (status >= 500) {
    return new ServerError(message, options);
  }

  return new MukhtabirError(message, options);
}
