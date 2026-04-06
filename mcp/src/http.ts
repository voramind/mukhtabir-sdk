import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_BASE_URL } from "../../typescript/src/core/types";

import {
  loadMukhtabirMcpHttpConfig,
  type MukhtabirMcpHttpConfig,
  type MukhtabirMcpHttpConfigInput,
  type MukhtabirMcpHttpRateLimitRequest,
  type MukhtabirMcpHttpRateLimiter,
  type MukhtabirMcpHttpTenant,
} from "./config";
import {
  createMukhtabirBearerAuthMiddleware,
  enforceSessionTenant,
} from "./http-auth";
import { createMukhtabirMcpServer } from "./server";
import {
  emitAuditEvent,
  mukhtabirMcpAuditLogger,
  type MukhtabirMcpAuditLogger,
} from "./shared/audit";

interface HttpSessionContext {
  server: ReturnType<typeof createMukhtabirMcpServer>["server"];
  transport: StreamableHTTPServerTransport;
  tenant: MukhtabirMcpHttpTenant;
  tenantFingerprint: string;
  idleExpirationTimer?: NodeJS.Timeout;
  absoluteExpirationTimer?: NodeJS.Timeout;
}

interface HttpSessionCloseOptions {
  closeTransport: boolean;
  reason: string;
}

interface HttpSessionManager {
  get: (sessionId: string) => HttpSessionContext | undefined;
  hasCapacity: () => boolean;
  register: (sessionId: string, session: HttpSessionContext) => void;
  touch: (sessionId: string, session: HttpSessionContext) => void;
  close: (sessionId: string, options: HttpSessionCloseOptions) => Promise<void>;
  closeTenantSessions: (tenantId: string, reason: string) => Promise<void>;
  closeAll: () => Promise<void>;
}

interface PendingHttpSession {
  server: ReturnType<typeof createMukhtabirMcpServer>["server"];
  transport: StreamableHTTPServerTransport;
  getSessionId: () => string | undefined;
  dispose: () => Promise<void>;
}

export interface MukhtabirMcpTenantControlEvent {
  type:
    | "tenant.suspended"
    | "tenant.revoked"
    | "tenant.updated"
    | "tenant.secret_rotated";
  tenantId: string;
}

export interface MukhtabirMcpHttpApp {
  app: ReturnType<typeof createMcpExpressApp>;
  close: () => Promise<void>;
  closeTenantSessions: (tenantId: string) => Promise<void>;
  handleTenantControlEvent: (
    event: MukhtabirMcpTenantControlEvent,
  ) => Promise<void>;
  config: MukhtabirMcpHttpConfig;
}

export interface MukhtabirMcpHttpServer extends MukhtabirMcpHttpApp {
  server: Server;
  url: string;
}

function getSessionId(value: string | string[] | undefined) {
  return typeof value === "string" ? value : value?.[0];
}

function writeJsonRpcError(res: Response, statusCode: number, message: string) {
  if (res.headersSent) {
    return;
  }

  res.status(statusCode).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
}

function writeRateLimitError(
  res: Response,
  message: string,
  retryAfterSeconds: number,
) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  writeJsonRpcError(res, 429, message);
}

function formatHostForUrl(host: string) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function getTenantControlEventReason(event: MukhtabirMcpTenantControlEvent) {
  switch (event.type) {
    case "tenant.suspended":
      return "tenant_suspended";
    case "tenant.revoked":
      return "tenant_revoked";
    case "tenant.updated":
    case "tenant.secret_rotated":
      return "tenant_binding_changed";
  }
}

function closeHttpListener(server: Server) {
  return new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (
        !error ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ERR_SERVER_NOT_RUNNING")
      ) {
        resolve();
        return;
      }

      reject(error);
    });
    server.closeIdleConnections?.();
  });
}

