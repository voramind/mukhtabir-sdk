import { describe, expect, it } from "vitest";

import { createStructuredStderrAuditLogger } from "../src/shared/audit";

describe("structured audit logger", () => {
  it("redacts audit identifiers and secret-bearing fields", async () => {
    const lines: string[] = [];
    const logger = createStructuredStderrAuditLogger(
      "mukhtabir-mcp-audit-test",
      (line) => {
        lines.push(line);
      },
    );

    await logger.log({
      timestamp: "2026-03-28T00:00:00.000Z",
      type: "session.created",
      tenant_id: "tenant-a",
      client_id: "client-a",
      session_id: "session-a",
      request_id: "req-a",
      details: {
        authorization: "Bearer secret",
        nested: {
          token: "invite-secret",
        },
      },
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      component: "mukhtabir-mcp-audit-test",
      event: {
        timestamp: "2026-03-28T00:00:00.000Z",
        type: "session.created",
        tenant_id: "[REDACTED]",
        client_id: "[REDACTED]",
        session_id: "[REDACTED]",
        request_id: "[REDACTED]",
        details: {
          authorization: "[REDACTED]",
          nested: {
            token: "[REDACTED]",
          },
        },
      },
    });
  });
});
