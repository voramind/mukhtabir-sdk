import { once } from "node:events";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startMukhtabirMcpHttpServer } from "../src/http";
import type { MukhtabirMcpAuditEvent } from "../src/shared/audit";
import { createMockMukhtabirApi } from "./mock-api";

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

describe("Mukhtabir MCP HTTP security controls", () => {
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

  it("expires active sessions after the absolute TTL", async () => {
    const recorder = createAuditRecorder();
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      sessionTtlMs: 5_000,
      sessionAbsoluteTtlMs: 50,
      tenants: [
        {
          tenantId: "tenant-ttl",
          bearerToken: "mcp_http_token_ttl",
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
            authorization: "Bearer mcp_http_token_ttl",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-ttl-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      expect(transport.sessionId).toBeDefined();
      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.created" &&
            event.session_id === transport.sessionId,
        ),
      ).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 120));

      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "GET",
        headers: {
          authorization: "Bearer mcp_http_token_ttl",
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
            event.reason === "absolute_ttl" &&
            event.session_id === transport.sessionId,
        ),
      ).toBe(true);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  });

  it("rate-limits follow-up requests per tenant", async () => {
    const recorder = createAuditRecorder();
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      rateLimit: {
        windowMs: 1_000,
        maxRequests: 2,
        maxInitializeRequests: 1,
      },
      tenants: [
        {
          tenantId: "tenant-rate-limit",
          bearerToken: "mcp_http_token_rate_limit",
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
            authorization: "Bearer mcp_http_token_rate_limit",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-rate-limit-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);

      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_rate_limit",
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
      expect(response.body).toMatch(/rate limit/i);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "rate_limit.exceeded" &&
            event.reason === "request" &&
            event.tenant_id === "tenant-rate-limit",
        ),
      ).toBe(true);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  });

  it("rejects invalid bearer tokens and records an audit event", async () => {
    const recorder = createAuditRecorder();
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenants: [
        {
          tenantId: "tenant-auth",
          bearerToken: "mcp_http_token_auth",
          apiKey: "mk_test_123",
          baseUrl,
        },
      ],
      auditLogger: recorder.auditLogger,
    });

    try {
      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer wrong_token",
          host: "127.0.0.1",
          "content-type": "application/json",
        },
        body: "{}",
      });

      expect(response.statusCode).toBe(401);
      expect(response.body).toMatch(/Invalid Bearer token/);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "auth.failure" &&
            event.reason === "invalid_bearer_token",
        ),
      ).toBe(true);
    } finally {
      await httpServer.close();
    }
  });

  it("supports dynamic tenant resolution and closes revoked sessions", async () => {
    const recorder = createAuditRecorder();
    const currentTenant: {
      tenantId: string;
      bearerToken: string;
      apiKey: string;
      baseUrl: string;
      clientId: string;
      scopes: string[];
      status: "active" | "revoked";
    } = {
      tenantId: "tenant-dynamic",
      bearerToken: "mcp_http_token_dynamic",
      apiKey: "mk_test_123",
      baseUrl,
      clientId: "tenant-dynamic",
      scopes: ["read", "write", "delete"],
      status: "active",
    };
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenantResolver: async ({ bearerToken }: { bearerToken: string }) =>
        bearerToken === currentTenant.bearerToken ? currentTenant : undefined,
      auditLogger: recorder.auditLogger,
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_dynamic",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-dynamic-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      const sessionId = transport.sessionId as string;

      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.created" && event.session_id === sessionId,
        ),
      ).toBe(true);

      currentTenant.status = "revoked";

      const revokedResponse = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_dynamic",
          host: "127.0.0.1",
          "content-type": "application/json",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/list",
          params: {},
        }),
      });

      expect(revokedResponse.statusCode).toBe(403);
      expect(revokedResponse.body).toMatch(/revoked/i);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "auth.denied" &&
            event.reason === "tenant_revoked" &&
            event.tenant_id === "tenant-dynamic",
        ),
      ).toBe(true);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.closed" &&
            event.reason === "tenant_revoked" &&
            event.session_id === sessionId,
        ),
      ).toBe(true);

      currentTenant.status = "active";

      const closedResponse = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_dynamic",
          host: "127.0.0.1",
          "content-type": "application/json",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/list",
          params: {},
        }),
      });

      expect(closedResponse.statusCode).toBe(404);
      expect(closedResponse.body).toMatch(/Unknown MCP session ID/);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  });

  it("closes active sessions when resolved tenant credentials change", async () => {
    const recorder = createAuditRecorder();
    let currentTenant: {
      tenantId: string;
      bearerToken: string;
      apiKey: string;
      baseUrl: string;
      clientId: string;
      scopes: string[];
      secretVersion?: string;
      status: "active";
    } = {
      tenantId: "tenant-rotating",
      bearerToken: "mcp_http_token_rotating",
      apiKey: "mk_test_123",
      baseUrl,
      clientId: "tenant-rotating",
      scopes: ["read", "write"],
      secretVersion: "v1",
      status: "active",
    };
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenantResolver: async ({ bearerToken }: { bearerToken: string }) =>
        bearerToken === currentTenant.bearerToken ? currentTenant : undefined,
      auditLogger: recorder.auditLogger,
    });

    try {
      const initializeResponse = await makeHttpRequest(
        new URL(httpServer.url),
        {
          method: "POST",
          headers: {
            authorization: "Bearer mcp_http_token_rotating",
            host: "127.0.0.1",
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: {
                name: "tenant-rotation-test",
                version: "0.1.0",
              },
            },
          }),
        },
      );
      const sessionIdHeader = initializeResponse.headers["mcp-session-id"];
      const sessionId =
        typeof sessionIdHeader === "string"
          ? sessionIdHeader
          : sessionIdHeader?.[0];

      expect(initializeResponse.statusCode).toBe(200);
      expect(sessionId).toBeDefined();

      currentTenant = {
        ...currentTenant,
        apiKey: "mk_test_456",
        secretVersion: "v2",
      };

      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_rotating",
          host: "127.0.0.1",
          "content-type": "application/json",
          "mcp-session-id": sessionId as string,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/list",
          params: {},
        }),
      });

      expect(response.statusCode).toBe(409);
      expect(response.body).toMatch(/Initialize a new MCP HTTP session/i);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "auth.denied" &&
            event.reason === "tenant_binding_changed" &&
            event.session_id === sessionId,
        ),
      ).toBe(true);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.closed" &&
            event.reason === "tenant_binding_changed" &&
            event.session_id === sessionId,
        ),
      ).toBe(true);
    } finally {
      await httpServer.close();
    }
  });

  it("closes active sessions when a resolved tenant is suspended", async () => {
    const recorder = createAuditRecorder();
    const currentTenant: {
      tenantId: string;
      bearerToken: string;
      apiKey: string;
      baseUrl: string;
      clientId: string;
      scopes: string[];
      status: "active" | "suspended";
    } = {
      tenantId: "tenant-suspended",
      bearerToken: "mcp_http_token_suspended",
      apiKey: "mk_test_123",
      baseUrl,
      clientId: "tenant-suspended",
      scopes: ["read", "write"],
      status: "active",
    };
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenantResolver: async ({ bearerToken }: { bearerToken: string }) =>
        bearerToken === currentTenant.bearerToken ? currentTenant : undefined,
      auditLogger: recorder.auditLogger,
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_suspended",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-suspended-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      const sessionId = transport.sessionId as string;

      currentTenant.status = "suspended";

      const suspendedResponse = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_suspended",
          host: "127.0.0.1",
          "content-type": "application/json",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/list",
          params: {},
        }),
      });

      expect(suspendedResponse.statusCode).toBe(403);
      expect(suspendedResponse.body).toMatch(/suspended/i);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "auth.denied" &&
            event.reason === "tenant_suspended" &&
            event.tenant_id === "tenant-suspended",
        ),
      ).toBe(true);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.closed" &&
            event.reason === "tenant_suspended" &&
            event.session_id === sessionId,
        ),
      ).toBe(true);

      currentTenant.status = "active";

      const closedResponse = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_suspended",
          host: "127.0.0.1",
          "content-type": "application/json",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/list",
          params: {},
        }),
      });

      expect(closedResponse.statusCode).toBe(404);
      expect(closedResponse.body).toMatch(/Unknown MCP session ID/);
    } finally {
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  });

  it("rejects dynamically resolved tenants outside the upstream base URL allowlist", async () => {
    const recorder = createAuditRecorder();
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenantResolver: async ({ bearerToken }: { bearerToken: string }) =>
        bearerToken === "mcp_http_token_blocked_base_url"
          ? {
              tenantId: "tenant-blocked-base-url",
              apiKey: "mk_test_123",
              baseUrl: "https://blocked.example/api/v1",
              clientId: "tenant-blocked-base-url",
              scopes: ["read"],
              status: "active" as const,
            }
          : undefined,
      auditLogger: recorder.auditLogger,
    });

    try {
      const response = await makeHttpRequest(new URL(httpServer.url), {
        method: "POST",
        headers: {
          authorization: "Bearer mcp_http_token_blocked_base_url",
          host: "127.0.0.1",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 8,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: {
              name: "resolver-base-url-test",
              version: "0.1.0",
            },
          },
        }),
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).toMatch(/Failed to resolve tenant configuration/i);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "auth.failure" &&
            event.reason === "tenant_resolution_error",
        ),
      ).toBe(true);
    } finally {
      await httpServer.close();
    }
  });

  it("records delete-tool audit events for destructive webhook operations", async () => {
    const recorder = createAuditRecorder();
    const httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      allowedBaseUrls: [baseUrl],
      tenants: [
        {
          tenantId: "tenant-delete",
          bearerToken: "mcp_http_token_delete",
          apiKey: "mk_test_123",
          baseUrl,
          scopes: ["delete"],
        },
      ],
      auditLogger: recorder.auditLogger,
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_delete",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-delete-audit-test-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "delete_webhook",
        arguments: {
          id: "wh_123",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "session.created" &&
            event.session_id === transport.sessionId,
        ),
      ).toBe(true);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "tool.delete.started" &&
            event.operation === "delete_webhook" &&
            event.session_id === transport.sessionId,
        ),
      ).toBe(true);
      expect(
        recorder.events.some(
          (event) =>
            event.type === "tool.delete.succeeded" &&
            event.operation === "delete_webhook" &&
            event.session_id === transport.sessionId,
        ),
      ).toBe(true);
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await transport.close().catch(() => undefined);
      await httpServer.close();
    }
  });
});
