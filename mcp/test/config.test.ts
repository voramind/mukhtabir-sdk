import { describe, expect, it } from "vitest";

import {
  ConfigurationError,
  loadMukhtabirMcpConfig,
  loadMukhtabirMcpHttpConfig,
} from "../src/config";

describe("MCP config", () => {
  it("requires credentials for stdio mode", () => {
    expect(() => loadMukhtabirMcpConfig({ env: {} })).toThrow(
      ConfigurationError,
    );
  });

  it("requires transport auth for HTTP mode", () => {
    expect(() => loadMukhtabirMcpHttpConfig({ env: {} })).toThrow(
      ConfigurationError,
    );
  });

  it("parses multi-tenant HTTP auth from JSON config", () => {
    const config = loadMukhtabirMcpHttpConfig({
      env: {
        MUKHTABIR_MCP_TENANTS_JSON: JSON.stringify([
          {
            tenantId: "tenant-a",
            bearerToken: "mcp_token_a",
            apiKey: "mk_api_a",
            scopes: ["READ"],
          },
          {
            tenantId: "tenant-b",
            bearerToken: "mcp_token_b",
            apiKey: "mk_api_b",
            baseUrl: "https://example.test",
          },
        ]),
      },
    });

    expect(config.tenants).toHaveLength(2);
    expect(config.tenants[0]?.tenantId).toBe("tenant-a");
    expect(config.tenants[0]?.scopes).toEqual(["read"]);
    expect(config.tenants[1]?.baseUrl).toBe("https://example.test");
  });

  it("applies programmatic single-tenant clientId and scopes", () => {
    const config = loadMukhtabirMcpHttpConfig({
      env: {},
      bearerToken: "mcp_token_single",
      apiKey: "mk_api_single",
      clientId: "embedded-client",
      scopes: ["WRITE", "delete"],
    });

    expect(config.tenants).toHaveLength(1);
    expect(config.tenants[0]).toMatchObject({
      tenantId: "default",
      clientId: "embedded-client",
      scopes: ["write", "delete"],
    });
  });

  it("allows HTTP config to rely on a dynamic tenant resolver", () => {
    const tenantResolver = async () => undefined;
    const config = loadMukhtabirMcpHttpConfig({
      env: {},
      tenantResolver,
    });

    expect(config.tenants).toHaveLength(0);
    expect(config.tenantResolver).toBe(tenantResolver);
  });

  it("allows secretRef-backed tenant config when a secretResolver is provided", () => {
    const secretResolver = async () => "mk_api_secret";
    const config = loadMukhtabirMcpHttpConfig({
      env: {},
      secretResolver,
      tenants: [
        {
          tenantId: "tenant-secret-ref",
          bearerToken: "mcp_token_secret_ref",
          secretRef: "secret://tenant-secret-ref",
        },
      ],
    });

    expect(config.tenants).toHaveLength(1);
    expect(config.tenants[0]).toMatchObject({
      tenantId: "tenant-secret-ref",
      secretRef: "secret://tenant-secret-ref",
      apiKey: undefined,
    });
    expect(config.secretResolver).toBe(secretResolver);
  });

  it("rejects secretRef-backed tenant config without a secretResolver", () => {
    expect(() =>
      loadMukhtabirMcpHttpConfig({
        env: {},
        tenants: [
          {
            tenantId: "tenant-secret-ref",
            bearerToken: "mcp_token_secret_ref",
            secretRef: "secret://tenant-secret-ref",
          },
        ],
      }),
    ).toThrow(/secretResolver/i);
  });

  it("rejects tenant base URLs outside the configured allowlist", () => {
    expect(() =>
      loadMukhtabirMcpHttpConfig({
        env: {},
        allowedBaseUrls: ["https://allowed.example/api/v1"],
        tenants: [
          {
            tenantId: "tenant-a",
            bearerToken: "mcp_token_a",
            apiKey: "mk_api_a",
            baseUrl: "https://blocked.example/api/v1",
          },
        ],
      }),
    ).toThrow(/not in MUKHTABIR_MCP_HTTP_ALLOWED_BASE_URLS/i);
  });

  it("rejects unsupported tenant scopes", () => {
    expect(() =>
      loadMukhtabirMcpHttpConfig({
        env: {
          MUKHTABIR_MCP_TENANTS_JSON: JSON.stringify([
            {
              tenantId: "tenant-a",
              bearerToken: "mcp_token_a",
              apiKey: "mk_api_a",
              scopes: ["owner"],
            },
          ]),
        },
      }),
    ).toThrow(/unsupported MCP scopes/i);
  });

  it("rejects tenant scope arrays with non-string entries", () => {
    expect(() =>
      loadMukhtabirMcpHttpConfig({
        env: {
          MUKHTABIR_MCP_TENANTS_JSON: JSON.stringify([
            {
              tenantId: "tenant-a",
              bearerToken: "mcp_token_a",
              apiKey: "mk_api_a",
              scopes: ["read", 1, null],
            },
          ]),
        },
      }),
    ).toThrow(/arrays of strings/i);
  });

  it("rejects malformed tenant scope shapes", () => {
    expect(() =>
      loadMukhtabirMcpHttpConfig({
        env: {
          MUKHTABIR_MCP_TENANTS_JSON: JSON.stringify({
            "tenant-a": {
              bearerToken: "mcp_token_a",
              apiKey: "mk_api_a",
              scope: "read",
            },
          }),
        },
      }),
    ).toThrow(/arrays of strings/i);
  });
});
