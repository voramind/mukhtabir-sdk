import { main } from "./cli-main";
import { mukhtabirMcpLogger } from "./shared/logging";

main().catch((error: unknown) => {
  mukhtabirMcpLogger.error("Mukhtabir MCP CLI exited with a fatal error.", {
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : {
            message: String(error),
          },
  });
  process.exit(1);
});
