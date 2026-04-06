import type { RequestHandler, Response } from "express";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import {
  resolveMukhtabirMcpHttpTenant,
  type MukhtabirMcpHttpConfig,
  type MukhtabirMcpHttpTenant,
} from "./config";
import { emitAuditEvent, type MukhtabirMcpAuditLogger } from "./shared/audit";

declare module "express-serve-static-core" {
  interface Request {
    mukhtabirTenant?: MukhtabirMcpHttpTenant;
    auth?: AuthInfo;
  }
}

function writeBearerAuthError(
  res: Response,
  status: 401 | 403,
  message: string,
) {
  if (status === 401) {
    res.setHeader(
      "WWW-Authenticate",
      'Bearer realm="mukhtabir-mcp", error="invalid_token"',
    );
  }

  res.status(status).json({
    error: {
      message,
    },
  });
}

function writeTenantResolutionError(res: Response) {
  res.status(500).json({
    error: {
      message: "Failed to resolve tenant configuration for MCP HTTP access.",
    },
  });
}

export function getBearerToken(
  authorization: string | string[] | undefined,
): string | undefined {
  const value =
    typeof authorization === "string" ? authorization : authorization?.[0];

  if (!value) {
    return undefined;
  }

  const [scheme, token] = value.split(/\s+/, 2);

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token.trim() || undefined;
}

export function createBearerAuthInfo(tenant: MukhtabirMcpHttpTenant): AuthInfo {
  return {
    token: tenant.bearerToken,
    clientId: tenant.clientId,
    scopes: tenant.scopes,
    extra: {
      tenantId: tenant.tenantId,
    },
  };
}

interface MukhtabirBearerAuthMiddlewareOptions {
  auditLogger?: MukhtabirMcpAuditLogger;
  onRejectedTenant?: (
    tenant: MukhtabirMcpHttpTenant,
    reason: "suspended" | "revoked",
  ) => void | Promise<void>;
}

export function createMukhtabirBearerAuthMiddleware(
  config: MukhtabirMcpHttpConfig,
  options: MukhtabirBearerAuthMiddlewareOptions = {},
): RequestHandler {
  return async (req, res, next) => {
    const bearerToken = getBearerToken(req.headers.authorization);

    if (!bearerToken) {
      await emitAuditEvent(options.auditLogger, {
        type: "auth.failure",
        reason: "missing_bearer_token",
        details: {
          method: req.method,
          path: req.path,
        },
      });
      writeBearerAuthError(
        res,
        401,
        "Missing Bearer token for MCP HTTP access.",
      );
      return;
    }

    let tenant: MukhtabirMcpHttpTenant | undefined;

    try {
      tenant = await resolveMukhtabirMcpHttpTenant(config, bearerToken);
    } catch (error) {
      await emitAuditEvent(options.auditLogger, {
        type: "auth.failure",
        reason: "tenant_resolution_error",
        details: {
          method: req.method,
          path: req.path,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      writeTenantResolutionError(res);
      return;
    }

    if (!tenant) {
      await emitAuditEvent(options.auditLogger, {
        type: "auth.failure",
        reason: "invalid_bearer_token",
        details: {
          method: req.method,
          path: req.path,
        },
      });
      writeBearerAuthError(
        res,
        401,
        "Invalid Bearer token for MCP HTTP access.",
      );
      return;
    }

    if (tenant.status !== "active") {
      await options.onRejectedTenant?.(tenant, tenant.status);
      await emitAuditEvent(options.auditLogger, {
        type: "auth.denied",
        tenant_id: tenant.tenantId,
        client_id: tenant.clientId,
        reason: `tenant_${tenant.status}`,
        details: {
          method: req.method,
          path: req.path,
        },
      });
      writeBearerAuthError(
        res,
        403,
        `Tenant ${tenant.tenantId} is ${tenant.status} for MCP HTTP access.`,
      );
      return;
    }

    req.mukhtabirTenant = tenant;
    req.auth = createBearerAuthInfo(tenant);
    next();
  };
}

export function enforceSessionTenant(
  requestTenant: MukhtabirMcpHttpTenant,
  sessionTenant: MukhtabirMcpHttpTenant,
  res: Response,
) {
  if (requestTenant.tenantId !== sessionTenant.tenantId) {
    writeBearerAuthError(
      res,
      403,
      "Bearer token does not match the active MCP session.",
    );
    return false;
  }

  return true;
}
