import { defineConfig } from "vitest/config";

import { sdkVersionDefine } from "./build-constants";

export default defineConfig({
  define: sdkVersionDefine,
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
