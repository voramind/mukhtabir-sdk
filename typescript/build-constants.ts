import { readFileSync } from "node:fs";

type PackageJson = {
  version: string;
};

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as PackageJson;

export const sdkVersion = packageJson.version;
export const sdkVersionDefine = {
  __MUKHTABIR_SDK_VERSION__: JSON.stringify(sdkVersion),
};
