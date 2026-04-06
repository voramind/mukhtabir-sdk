import { defineConfig } from "tsup";

import { sdkVersionDefine } from "./build-constants";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/index.ts",
    "src/resources/index.ts",
    "src/types/index.ts",
    "src/webhooks/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  splitting: false,
  treeshake: true,
  outDir: "dist",
  define: sdkVersionDefine,
});
