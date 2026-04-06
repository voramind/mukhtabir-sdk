import { describe, expect, it } from "vitest";

import { createStructuredStderrLogger } from "../src/shared/logging";

describe("structured logger", () => {
  it("redacts secret-bearing fields before writing stderr logs", () => {
    const lines: string[] = [];
    const logger = createStructuredStderrLogger(
      "mukhtabir-mcp-test",
      (line) => {
        lines.push(line);
      },
    );

    logger.error("fatal", {
      safe: "value",
      authorization: "Bearer secret",
      nested: {
        apiKey: "mk_secret",
        token: "invite_secret",
      },
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      component: "mukhtabir-mcp-test",
      level: "error",
      message: "fatal",
      data: {
        safe: "value",
        authorization: "[REDACTED]",
        nested: {
          apiKey: "[REDACTED]",
          token: "[REDACTED]",
        },
      },
    });
  });
});