function getTenantFingerprint(tenant: MukhtabirMcpHttpTenant) {
  return JSON.stringify({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    scopes: [...tenant.scopes].sort(),
    baseUrl: tenant.baseUrl ?? DEFAULT_BASE_URL,
    apiKey: tenant.apiKey,
    secretRef: tenant.secretRef ?? null,
    secretVersion: tenant.secretVersion ?? null,
  });
}

function createInMemoryHttpRateLimiter(
  config: MukhtabirMcpHttpConfig,
): MukhtabirMcpHttpRateLimiter {
  const buckets = new Map<
    string,
    {
      windowStartedAt: number;
      requestCount: number;
      initializeCount: number;
    }
  >();

  function getBucket(key: string, now: number) {
    const existing = buckets.get(key);

    if (
      existing &&
      now - existing.windowStartedAt < config.rateLimit.windowMs
    ) {
      return existing;
    }

    const bucket = {
      windowStartedAt: now,
      requestCount: 0,
      initializeCount: 0,
    };
    buckets.set(key, bucket);
    return bucket;
  }

  return {
    consume: (input: MukhtabirMcpHttpRateLimitRequest) => {
      const now = Date.now();
      const bucket = getBucket(input.key, now);
      const windowExpiresAt =
        bucket.windowStartedAt + config.rateLimit.windowMs;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowExpiresAt - now) / 1_000),
      );

      if (bucket.requestCount >= config.rateLimit.maxRequests) {
        return {
          limited: true,
          retryAfterSeconds,
        };
      }

      if (
        input.kind === "initialize" &&
        bucket.initializeCount >= config.rateLimit.maxInitializeRequests
      ) {
        return {
          limited: true,
          retryAfterSeconds,
        };
      }

      bucket.requestCount += 1;
      if (input.kind === "initialize") {
        bucket.initializeCount += 1;
      }

      return {
        limited: false,
        retryAfterSeconds: 0,
      };
    },
  };
}

function createHttpSessionManager(
  config: MukhtabirMcpHttpConfig,
  auditLogger: MukhtabirMcpAuditLogger | undefined,
): HttpSessionManager {
  const sessions = new Map<string, HttpSessionContext>();

  function clearTimer(timer: NodeJS.Timeout | undefined) {
    if (timer) {
      clearTimeout(timer);
    }
  }

  function clearSessionTimers(session: HttpSessionContext) {
    clearTimer(session.idleExpirationTimer);
    clearTimer(session.absoluteExpirationTimer);
    session.idleExpirationTimer = undefined;
    session.absoluteExpirationTimer = undefined;
  }

  async function closeRegisteredSession(
    sessionId: string,
    session: HttpSessionContext,
    options: HttpSessionCloseOptions,
  ) {
    if (sessions.get(sessionId) === session) {
      sessions.delete(sessionId);
    }

    clearSessionTimers(session);
    session.transport.onclose = undefined;

    if (options.closeTransport) {
      await session.transport.close().catch(() => undefined);
    }

    await session.server.close().catch(() => undefined);
    await emitAuditEvent(auditLogger, {
      type: "session.closed",
      tenant_id: session.tenant.tenantId,
      client_id: session.tenant.clientId,
      session_id: sessionId,
      reason: options.reason,
    });
  }

  function scheduleIdleSessionExpiration(
    sessionId: string,
    session: HttpSessionContext,
  ) {
    clearTimer(session.idleExpirationTimer);
    session.idleExpirationTimer = setTimeout(() => {
      void closeRegisteredSession(sessionId, session, {
        closeTransport: true,
        reason: "idle_ttl",
      });
    }, config.sessionTtlMs);
    session.idleExpirationTimer.unref?.();
  }

  function scheduleAbsoluteSessionExpiration(
    sessionId: string,
    session: HttpSessionContext,
  ) {
    clearTimer(session.absoluteExpirationTimer);
    session.absoluteExpirationTimer = setTimeout(() => {
      void closeRegisteredSession(sessionId, session, {
        closeTransport: true,
        reason: "absolute_ttl",
      });
    }, config.sessionAbsoluteTtlMs);
    session.absoluteExpirationTimer.unref?.();
  }

  return {
    get: (sessionId) => sessions.get(sessionId),
    hasCapacity: () => sessions.size < config.maxSessions,
    register: (sessionId, session) => {
      sessions.set(sessionId, session);
      scheduleIdleSessionExpiration(sessionId, session);
      scheduleAbsoluteSessionExpiration(sessionId, session);
      void emitAuditEvent(auditLogger, {
        type: "session.created",
        tenant_id: session.tenant.tenantId,
        client_id: session.tenant.clientId,
        session_id: sessionId,
      });
    },
    touch: (sessionId, session) => {
      scheduleIdleSessionExpiration(sessionId, session);
    },
    close: async (sessionId, options) => {
      const session = sessions.get(sessionId);

      if (!session) {
        return;
      }

      await closeRegisteredSession(sessionId, session, options);
    },
    closeTenantSessions: async (tenantId, reason) => {
      for (const [sessionId, session] of [...sessions.entries()]) {
        if (session.tenant.tenantId !== tenantId) {
          continue;
        }

        await closeRegisteredSession(sessionId, session, {
          closeTransport: true,
          reason,
        });
      }
    },
    closeAll: async () => {
      for (const [sessionId, session] of [...sessions.entries()]) {
        await closeRegisteredSession(sessionId, session, {
          closeTransport: true,
          reason: "server_shutdown",
        });
      }
    },
  };
}

