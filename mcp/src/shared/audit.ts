import { redactForLogsWithExtraKeys } from "./logging";

const AUDIT_REDACTED_KEYS = [
  "tenant_id",
  "client_id",
  "session_id",
  "request_id",
] as const;

export type MukhtabirMcpAuditEventType =
  | "auth.failure"
  | "auth.denied"
  | "rate_limit.exceeded"
  | "session.created"
  | "session.closed"
  | "tool.delete.started"
  | "tool.delete.succeeded"
  | "tool.delete.failed";

export interface MukhtabirMcpAuditEvent {
  timestamp: string;
  type: MukhtabirMcpAuditEventType;
  tenant_id?: string | null;
  client_id?: string | null;
  session_id?: string | null;
  request_id?: string | null;
  operation?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
}

export interface MukhtabirMcpAuditLogger {
  log: (event: MukhtabirMcpAuditEvent) => void | Promise<void>;
}

export interface MukhtabirMcpHttpAuditLoggerOptions {
  url: string | URL;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export function redactAuditEvent(event: MukhtabirMcpAuditEvent) {
  return redactForLogsWithExtraKeys(event, AUDIT_REDACTED_KEYS);
}

function writeToStderr(line: string) {
  process.stderr.write(`${line}\n`);
}

export function createStructuredStderrAuditLogger(
  component: string,
  writeLine: (line: string) => void = writeToStderr,
): MukhtabirMcpAuditLogger {
  return {
    log: (event) => {
      try {
        writeLine(
          JSON.stringify({
            component,
            event: redactAuditEvent(event),
          }),
        );
      } catch {
        writeLine(
          JSON.stringify({
            component,
            event: {
              timestamp: new Date().toISOString(),
              type: "auth.failure",
              reason: "failed_to_serialize_audit_event",
            },
          }),
        );
      }
    },
  };
}

export function createHttpAuditLogger(
  options: MukhtabirMcpHttpAuditLoggerOptions,
): MukhtabirMcpAuditLogger {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("createHttpAuditLogger requires a fetch implementation.");
  }

  return {
    log: async (event) => {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 5_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(options.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...options.headers,
          },
          body: JSON.stringify({
            event: redactAuditEvent(event),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Audit sink rejected event with status ${response.status}.`,
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function emitAuditEvent(
  logger: MukhtabirMcpAuditLogger | undefined,
  event: Omit<MukhtabirMcpAuditEvent, "timestamp"> & { timestamp?: string },
) {
  if (!logger) {
    return;
  }

  try {
    await logger.log({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    });
  } catch {
    // Audit logging must never break request handling.
  }
}

export const mukhtabirMcpAuditLogger = createStructuredStderrAuditLogger(
  "mukhtabir-mcp-audit",
);
