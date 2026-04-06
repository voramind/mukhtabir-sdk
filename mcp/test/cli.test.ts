import { describe, expect, it } from "vitest";

import { main, resolveTransport } from "../src/cli-main";
import { ConfigurationError } from "../src/config";

describe("CLI transport resolution", () => {
  it("accepts supported transport names from the environment", () => {
    expect(
      resolveTransport([], {
        MUKHTABIR_MCP_TRANSPORT: "HTTP",
      }),
    ).toBe("http");
  });

  it("rejects invalid transport flag values", async () => {
    expect(() => resolveTransport(["--transport=htttp"])).toThrow(
      ConfigurationError,
    );

    await expect(main(["--transport=htttp"])).rejects.toThrow(
      /Invalid MCP transport "htttp"/,
    );
  });

  it("rejects a missing transport flag value", () => {
    expect(() => resolveTransport(["--transport"])).toThrow(
      /Missing value for --transport/,
    );
  });
});