function getFollowUpSessionContext(
  req: Request,
  res: Response,
  missingSessionMessage: string,
) {
  const tenant = req.mukhtabirTenant;
  const sessionId = getSessionId(req.headers["mcp-session-id"]);

  if (!tenant || !sessionId) {
    writeJsonRpcError(res, 400, missingSessionMessage);
    return;
  }

  return {
    tenant,
    sessionId,
  };
}

async function forwardSessionRequest(
  req: Request,
  res: Response,
  session: HttpSessionContext,
  body?: unknown,
) {
  try {
    if (body === undefined) {
      await session.transport.handleRequest(req, res);
      return;
    }

    await session.transport.handleRequest(req, res, body);
  } catch (error) {
    writeJsonRpcError(
      res,
      500,
      error instanceof Error ? error.message : "Internal server error.",
    );
  }
}

async function handleFollowUpSessionRequest(
  req: Request,
  res: Response,
  sessionManager: HttpSessionManager,
  auditLogger: MukhtabirMcpAuditLogger | undefined,
  tenant: MukhtabirMcpHttpTenant,
  sessionId: string,
  body?: unknown,
) {
  const session = sessionManager.get(sessionId);

  if (!session) {
    writeJsonRpcError(res, 404, "Unknown MCP session ID for this HTTP server.");
    return;
  }

  if (!enforceSessionTenant(tenant, session.tenant, res)) {
    await emitAuditEvent(auditLogger, {
      type: "auth.denied",
      tenant_id: tenant.tenantId,
      client_id: tenant.clientId,
      session_id: sessionId,
      reason: "tenant_session_mismatch",
    });
    return;
  }

  if (session.tenantFingerprint !== getTenantFingerprint(tenant)) {
    await sessionManager.close(sessionId, {
      // Drop the session immediately, but keep the current response alive long
      // enough to return a deterministic reinitialize error to the caller.
      closeTransport: false,
      reason: "tenant_binding_changed",
    });
    await emitAuditEvent(auditLogger, {
      type: "auth.denied",
      tenant_id: tenant.tenantId,
      client_id: tenant.clientId,
      session_id: sessionId,
      reason: "tenant_binding_changed",
    });
    writeJsonRpcError(
      res,
      409,
      "Tenant credentials or policy changed. Initialize a new MCP HTTP session.",
    );
    return;
  }

  sessionManager.touch(sessionId, session);
  await forwardSessionRequest(req, res, session, body);
}

