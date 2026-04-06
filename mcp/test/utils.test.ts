import { describe, expect, it, vi } from "vitest";

import {
  createPaginatedItemsPreview,
  getRequiredVariable,
  readPageQuery,
} from "../src/shared/input-parsing";
import { wrapToolHandler } from "../src/shared/handler-wrappers";
import { createToolResult } from "../src/shared/mcp-content";
import {
  sanitizeInvitation,
  sanitizeInvitationUrl,
  sanitizeWebhookSecret,
} from "../src/shared/sanitization";

describe("resource query parsing", () => {
  it("parses valid pagination parameters", () => {
    const page = readPageQuery(
      new URL("mukhtabir://interviews/int_123/results?page=2&page_size=50"),
    );

    expect(page).toEqual({
      page: 2,
      page_size: 50,
    });
  });

  it("rejects invalid pagination parameters", () => {
    expect(() =>
      readPageQuery(
        new URL("mukhtabir://interviews/int_123/results?page=0&page_size=20"),
      ),
    ).toThrow(/page/i);
  });

  it("returns compact previews for paginated tool output", () => {
    const preview = createPaginatedItemsPreview(
      [
        { id: "1" },
        { id: "2" },
        { id: "3" },
        { id: "4" },
        { id: "5" },
        { id: "6" },
      ],
      5,
    );

    expect(preview).toEqual({
      item_count: 6,
      items_preview: [
        { id: "1" },
        { id: "2" },
        { id: "3" },
        { id: "4" },
        { id: "5" },
      ],
      items_truncated: true,
    });
  });

  it("decodes percent-encoded resource variables before adapter reads", () => {
    expect(getRequiredVariable("candidate%40example.com", "email")).toBe(
      "candidate@example.com",
    );
  });

  it("strips invitation query secrets from returned URLs", () => {
    const invitation = sanitizeInvitation({
      access_token: "invite_secret",
      interview_url:
        "https://mukhtabir.example/interviews/int_123?token=secret",
      expires_at: "2026-03-20T00:00:00Z",
    });

    expect(invitation).toMatchObject({
      access_token_redacted: true,
      interview_url: "https://mukhtabir.example/interviews/int_123",
      interview_url_redacted: true,
      expires_at: "2026-03-20T00:00:00Z",
    });
    expect(invitation).not.toHaveProperty("access_token");
  });

  it("redacts webhook signing secrets from tool payloads", () => {
    const webhook = sanitizeWebhookSecret({
      id: "wh_123",
      secret: "whsec_live",
      secret_preview: "whsec_...redacted",
    });

    expect(webhook).toEqual({
      id: "wh_123",
      secret_preview: "whsec_...redacted",
      secret_redacted: true,
    });
  });

  it("sanitizes malformed invitation URLs defensively", () => {
    expect(sanitizeInvitationUrl("/interviews/int_123?token=secret")).toEqual({
      value: "/interviews/int_123",
      redacted: true,
    });
  });

  it("redacts secret-bearing fields from MCP log payloads", async () => {
    const sendLoggingMessage = vi.fn().mockResolvedValue(undefined);
    const handler = wrapToolHandler(
      {
        sendLoggingMessage,
      } as never,
      "test:redaction",
      async () =>
        createToolResult("ok", {
          ok: true,
        }),
    );

    await handler(
      {
        safe: "value",
        access_token: "secret-token",
        nested: {
          bearerToken: "tenant-secret",
          secret: "created-secret",
        },
      },
      {
        requestId: "req_redaction_123",
        sessionId: "session_redaction_123",
        authInfo: {
          clientId: "client_redaction_123",
          extra: {
            tenantId: "tenant_redaction_123",
          },
        },
      } as never,
    );

    expect(sendLoggingMessage).toHaveBeenCalledWith(
      {
        level: "debug",
        data: {
          operation: "test:redaction",
          request_id: "req_redaction_123",
          session_id: "session_redaction_123",
          client_id: "client_redaction_123",
          tenant_id: "tenant_redaction_123",
          phase: "start",
          args: {
            safe: "value",
            access_token: "[REDACTED]",
            nested: {
              bearerToken: "[REDACTED]",
              secret: "[REDACTED]",
            },
          },
        },
      },
      "session_redaction_123",
    );
  });
});
