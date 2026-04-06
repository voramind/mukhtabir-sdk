import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ConfigurationError } from "./config";
import { startMukhtabirMcpHttpServer } from "./http";
import { mukhtabirMcpLogger } from "./shared/logging";
import { createMukhtabirMcpServer } from "./server";

export type MukhtabirMcpTransport = "stdio" | "http";

function parseTransport(value: string): MukhtabirMcpTransport {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "stdio" || normalizedValue === "http") {
    return normalizedValue;
  }

  throw new ConfigurationError(
    `Invalid MCP transport "${value}". Use "stdio" or "http".`,
  );
}

export function resolveTransport(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): MukhtabirMcpTransport {
  if (argv.includes("--http") || argv.includes("http")) {
    return "http";
  }

  const transportFlag = argv.find((arg) => arg.startsWith("--transport="));
  if (transportFlag) {
    return parseTransport(transportFlag.slice("--transport=".length));
  }

  const transportIndex = argv.indexOf("--transport");
  if (transportIndex >= 0) {
    const transportValue = argv[transportIndex + 1];

    if (!transportValue || transportValue.startsWith("--")) {
      throw new ConfigurationError(
        'Missing value for --transport. Use "stdio" or "http".',
      );
    }

    return parseTransport(transportValue);
  }

  return parseTransport(env.MUKHTABIR_MCP_TRANSPORT ?? "stdio");
}

export async function main(argv: string[] = process.argv.slice(2)) {
  const transport = resolveTransport(argv);

  if (transport === "http") {
    const { url } = await startMukhtabirMcpHttpServer();
    mukhtabirMcpLogger.info("Mukhtabir MCP HTTP server listening.", {
      transport,
      url,
    });
    return;
  }

  const { server } = createMukhtabirMcpServer();
  const stdioTransport = new StdioServerTransport();

  await server.connect(stdioTransport);
}
