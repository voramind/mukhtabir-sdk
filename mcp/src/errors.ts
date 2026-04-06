import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import { MukhtabirError } from "../../typescript/src/core/errors";

import { AuthorizationError } from "./authorization";

function createMukhtabirErrorPayload(error: MukhtabirError) {
  return {
    type: error.name,
    message: error.message,
    status: error.status ?? null,
    code: error.code ?? null,
    details: error.details ?? [],
    request_id: error.requestId ?? null,
    retry_after: error.retryAfter ?? null,
  };
}

function createGenericErrorPayload(error: Error) {
  return {
    type: error.name,
    message: error.message,
  };
}

function resolveMcpErrorCode(error: MukhtabirError | Error | unknown) {
  if (error instanceof MukhtabirError) {
    return (error.status ?? 500) >= 500
      ? ErrorCode.InternalError
      : ErrorCode.InvalidRequest;
  }

  if (error instanceof AuthorizationError) {
    return ErrorCode.InvalidRequest;
  }

  if (error instanceof Error) {
    return ErrorCode.InvalidParams;
  }

  return ErrorCode.InternalError;
}

export function formatMukhtabirError(error: MukhtabirError): string {
  const suffix: string[] = [];

  if (error.status) {
    suffix.push(`status ${error.status}`);
  }
  if (error.code) {
    suffix.push(`code ${error.code}`);
  }
  if (error.requestId) {
    suffix.push(`request ${error.requestId}`);
  }

  return suffix.length > 0
    ? `${error.message} (${suffix.join(", ")})`
    : error.message;
}

export function toMcpSafeError(error: unknown) {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof MukhtabirError) {
    return new McpError(
      resolveMcpErrorCode(error),
      formatMukhtabirError(error),
      {
        error: createMukhtabirErrorPayload(error),
      },
    );
  }

  if (error instanceof Error) {
    return new McpError(resolveMcpErrorCode(error), error.message, {
      error: createGenericErrorPayload(error),
    });
  }

  return new McpError(
    resolveMcpErrorCode(error),
    "An unknown error occurred.",
    {
      error: {
        type: "UnknownError",
        message: "An unknown error occurred.",
      },
    },
  );
}

export function toToolErrorResult(error: unknown) {
  if (error instanceof MukhtabirError) {
    const errorPayload = createMukhtabirErrorPayload(error);

    return {
      content: [
        {
          type: "text" as const,
          text: formatMukhtabirError(error),
        },
      ],
      structuredContent: {
        error: errorPayload,
      },
      isError: true,
    };
  }

  if (error instanceof Error) {
    const errorPayload = createGenericErrorPayload(error);

    return {
      content: [
        {
          type: "text" as const,
          text: error.message,
        },
      ],
      structuredContent: {
        error: errorPayload,
      },
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: "An unknown error occurred.",
      },
    ],
    structuredContent: {
      error: {
        type: "UnknownError",
        message: "An unknown error occurred.",
      },
    },
    isError: true,
  };
}
