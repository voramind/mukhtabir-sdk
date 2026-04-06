import type { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";

type StructuredLogData = Record<string, unknown>;
type StructuredLogWriter = (line: string) => void;
type StructuredLogLevel = Extract<
  LoggingLevel,
  "debug" | "info" | "warning" | "error"
>;
const REDACTED_VALUE = "[REDACTED]";

const REDACTED_KEYS = new Set([
  "access_token",
  "accessToken",
  "api_key",
  "apiKey",
  "authorization",
  "bearerToken",
  "interview_url",
  "interviewUrl",
  "secret",
  "secret_preview",
  "token",
]);

function redactWithKeys(
  value: unknown,
  redactedKeys: ReadonlySet<string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactWithKeys(item, redactedKeys));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        redactedKeys.has(key)
          ? REDACTED_VALUE
          : redactWithKeys(entryValue, redactedKeys),
      ]),
    );
  }

  return value;
}

export function redactForLogs(value: unknown): unknown {
  return redactWithKeys(value, REDACTED_KEYS);
}

export function redactForLogsWithExtraKeys(
  value: unknown,
  extraRedactedKeys: Iterable<string>,
): unknown {
  const combinedRedactedKeys = new Set(REDACTED_KEYS);

  for (const key of extraRedactedKeys) {
    combinedRedactedKeys.add(key);
  }

  return redactWithKeys(value, combinedRedactedKeys);
}

function writeToStderr(line: string) {
  process.stderr.write(`${line}\n`);
}

export function createStructuredStderrLogger(
  component: string,
  writeLine: StructuredLogWriter = writeToStderr,
) {
  function emit(
    level: StructuredLogLevel,
    message: string,
    data?: StructuredLogData,
  ) {
    try {
      writeLine(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          component,
          level,
          message,
          data: data ? redactForLogs(data) : undefined,
        }),
      );
    } catch {
      writeLine(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          component,
          level,
          message,
          data: {
            error: "Failed to serialize log payload.",
          },
        }),
      );
    }
  }

  return {
    debug: (message: string, data?: StructuredLogData) =>
      emit("debug", message, data),
    info: (message: string, data?: StructuredLogData) =>
      emit("info", message, data),
    warning: (message: string, data?: StructuredLogData) =>
      emit("warning", message, data),
    error: (message: string, data?: StructuredLogData) =>
      emit("error", message, data),
  };
}

export const mukhtabirMcpLogger = createStructuredStderrLogger("mukhtabir-mcp");
