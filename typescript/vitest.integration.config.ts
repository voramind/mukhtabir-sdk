import { defineConfig } from "vitest/config";

import { sdkVersionDefine } from "./build-constants";

export default defineConfig({
  define: sdkVersionDefine,
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 20_000,
    setupFiles: ["./test/helpers/load-integration-env.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
