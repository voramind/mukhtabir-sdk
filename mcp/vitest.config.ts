import { defineConfig } from "vitest/config";

import { sdkVersionDefine } from "../typescript/build-constants";

export default defineConfig({
  define: sdkVersionDefine,
  test: {
    environment: "node",
  },
});
