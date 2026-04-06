declare const __MUKHTABIR_SDK_VERSION__: string;

const injectedVersion =
  typeof __MUKHTABIR_SDK_VERSION__ === "string"
    ? __MUKHTABIR_SDK_VERSION__
    : undefined;

export const SDK_VERSION = injectedVersion ?? "0.0.0";
