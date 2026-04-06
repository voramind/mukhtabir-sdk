import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(contents: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length)
      : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.set(key, value.replace(/\\n/gu, "\n"));
  }

  return entries;
}

const repoRootEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);

if (existsSync(repoRootEnvPath)) {
  const entries = parseEnvFile(readFileSync(repoRootEnvPath, "utf8"));

  for (const [key, value] of entries) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
