import { WebhookVerificationError } from "../core/errors";
import { normalizeHeaders } from "../core/headers";
import type { HeadersLike } from "../core/types";
import type { WebhookEvent } from "../types/webhooks";
import { isWebhookEventType } from "./events";

export const WEBHOOK_HEADER_NAMES = {
  signature: "x-mukhtabir-signature",
  event: "x-mukhtabir-event",
  deliveryId: "x-mukhtabir-delivery-id",
  timestamp: "x-mukhtabir-timestamp",
} as const;

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface WebhookHeaderValues {
  signature: string | null;
  event: string | null;
  deliveryId: string | null;
  timestamp: string | null;
}

export interface VerifyWebhookSignatureOptions {
  body: string | Uint8Array | ArrayBuffer;
  secret: string;
  signature: string;
  timestamp: string | number;
  toleranceSeconds?: number | null;
  now?: number | Date;
}

export interface ParseWebhookEventOptions {
  body: string | Uint8Array | ArrayBuffer;
  headers?: HeadersLike;
  secret?: string;
  verifySignature?: boolean;
  allowUnverified?: boolean;
  toleranceSeconds?: number | null;
  now?: number | Date;
}

export interface ParsedWebhookEvent<
  E extends WebhookEvent["event"] = WebhookEvent["event"],
> {
  event: WebhookEvent<E>;
  headers: WebhookHeaderValues;
}

function toUint8Array(body: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  return new Uint8Array(body);
}

function toText(body: string | Uint8Array | ArrayBuffer): string {
  if (typeof body === "string") {
    return body;
  }
  return new TextDecoder().decode(toUint8Array(body));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function computeHmacSha256(
  secret: string,
  data: string,
): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(data),
    );
    return toHex(new Uint8Array(signature));
  }

  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(data).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function resolveNow(now?: number | Date): number {
  if (now instanceof Date) {
    return Math.floor(now.getTime() / 1_000);
  }
  if (typeof now === "number") {
    return Math.floor(now);
  }
  return Math.floor(Date.now() / 1_000);
}

function readWebhookHeaders(headers?: HeadersLike): WebhookHeaderValues {
  const normalized = normalizeHeaders(headers);
  return {
    signature: normalized.get(WEBHOOK_HEADER_NAMES.signature),
    event: normalized.get(WEBHOOK_HEADER_NAMES.event),
    deliveryId: normalized.get(WEBHOOK_HEADER_NAMES.deliveryId),
    timestamp: normalized.get(WEBHOOK_HEADER_NAMES.timestamp),
  };
}

function resolveToleranceSeconds(
  toleranceSeconds?: number | null,
): number | null {
  if (toleranceSeconds === undefined) {
    return DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  }
  if (toleranceSeconds === null) {
    return null;
  }
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
    throw new WebhookVerificationError(
      "Webhook tolerance must be a non-negative number or null.",
    );
  }
  return toleranceSeconds;
}

function assertFreshTimestamp(
  timestamp: string,
  toleranceSeconds?: number | null,
  now?: number | Date,
): void {
  const resolvedToleranceSeconds = resolveToleranceSeconds(toleranceSeconds);
  if (resolvedToleranceSeconds === null) {
    return;
  }

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) {
    throw new WebhookVerificationError("Webhook timestamp header is invalid.");
  }

  const age = Math.abs(resolveNow(now) - numericTimestamp);
  if (age > resolvedToleranceSeconds) {
    throw new WebhookVerificationError(
      "Webhook timestamp is outside the allowed tolerance window.",
    );
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function computeWebhookSignature(
  options: Omit<
    VerifyWebhookSignatureOptions,
    "signature" | "toleranceSeconds" | "now"
  >,
): Promise<string> {
  const body = toText(options.body);
  const timestamp = String(options.timestamp);
  return computeHmacSha256(options.secret, `${timestamp}.${body}`);
}

export async function verifyWebhookSignature(
  options: VerifyWebhookSignatureOptions,
): Promise<boolean> {
  assertFreshTimestamp(
    String(options.timestamp),
    options.toleranceSeconds,
    options.now,
  );
  const expected = await computeWebhookSignature(options);
  return constantTimeEqual(options.signature, expected);
}

export async function parseWebhookEvent(
  options: ParseWebhookEventOptions,
): Promise<ParsedWebhookEvent> {
  const headers = readWebhookHeaders(options.headers);
  const shouldVerifySignature =
    options.verifySignature === true ||
    (options.verifySignature !== false && options.allowUnverified !== true);

  if (!shouldVerifySignature && options.allowUnverified !== true) {
    throw new WebhookVerificationError(
      "Webhook verification is enabled by default. Pass `allowUnverified: true` to parse an unsigned payload intentionally.",
    );
  }

  if (shouldVerifySignature) {
    if (!options.secret) {
      throw new WebhookVerificationError(
        "Webhook verification requires a secret.",
      );
    }
    if (!headers.signature || !headers.timestamp) {
      throw new WebhookVerificationError(
        "Webhook signature headers are missing.",
      );
    }

    const verified = await verifyWebhookSignature({
      body: options.body,
      secret: options.secret,
      signature: headers.signature,
      timestamp: headers.timestamp,
      toleranceSeconds: options.toleranceSeconds,
      now: options.now,
    });

    if (!verified) {
      throw new WebhookVerificationError(
        "Webhook signature verification failed.",
      );
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(toText(options.body));
  } catch (error) {
    throw new WebhookVerificationError("Webhook body is not valid JSON.", {
      cause: error,
    });
  }

  if (
    !isObject(parsed) ||
    typeof parsed.event !== "string" ||
    typeof parsed.timestamp !== "string" ||
    !("data" in parsed)
  ) {
    throw new WebhookVerificationError(
      "Webhook payload has an unexpected shape.",
      {
        body: parsed,
      },
    );
  }

  if (!isWebhookEventType(parsed.event)) {
    throw new WebhookVerificationError(
      `Unsupported Mukhtabir webhook event: ${parsed.event}.`,
      {
        body: parsed,
      },
    );
  }

  if (headers.event && headers.event !== parsed.event) {
    throw new WebhookVerificationError(
      "Webhook event header does not match the payload body.",
      {
        body: parsed,
      },
    );
  }

  return {
    event: parsed as unknown as WebhookEvent,
    headers,
  };
}
