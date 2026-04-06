import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  ConflictError,
  MukhtabirError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  ValidationError,
  createApiError,
} from "../../src/core/errors";
import type { ApiErrorResponse } from "../../src/core";

function makeHeaders(values: Record<string, string> = {}) {
  return new Headers(values);
}

function makeErrorResponse(
  status: number,
  code: string,
  message: string,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details:
        status === 400
          ? [{ field: "email", issue: "Invalid email" }]
          : undefined,
    },
    meta: {
      request_id: `req_${status}`,
      timestamp: "2026-03-14T00:00:00Z",
    },
  };
}

describe("createApiError", () => {
  it.each([
    [400, "VALIDATION_ERROR", ValidationError],
    [401, "AUTHENTICATION_REQUIRED", AuthenticationError],
    [403, "FORBIDDEN", PermissionError],
    [404, "RESOURCE_NOT_FOUND", NotFoundError],
    [409, "CONFLICT", ConflictError],
    [429, "RATE_LIMIT_EXCEEDED", RateLimitError],
    [500, "INTERNAL_ERROR", ServerError],
  ])("maps %i responses to %p", (status, code, ExpectedError) => {
    const error = createApiError(
      status,
      makeErrorResponse(status, code, `${code} message`),
      makeHeaders({ "retry-after": status === 429 ? "120" : "0" }),
      "Request failed.",
    );

    expect(error).toBeInstanceOf(ExpectedError);
    expect(error.message).toBe(`${code} message`);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.requestId).toBe(`req_${status}`);
  });

  it("preserves details and retry-after metadata", () => {
    const error = createApiError(
      400,
      makeErrorResponse(400, "VALIDATION_ERROR", "Validation failed"),
      makeHeaders({ "retry-after": "30" }),
      "Request failed.",
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.details).toEqual([{ field: "email", issue: "Invalid email" }]);
    expect(error.retryAfter).toBe("30");
  });

  it("falls back to x-request-id when the API envelope is missing", () => {
    const error = createApiError(
      418,
      null,
      makeHeaders({ "x-request-id": "req_header_1" }),
      "Unexpected response.",
      { raw: true },
    );

    expect(error).toBeInstanceOf(MukhtabirError);
    expect(error.requestId).toBe("req_header_1");
    expect(error.body).toEqual({ raw: true });
    expect(error.message).toBe("Unexpected response.");
  });
});