function createPendingHttpSession(
  tenant: MukhtabirMcpHttpTenant,
  sessionManager: HttpSessionManager,
  auditLogger: MukhtabirMcpAuditLogger | undefined,
): PendingHttpSession {
  const { server } = createMukhtabirMcpServer({
    apiKey: tenant.apiKey,
    baseUrl: tenant.baseUrl,
    scopes: tenant.scopes,
    auditLogger,
  });
  let initializedSessionId: string | undefined;

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      initializedSessionId = sessionId;
      sessionManager.register(sessionId, {
        server,
        transport,
        tenant,
        tenantFingerprint: getTenantFingerprint(tenant),
      });
    },
  });

  transport.onclose = () => {
    const sessionId = transport.sessionId ?? initializedSessionId;

    if (!sessionId) {
      return;
    }

    void sessionManager.close(sessionId, {
      closeTransport: false,
      reason: "transport_closed",
    });
  };

  return {
    server,
    transport,
    getSessionId: () => transport.sessionId ?? initializedSessionId,
    dispose: async () => {
      transport.onclose = undefined;
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    },
  };
}

async function handleInitializeSessionRequest(
  req: Request,
  res: Response,
  tenant: MukhtabirMcpHttpTenant,
  sessionManager: HttpSessionManager,
  auditLogger: MukhtabirMcpAuditLogger | undefined,
) {
  if (!isInitializeRequest(req.body)) {
    writeJsonRpcError(
      res,
      400,
      "Missing session ID. Initialize the MCP HTTP session before sending follow-up requests.",
    );
    return;
  }

  if (!sessionManager.hasCapacity()) {
    writeJsonRpcError(
      res,
      429,
      "MCP HTTP session capacity reached. Close an existing session or increase MUKHTABIR_MCP_HTTP_MAX_SESSIONS.",
    );
    return;
  }

  const pendingSession = createPendingHttpSession(
    tenant,
    sessionManager,
    auditLogger,
  );

  try {
    await pendingSession.server.connect(pendingSession.transport);
    await pendingSession.transport.handleRequest(req, res, req.body);
  } catch (error) {
    const sessionId = pendingSession.getSessionId();

    if (sessionId) {
      await sessionManager.close(sessionId, {
        closeTransport: true,
        reason: "initialize_failed",
      });
    } else {
      await pendingSession.dispose();
    }

    writeJsonRpcError(
      res,
      500,
      error instanceof Error ? error.message : "Internal server error.",
    );
  }
}

function createFollowUpRouteHandler(
  sessionManager: HttpSessionManager,
  rateLimiter: MukhtabirMcpHttpRateLimiter,
  auditLogger: MukhtabirMcpAuditLogger | undefined,
  missingSessionMessage: string,
) {
  return async (req: Request, res: Response) => {
    const sessionContext = getFollowUpSessionContext(
      req,
      res,
      missingSessionMessage,
    );

    if (!sessionContext) {
      return;
    }

    const rateLimitResult = await rateLimiter.consume({
      key: sessionContext.tenant.tenantId,
      kind: "request",
      tenantId: sessionContext.tenant.tenantId,
      clientId: sessionContext.tenant.clientId,
      sessionId: sessionContext.sessionId,
    });

    if (rateLimitResult.limited) {
      await emitAuditEvent(auditLogger, {
        type: "rate_limit.exceeded",
        tenant_id: sessionContext.tenant.tenantId,
        client_id: sessionContext.tenant.clientId,
        session_id: sessionContext.sessionId,
        reason: "request",
        details: {
          retry_after_seconds: rateLimitResult.retryAfterSeconds,
        },
      });
      writeRateLimitError(
        res,
        "MCP HTTP request rate limit exceeded. Retry after the current rate-limit window.",
        rateLimitResult.retryAfterSeconds,
      );
      return;
    }

    await handleFollowUpSessionRequest(
      req,
      res,
      sessionManager,
      auditLogger,
      sessionContext.tenant,
      sessionContext.sessionId,
    );
  };
}

