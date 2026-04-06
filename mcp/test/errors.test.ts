import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

import { MukhtabirError } from "../../typescript/src/core/errors";
import { toMcpSafeError, toToolErrorResult } from "../src/errors";

describe("error mapping", () => {
  it("preserves Mukhtabir metadata in tool error results", () => {
    const error = new MukhtabirError("Too many requests.", {
      status: 429,
      code: "RATE_LIMIT_EXCEEDED",
      details: [
        {
          field: "page",
          issue: "Too many requests for deliveries.",
        },
      ],
      requestId: "req_rate_limit_123",
      retryAfter: "60",
    });

    const result = toToolErrorResult(error);

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          type: "MukhtabirError",
          message: "Too many requests.",
          status: 429,
          code: "RATE_LIMIT_EXCEEDED",
          details: [
            {
              field: "page",
              issue: "Too many requests for deliveries.",
            },
          ],
          request_id: "req_rate_limit_123",
          retry_after: "60",
        },
      },
    });
  });

  it("wraps Mukhtabir resource failures as MCP errors with structured data", () => {
    const error = new MukhtabirError("Webhook not found.", {
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      requestId: "req_missing_123",
    });

    const safeError = toMcpSafeError(error);

    expect(safeError).toBeInstanceOf(McpError);
    expect((safeError as McpError).code).toBe(ErrorCode.InvalidRequest);
    expect((safeError as McpError).data).toMatchObject({
      error: {
        type: "MukhtabirError",
        message: "Webhook not found.",
        status: 404,
        code: "RESOURCE_NOT_FOUND",
        request_id: "req_missing_123",
      },
    });
  });

  it("maps local validation failures to InvalidParams MCP errors", () => {
    const safeError = toMcpSafeError(
      new Error("Invalid page: expected a positive integer."),
    );

    expect(safeError).toBeInstanceOf(McpError);
    expect((safeError as McpError).code).toBe(ErrorCode.InvalidParams);
    expect((safeError as McpError).data).toMatchObject({
      error: {
        type: "Error",
        message: "Invalid page: expected a positive integer.",
      },
    });
  });
});
