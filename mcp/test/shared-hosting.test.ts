import { once } from "node:events";
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createHttpAuditLogger,
  createHttpRateLimiter,
  createHttpSecretResolver,
  createHttpTenantResolver,
  emitAuditEvent,
  startMukhtabirMcpHttpServer,
  type MukhtabirMcpAuditEvent,
} from "../src/index";
import { createMockMukhtabirApi } from "./mock-api";

function respondJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function makeHttpRequest(
  url: URL,
  options: {
    method: "GET" | "POST" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
  },
) {
  return new Promise<{
    statusCode: number;
    body: string;
    headers: IncomingHttpHeaders;
  }>((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method,
        headers: options.headers,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
          });
        });
      },
    );

    request.on("error", reject);

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}

function createAuditRecorder() {
  const events: MukhtabirMcpAuditEvent[] = [];

  return {
    events,
    auditLogger: {
      log: async (event: MukhtabirMcpAuditEvent) => {
        events.push(event);
      },
    },
  };
}

describe("Mukhtabir MCP shared-hosting helpers", () => {
  const mockApi = createMockMukhtabirApi();
  let baseUrl: string;

  beforeAll(async () => {
    mockApi.listen(0, "127.0.0.1");
    await once(mockApi, "listening");

    const mockAddress = mockApi.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${mockAddress.port}`;
  });

  afterAll(() => {
    mockApi.close();
  });

  it("supports control-plane-backed tenant and secret resolution without inline API keys", async () => {
    const recorder = createAuditRecorder();
    let tenantLookups = 0;
    let secretLookups = 0;
    let lastSecretRef: string | undefined;
    const controlPlane = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const body = await readJsonBody(req);

      if (req.method === "POST" && url.pathname === "/tenant-resolver") {
        tenantLookups += 1;

        if (body.bearerToken !== "control-plane-token") {
          respondJson(res, 404, {});
          return;
        }

        respondJson(res, 200, {
          tenant: {
            tenantId: "tenant-control-plane",
            clientId: "tenant-control-plane",
            scopes: ["read", "write"],
            status: "active",
            baseUrl,
            secretRef: "secret://tenant-control-plane",
            secretVersion: "v1",
          },
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/secret-resolver") {
        secretLookups += 1;
        lastSecretRef =
          typeof body.secretRef === "string" ? body.secretRef : undefined;

        respondJson(res, 200, {
          secret: {
            apiKey: "mk_test_123",
            secretVersion: "v1",
          },
        });
        return;
      }

      respondJson(res, 404, {});
    });
    controlPlane.listen(0, "127.0.0.1");
    await once(controlPlane, "listening");

    const controlPlaneAddress = controlPlane.address() as AddressInfo;
    const controlPlaneUrl = `http://127.0.0.1:${controlPlaneAddress.port}`;
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenantResolver: createHttpTenantResolver({
        url: `${controlPlaneUrl}/tenant-resolver`,
      }),
      secretResolver: createHttpSecretResolver({
        url: `${controlPlaneUrl}/secret-resolver`,
      }),
      auditLogger: recorder.auditLogger,
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer control-plane-token",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-control-plane-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "register_candidate",
        arguments: {
          email: "candidate@example.com",
          name: "Candidate Example",
          interview_id: "int_123",
        },
      });
      const structured = result.structuredContent as {
        candidate: {
          access_token_redacted: boolean;
        };
      };

      expect(result.isError).not.toBe(true);
      expect(structured.candidate.access_token_redacted).toBe(true);
      expect(tenantLookups).toBeGreaterThan(0);
      expect(secretLookups).toBeGreaterThan(0);
      expect(lastSecretRef).toBe("secret://tenant-control-plane");
      const sessionCreatedEvent = recorder.events.find(
        (event) =>
          event.type === "session.created" &&
          event.session_id === transport.sessionId,
      );
      expect(sessionCreatedEvent).toBeDefined();
      expect(sessionCreatedEvent?.details).toBeUndefined();
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await transport.close().catch(() => undefined);
      await httpServer.close();
      controlPlane.close();
    }
  });

  it("supports external HTTP rate limiting for authenticated MCP traffic", async () => {
    let initializeChecks = 0;
    let requestChecks = 0;
    const limiter = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method !== "POST" || url.pathname !== "/rate-limit") {
        respondJson(res, 404, {});
        return;
      }

      const body = await readJsonBody(req);

      if (body.kind === "initialize") {
        initializeChecks += 1;
        respondJson(res, 200, {
          rateLimit: {
            limited: false,
            retryAfterSeconds: 0,
          },
        });
        return;
      }

      requestChecks += 1;
      if (requestChecks === 1) {
        respondJson(res, 200, {
          rateLimit: {
            limited: false,
            retryAfterSeconds: 0,
          },
        });
        return;
      }

      respondJson(
        res,
        429,
        {
          rateLimit: {
            limited: true,
            retryAfterSeconds: 17,
          },
        },
        {
          "retry-after": "17",
        },
      );
    });
    limiter.listen(0, "127.0.0.1");
    await once(limiter, "listening");

    const limiterAddress = limiter.address() as AddressInfo;
    const limiterUrl = `http://127.0.0.1:${limiterAddress.port}`;
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenants: [
        {
          tenantId: "tenant-rate-proxy",
          bearerToken: "mcp_http_token_rate_proxy",
          apiKey: "mk_test_123",
          baseUrl,
        },
      ],
      rateLimiter: createHttpRateLimiter({
        url: `${limiterUrl}/rate-limit`,
      }),
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_rate_proxy",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-rate-proxy-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);

      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_rate_proxy",
          host: "127.0.0.1",
          "content-type": "application/json",
          "mcp-session-id": transport.sessionId as string,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("17");
      expect(response.body).toMatch(/rate limit/i);
      expect(initializeChecks).toBeGreaterThan(0);
      expect(requestChecks).toBeGreaterThanOrEqual(2);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
      limiter.close();
    }
  });

  it("posts redacted audit events to an HTTP audit sink", async () => {
    const receivedBodies: unknown[] = [];
    const auditSink = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method !== "POST" || url.pathname !== "/audit") {
        respondJson(res, 404, {});
        return;
      }

      receivedBodies.push(await readJsonBody(req));
      respondJson(res, 200, { ok: true });
    });
    auditSink.listen(0, "127.0.0.1");
    await once(auditSink, "listening");

    const auditAddress = auditSink.address() as AddressInfo;
    const auditUrl = `http://127.0.0.1:${auditAddress.port}`;
    const logger = createHttpAuditLogger({
      url: `${auditUrl}/audit`,
    });

    try {
      await emitAuditEvent(logger, {
        type: "session.created",
        tenant_id: "tenant-a",
        client_id: "client-a",
        session_id: "session-a",
        request_id: "req-a",
        details: {
          authorization: "Bearer secret",
        },
      });

      expect(receivedBodies).toHaveLength(1);
      expect(receivedBodies[0]).toMatchObject({
        event: {
          type: "session.created",
          tenant_id: "[REDACTED]",
          client_id: "[REDACTED]",
          session_id: "[REDACTED]",
          request_id: "[REDACTED]",
          details: {
            authorization: "[REDACTED]",
          },
        },
      });
    } finally {
      auditSink.close();
    }
  });

  it("closes active sessions immediately when a tenant control event is pushed", async () => {
    const recorder = createAuditRecorder();
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenants: [
        {
          tenantId: "tenant-control-event",
          bearerToken: "mcp_http_token_control_event",
          apiKey: "mk_test_123",
          baseUrl,
        },
      ],
      auditLogger: recorder.auditLogger,
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_control_event",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-control-event-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      await httpServer.handleTenantControlEvent({
        type: "tenant.revoked",
        tenantId: "tenant-control-event",
      });

      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "GET",
        headers: {
          authorization: "Bearer mcp_http_token_control_event",
          host: "127.0.0.1",
          "mcp-session-id": transport.sessionId as string,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.body).toMatch(/Unknown MCP session ID/);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.closed" &&
            event.reason === "tenant_revoked" &&
            event.session_id === transport.sessionId,
        ),
      ).toBe(true);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  });
});
