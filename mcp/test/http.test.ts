import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startMukhtabirMcpHttpServer } from "../src/http";
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

describe("Mukhtabir MCP HTTP server", () => {
  const mockApi = createMockMukhtabirApi();
  let baseUrl: string;
  let httpServer: Awaited<ReturnType<typeof startMukhtabirMcpHttpServer>>;

  beforeAll(async () => {
    mockApi.listen(0, "127.0.0.1");
    await once(mockApi, "listening");

    const mockAddress = mockApi.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${mockAddress.port}`;

    httpServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      tenants: [
        {
          tenantId: "tenant-a",
          bearerToken: "mcp_http_token_a",
          apiKey: "mk_test_123",
          baseUrl,
        },
        {
          tenantId: "tenant-b",
          bearerToken: "mcp_http_token_b",
          apiKey: "mk_test_123",
          baseUrl,
          scopes: ["read"],
        },
      ],
    });
  });

  afterAll(async () => {
    await httpServer.close();
    mockApi.close();
  });

  it("serves the same MCP surface over streamable HTTP", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_a",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-test-client",
      version: "0.1.0",
    });

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

    await transport.terminateSession();
    await transport.close();
  });

  it("rejects unauthorized HTTP clients before session initialization", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer wrong_token",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-unauthorized-client",
      version: "0.1.0",
    });

    await expect(client.connect(transport)).rejects.toThrow(
      /unauthorized|token|401/i,
    );
    await transport.close();
  });

  it("rejects host headers outside the configured allowlist", async () => {
    const response = await makeHttpRequest(new URL(httpServer.url), {
      method: "POST",
      headers: {
        authorization: "Bearer mcp_http_token_a",
        host: "evil.test",
        "content-type": "application/json",
      },
      body: "{}",
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatch(/Invalid Host: evil\.test/);
  });

  it("closes the listening socket when the exported shutdown hook resolves", async () => {
    const closingServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      tenants: [
        {
          tenantId: "tenant-closing",
          bearerToken: "mcp_http_token_closing",
          apiKey: "mk_test_123",
          baseUrl,
        },
      ],
    });
    const url = new URL(closingServer.url);

    await closingServer.close();

    expect(closingServer.server.listening).toBe(false);

    const requestError = await makeHttpRequest(url, {
      method: "POST",
      headers: {
        authorization: "Bearer mcp_http_token_closing",
        "content-type": "application/json",
      },
      body: "{}",
    }).then(
      () => undefined,
      (error) => error as NodeJS.ErrnoException,
    );

    expect(requestError).toBeDefined();
    expect(
      `${requestError?.code ?? ""}:${requestError?.message ?? ""}`,
    ).toMatch(/ECONNREFUSED|ECONNRESET|socket hang up/i);
  });

  it("rejects cross-tenant reuse of an active HTTP session", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_a",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-tenant-a-client",
      version: "0.1.0",
    });

    await client.connect(transport);

    expect(transport.sessionId).toBeDefined();

    const response = await makeHttpRequest(new URL(httpServer.url), {
      method: "GET",
      headers: {
        authorization: "Bearer mcp_http_token_b",
        host: "127.0.0.1",
        "mcp-session-id": transport.sessionId as string,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatch(/does not match the active MCP session/);

    await transport.terminateSession();
    await transport.close();
  });

  it("filters mutating tools and prompts for read-only tenants", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(httpServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_b",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-readonly-client",
      version: "0.1.0",
    });

    await client.connect(transport);

    const [tools, prompts] = await Promise.all([
      client.listTools(),
      client.listPrompts(),
    ]);

    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_interviews",
        "get_interview",
        "get_feedback",
        "list_webhooks",
      ]),
    );
    expect(tools.tools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "create_interview",
        "add_interview_question",
        "update_interview",
        "delete_interview",
        "delete_interview_criteria",
        "register_candidate",
        "create_webhook",
        "delete_webhook",
      ]),
    );
    expect(prompts.prompts.map((prompt) => prompt.name)).not.toEqual(
      expect.arrayContaining([
        "create_interview_workflow",
        "invite_candidate_workflow",
      ]),
    );

    await transport.terminateSession();
    await transport.close();
  });

  it("expires idle HTTP sessions after the configured TTL", async () => {
    const expiringServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      sessionTtlMs: 50,
      tenants: [
        {
          tenantId: "tenant-expiring",
          bearerToken: "mcp_http_token_expiring",
          apiKey: "mk_test_123",
          baseUrl,
        },
      ],
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(expiringServer.url),
      {
        requestInit: {
          headers: {
            authorization: "Bearer mcp_http_token_expiring",
          },
        },
      },
    );
    const client = new Client({
      name: "mukhtabir-mcp-http-expiring-client",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);

      expect(transport.sessionId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 120));

      const response = await makeHttpRequest(new URL(expiringServer.url), {
        method: "GET",
        headers: {
          authorization: "Bearer mcp_http_token_expiring",
          host: "127.0.0.1",
          "mcp-session-id": transport.sessionId as string,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.body).toMatch(/Unknown MCP session ID/);
    } finally {
      await transport.close().catch(() => undefined);
      await expiringServer.close();
    }
  });

  it("rejects new sessions once the active-session cap is reached", async () => {
    const cappedServer = await startMukhtabirMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1"],
      maxSessions: 2,
      tenants: [
        {
          tenantId: "tenant-capped",
          bearerToken: "mcp_http_token_capped",
          apiKey: "mk_test_123",
          baseUrl,
        },
      ],
    });
    const url = new URL(cappedServer.url);
    const transportA = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          authorization: "Bearer mcp_http_token_capped",
        },
      },
    });
    const transportB = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          authorization: "Bearer mcp_http_token_capped",
        },
      },
    });
    const transportC = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          authorization: "Bearer mcp_http_token_capped",
        },
      },
    });
    const clientA = new Client({
      name: "mukhtabir-mcp-http-cap-a",
      version: "0.1.0",
    });
    const clientB = new Client({
      name: "mukhtabir-mcp-http-cap-b",
      version: "0.1.0",
    });
    const clientC = new Client({
      name: "mukhtabir-mcp-http-cap-c",
      version: "0.1.0",
    });

    try {
      await clientA.connect(transportA);
      await clientB.connect(transportB);

      await expect(clientC.connect(transportC)).rejects.toThrow(
        /capacity|session/i,
      );
    } finally {
      await transportA.terminateSession().catch(() => undefined);
      await transportB.terminateSession().catch(() => undefined);
      await transportA.close().catch(() => undefined);
      await transportB.close().catch(() => undefined);
      await transportC.close().catch(() => undefined);
      await cappedServer.close();
    }
  });
});
