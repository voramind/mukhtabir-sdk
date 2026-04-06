import type {
  MukhtabirMcpHttpRateLimiter,
  MukhtabirMcpHttpRateLimitResult,
  MukhtabirMcpHttpResolvedTenantInput,
  MukhtabirMcpHttpTenantResolver,
  MukhtabirMcpResolvedSecret,
  MukhtabirMcpSecretResolver,
} from "./config";

interface HttpIntegrationOptions {
  url: string | URL;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestJson(options: HttpIntegrationOptions, body: unknown) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("HTTP integration requires a fetch implementation.");
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readOptionalJson(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text) as unknown;
}

function unwrapPayload<T>(value: unknown, envelopeKey: string): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (isRecord(value) && envelopeKey in value) {
    return value[envelopeKey] as T;
  }

  return value as T;
}

export function createHttpTenantResolver(
  options: HttpIntegrationOptions,
): MukhtabirMcpHttpTenantResolver {
  return async ({ bearerToken }) => {
    const response = await requestJson(options, { bearerToken });

    if (response.status === 404 || response.status === 204) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(
        `Tenant resolver rejected lookup with status ${response.status}.`,
      );
    }

    const payload = unwrapPayload<MukhtabirMcpHttpResolvedTenantInput>(
      await readOptionalJson(response),
      "tenant",
    );

    return payload;
  };
}

export function createHttpSecretResolver(
  options: HttpIntegrationOptions,
): MukhtabirMcpSecretResolver {
  return async (input) => {
    const response = await requestJson(options, input);

    if (!response.ok) {
      throw new Error(
        `Secret resolver rejected lookup with status ${response.status}.`,
      );
    }

    const payload = unwrapPayload<string | MukhtabirMcpResolvedSecret>(
      await readOptionalJson(response),
      "secret",
    );

    if (typeof payload === "string") {
      return payload;
    }

    if (payload && typeof payload.apiKey === "string") {
      return payload;
    }

    throw new Error("Secret resolver returned an invalid payload.");
  };
}

function parseRetryAfterSeconds(response: Response) {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds =
    retryAfterHeader !== null ? Number.parseInt(retryAfterHeader, 10) : NaN;

  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds
    : 1;
}

function normalizeRateLimitResult(
  value: unknown,
  fallbackRetryAfterSeconds: number,
): MukhtabirMcpHttpRateLimitResult {
  if (!isRecord(value) || typeof value.limited !== "boolean") {
    throw new Error("Rate limiter returned an invalid payload.");
  }

  return {
    limited: value.limited,
    retryAfterSeconds:
      typeof value.retryAfterSeconds === "number"
        ? value.retryAfterSeconds
        : fallbackRetryAfterSeconds,
  };
}

export function createHttpRateLimiter(
  options: HttpIntegrationOptions,
): MukhtabirMcpHttpRateLimiter {
  return {
    consume: async (input) => {
      const response = await requestJson(options, input);

      if (response.status === 429) {
        return {
          limited: true,
          retryAfterSeconds: parseRetryAfterSeconds(response),
        };
      }

      if (!response.ok) {
        throw new Error(
          `Rate limiter rejected check with status ${response.status}.`,
        );
      }

      const payload = unwrapPayload<Record<string, unknown>>(
        await readOptionalJson(response),
        "rateLimit",
      );

      return normalizeRateLimitResult(
        payload ?? { limited: false, retryAfterSeconds: 0 },
        0,
      );
    },
  };
}