export function createMukhtabirMcpHttpApp(
  input: MukhtabirMcpHttpConfigInput = {},
): MukhtabirMcpHttpApp {
  const config = loadMukhtabirMcpHttpConfig(input);
  const auditLogger = config.auditLogger ?? mukhtabirMcpAuditLogger;
  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts,
  });
  const sessionManager = createHttpSessionManager(config, auditLogger);
  const rateLimiter =
    config.rateLimiter ?? createInMemoryHttpRateLimiter(config);
  const authMiddleware = createMukhtabirBearerAuthMiddleware(config, {
    auditLogger,
    onRejectedTenant: async (tenant, reason) => {
      await sessionManager.closeTenantSessions(
        tenant.tenantId,
        `tenant_${reason}`,
      );
    },
  });

  app.post(config.path, authMiddleware, async (req, res) => {
    const tenant = req.mukhtabirTenant;

    if (!tenant) {
      writeJsonRpcError(res, 401, "Missing authenticated tenant.");
      return;
    }

    const sessionId = getSessionId(req.headers["mcp-session-id"]);
    const rateLimitResult = await rateLimiter.consume({
      key: tenant.tenantId,
      kind: sessionId ? "request" : "initialize",
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      sessionId: sessionId ?? undefined,
    });

    if (rateLimitResult.limited) {
      await emitAuditEvent(auditLogger, {
        type: "rate_limit.exceeded",
        tenant_id: tenant.tenantId,
        client_id: tenant.clientId,
        session_id: sessionId ?? null,
        reason: sessionId ? "request" : "initialize",
        details: {
          retry_after_seconds: rateLimitResult.retryAfterSeconds,
        },
      });
      writeRateLimitError(
        res,
        "MCP HTTP request rate limit exceeded. Retry after the current rate-limit window.",
        rateLimitResult.retryAfterSeconds,
      );
      return;
    }

    if (sessionId) {
      await handleFollowUpSessionRequest(
        req,
        res,
        sessionManager,
        auditLogger,
        tenant,
        sessionId,
        req.body,
      );
      return;
    }

    await handleInitializeSessionRequest(
      req,
      res,
      tenant,
      sessionManager,
      auditLogger,
    );
  });

  app.get(
    config.path,
    authMiddleware,
    createFollowUpRouteHandler(
      sessionManager,
      rateLimiter,
      auditLogger,
      "Missing session ID for MCP HTTP stream connection.",
    ),
  );

  app.delete(
    config.path,
    authMiddleware,
    createFollowUpRouteHandler(
      sessionManager,
      rateLimiter,
      auditLogger,
      "Missing session ID for MCP HTTP session termination.",
    ),
  );

  return {
    app,
    close: sessionManager.closeAll,
    closeTenantSessions: (tenantId) =>
      sessionManager.closeTenantSessions(tenantId, "manual_tenant_close"),
    handleTenantControlEvent: (event) =>
      sessionManager.closeTenantSessions(
        event.tenantId,
        getTenantControlEventReason(event),
      ),
    config,
  };
}

export async function startMukhtabirMcpHttpServer(
  input: MukhtabirMcpHttpConfigInput = {},
): Promise<MukhtabirMcpHttpServer> {
  const httpApp = createMukhtabirMcpHttpApp(input);
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = httpApp.app.listen(
      httpApp.config.port,
      httpApp.config.host,
      () => resolve(instance),
    );
    instance.on("error", reject);
  });
  const address = server.address();
  const port =
    address && typeof address === "object"
      ? (address as AddressInfo).port
      : httpApp.config.port;
  const url = `http://${formatHostForUrl(httpApp.config.host)}:${port}${httpApp.config.path}`;
  let closePromise: Promise<void> | undefined;

  return {
    ...httpApp,
    close: () => {
      closePromise ??= (async () => {
        await httpApp.close();
        await closeHttpListener(server);
      })();

      return closePromise;
    },
    config: {
      ...httpApp.config,
      port,
    },
    server,
    url,
  };
}
