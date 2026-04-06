import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  LoggingLevel,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

import { MukhtabirError } from "../../../typescript/src/core/errors";

import type {
  MukhtabirMcpAccessLevel,
  MukhtabirMcpAuthorizationPolicy,
} from "../authorization";
import { toMcpSafeError, toToolErrorResult } from "../errors";
import { emitAuditEvent, type MukhtabirMcpAuditLogger } from "./audit";
import {
  createJsonResource,
  createTextResource,
  createToolResult,
} from "./mcp-content";
import { redactForLogs } from "./logging";

type HandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type ToolResult = ReturnType<typeof createToolResult>;
type ResourceResult =
  | ReturnType<typeof createJsonResource>
  | ReturnType<typeof createTextResource>;

interface HandlerAuthorizationOptions {
  authorization: MukhtabirMcpAuthorizationPolicy;
  requiredAccess: MukhtabirMcpAccessLevel;
}

function buildLogContext(operation: string, extra: HandlerExtra) {
  return {
    operation,
    request_id: String(extra.requestId),
    session_id: extra.sessionId ?? null,
    client_id: extra.authInfo?.clientId ?? null,
    tenant_id:
      typeof extra.authInfo?.extra?.tenantId === "string"
        ? extra.authInfo.extra.tenantId
        : null,
  };
}

function formatErrorForLogs(error: unknown) {
  if (error instanceof MukhtabirError) {
    return {
      type: error.name,
      message: error.message,
      status: error.status ?? null,
      code: error.code ?? null,
      request_id: error.requestId ?? null,
      retry_after: error.retryAfter ?? null,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
    };
  }

  return {
    type: "UnknownError",
    message: "An unknown error occurred.",
  };
}

async function emitLog(
  server: McpServer,
  extra: HandlerExtra,
  level: LoggingLevel,
  data: Record<string, unknown>,
) {
  try {
    await server.sendLoggingMessage(
      {
        level,
        data: redactForLogs(data),
      },
      extra.sessionId,
    );
  } catch {
    // Logging should never break tool or resource execution.
  }
}

async function ensureAuthorized(
  server: McpServer,
  extra: HandlerExtra,
  operation: string,
  options: HandlerAuthorizationOptions | undefined,
) {
  if (!options) {
    return true;
  }

  try {
    options.authorization.assert(options.requiredAccess, operation);
    return true;
  } catch (error) {
    await emitLog(server, extra, "warning", {
      ...buildLogContext(operation, extra),
      phase: "denied",
      error: formatErrorForLogs(error),
    });
    return error;
  }
}

export function wrapToolHandler<Args>(
  server: McpServer,
  operation: string,
  handler: (args: Args, extra: HandlerExtra) => Promise<ToolResult>,
  options?: HandlerAuthorizationOptions,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  return async (args: Args, extra: HandlerExtra) => {
    const shouldAuditDelete = options?.requiredAccess === "delete";
    const authorizationError = await ensureAuthorized(
      server,
      extra,
      operation,
      options,
    );

    if (authorizationError !== true) {
      if (shouldAuditDelete) {
        await emitAuditEvent(auditLogger, {
          type: "auth.denied",
          tenant_id:
            typeof extra.authInfo?.extra?.tenantId === "string"
              ? extra.authInfo.extra.tenantId
              : null,
          client_id: extra.authInfo?.clientId ?? null,
          session_id: extra.sessionId ?? null,
          request_id: String(extra.requestId),
          operation,
          reason: "delete_not_authorized",
        });
      }
      return toToolErrorResult(authorizationError);
    }

    if (shouldAuditDelete) {
      await emitAuditEvent(auditLogger, {
        type: "tool.delete.started",
        tenant_id:
          typeof extra.authInfo?.extra?.tenantId === "string"
            ? extra.authInfo.extra.tenantId
            : null,
        client_id: extra.authInfo?.clientId ?? null,
        session_id: extra.sessionId ?? null,
        request_id: String(extra.requestId),
        operation,
      });
    }

    await emitLog(server, extra, "debug", {
      ...buildLogContext(operation, extra),
      phase: "start",
      args,
    });

    try {
      const result = await handler(args, extra);

      if (shouldAuditDelete) {
        await emitAuditEvent(auditLogger, {
          type: "tool.delete.succeeded",
          tenant_id:
            typeof extra.authInfo?.extra?.tenantId === "string"
              ? extra.authInfo.extra.tenantId
              : null,
          client_id: extra.authInfo?.clientId ?? null,
          session_id: extra.sessionId ?? null,
          request_id: String(extra.requestId),
          operation,
        });
      }

      await emitLog(server, extra, "info", {
        ...buildLogContext(operation, extra),
        phase: "success",
      });

      return result;
    } catch (error) {
      await emitLog(server, extra, "warning", {
        ...buildLogContext(operation, extra),
        phase: "error",
        error: formatErrorForLogs(error),
      });

      if (shouldAuditDelete) {
        await emitAuditEvent(auditLogger, {
          type: "tool.delete.failed",
          tenant_id:
            typeof extra.authInfo?.extra?.tenantId === "string"
              ? extra.authInfo.extra.tenantId
              : null,
          client_id: extra.authInfo?.clientId ?? null,
          session_id: extra.sessionId ?? null,
          request_id: String(extra.requestId),
          operation,
          details: {
            error: formatErrorForLogs(error),
          },
        });
      }

      return toToolErrorResult(error);
    }
  };
}

export function wrapResourceHandler<T>(
  server: McpServer,
  operation: string,
  handler: (uri: URL, value: T, extra: HandlerExtra) => Promise<ResourceResult>,
  options?: HandlerAuthorizationOptions,
) {
  return async (uri: URL, value: T, extra: HandlerExtra) => {
    const authorizationError = await ensureAuthorized(
      server,
      extra,
      operation,
      options,
    );

    if (authorizationError !== true) {
      throw toMcpSafeError(authorizationError);
    }

    await emitLog(server, extra, "debug", {
      ...buildLogContext(operation, extra),
      phase: "start",
      uri: uri.toString(),
      variables: value,
    });

    try {
      const result = await handler(uri, value, extra);

      await emitLog(server, extra, "info", {
        ...buildLogContext(operation, extra),
        phase: "success",
        uri: uri.toString(),
      });

      return result;
    } catch (error) {
      await emitLog(server, extra, "warning", {
        ...buildLogContext(operation, extra),
        phase: "error",
        uri: uri.toString(),
        error: formatErrorForLogs(error),
      });

      throw toMcpSafeError(error);
    }
  };
}
