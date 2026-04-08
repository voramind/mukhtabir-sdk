import { SDK_VERSION } from "../version";
import {
  ConnectionError,
  MukhtabirError,
  TimeoutError,
  createApiError,
} from "./errors";
import { normalizeHeaders } from "./headers";
import type { ApiErrorResponse, MukhtabirOptions, QueryParams } from "./types";
import type {
  RequestConfig,
  ResolvedMukhtabirOptions,
  ResolvedRetryPolicy,
  SuccessEnvelope,
} from "./internal";
import { DEFAULT_BASE_URL } from "./types";

const DEFAULT_RETRY_STATUSES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504,
]);
const DEFAULT_RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function resolveFetch(fetchImpl?: MukhtabirOptions["fetch"]) {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error("A fetch implementation is required in this runtime.");
}

function resolveRetryPolicy(
  retry: MukhtabirOptions["retry"],
): ResolvedRetryPolicy {
  if (retry === false) {
    return {
      maxRetries: 0,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryOnStatuses: new Set<number>(),
      retryOnMethods: new Set<string>(),
      respectRetryAfter: false,
    };
  }

  return {
    maxRetries: retry?.maxRetries ?? 2,
    baseDelayMs: retry?.baseDelayMs ?? 500,
    maxDelayMs: retry?.maxDelayMs ?? 5_000,
    retryOnStatuses: new Set(
      retry?.retryOnStatuses ?? Array.from(DEFAULT_RETRY_STATUSES),
    ),
    retryOnMethods: new Set(
      (retry?.retryOnMethods ?? Array.from(DEFAULT_RETRY_METHODS)).map(
        (method) => method.toUpperCase(),
      ),
    ),
    respectRetryAfter: retry?.respectRetryAfter ?? true,
  };
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}

function normalizeBaseUrl(
  baseUrl?: string,
  allowInsecureBaseUrl = false,
): string {
  const rawBaseUrl = (baseUrl ?? DEFAULT_BASE_URL).trim();
  let parsed: URL;

  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error("`baseUrl` must be a valid absolute URL.");
  }

  if (parsed.search || parsed.hash) {
    throw new Error(
      "`baseUrl` must not include query parameters or hash fragments.",
    );
  }

  if (parsed.protocol === "https:") {
    return rawBaseUrl.replace(/\/+$/, "");
  }

  if (
    parsed.protocol === "http:" &&
    (allowInsecureBaseUrl || isLoopbackHostname(parsed.hostname))
  ) {
    return rawBaseUrl.replace(/\/+$/, "");
  }

  throw new Error(
    "`baseUrl` must use HTTPS unless it targets a loopback host or `allowInsecureBaseUrl` is explicitly enabled.",
  );
}

function buildQueryString(query?: QueryParams): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }

      params.append(
        key,
        value instanceof Date ? value.toISOString() : String(value),
      );
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}${buildQueryString(query)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "AbortError";
}

function parseRetryAfter(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }

  const asNumber = Number(rawValue);
  if (!Number.isNaN(asNumber)) {
    return Math.max(0, asNumber * 1_000);
  }

  const timestamp = Date.parse(rawValue);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, timestamp - Date.now());
}

function computeDelay(
  attempt: number,
  response: Response | null,
  retryPolicy: ResolvedRetryPolicy,
): number {
  if (response && retryPolicy.respectRetryAfter) {
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    if (retryAfter !== null) {
      return retryAfter;
    }
  }

  const delay = retryPolicy.baseDelayMs * 2 ** attempt;
  return Math.min(delay, retryPolicy.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isPlainObject(value) &&
    value.success === false &&
    isPlainObject(value.error)
  );
}

function isSuccessEnvelope<T>(value: unknown): value is SuccessEnvelope<T> {
  return (
    isPlainObject(value) &&
    value.success === true &&
    "data" in value &&
    isPlainObject(value.meta)
  );
}

function createRequestBody(
  body: RequestConfig["body"],
  headers: Headers,
): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams ||
    body instanceof FormData ||
    body instanceof ReadableStream
  ) {
    return body;
  }

  headers.set("content-type", "application/json");
  return JSON.stringify(body);
}

function createAbortController(
  signal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abort, { once: true });
    }
  }

  return {
    controller,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", abort);
      }
    },
    didTimeout: () => timedOut,
  };
}

function shouldRetry(
  method: string,
  status: number | null,
  attempt: number,
  retryPolicy: ResolvedRetryPolicy,
): boolean {
  if (attempt >= retryPolicy.maxRetries) {
    return false;
  }

  if (!retryPolicy.retryOnMethods.has(method.toUpperCase())) {
    return false;
  }

  if (status === null) {
    return true;
  }

  return retryPolicy.retryOnStatuses.has(status);
}

export class MukhtabirTransport {
  private readonly options: ResolvedMukhtabirOptions;

  constructor(options: MukhtabirOptions) {
    if (!options.apiKey) {
      throw new Error("`apiKey` is required.");
    }

    this.options = {
      apiKey: options.apiKey,
      baseUrl: normalizeBaseUrl(options.baseUrl, options.allowInsecureBaseUrl),
      fetch: resolveFetch(options.fetch),
      headers: normalizeHeaders(options.headers),
      retry: resolveRetryPolicy(options.retry),
      timeoutMs: options.timeoutMs ?? 30_000,
      userAgent: options.userAgent ?? `@voramind/mukhtabir-sdk/${SDK_VERSION}`,
      sdkVersion: SDK_VERSION,
    };
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  async request<TEnvelope extends SuccessEnvelope<unknown>>(
    config: RequestConfig,
  ): Promise<TEnvelope> {
    const method = config.method.toUpperCase();
    const url = buildUrl(this.options.baseUrl, config.path, config.query);
    let attempt = 0;

    while (true) {
      const headers = normalizeHeaders(this.options.headers);
      const requestHeaders = normalizeHeaders(config.headers);
      requestHeaders.forEach((value, key) => headers.set(key, value));

      headers.set("accept", "application/json");
      headers.set("authorization", `Bearer ${this.options.apiKey}`);
      headers.set("x-mukhtabir-sdk-version", this.options.sdkVersion);
      headers.set("user-agent", this.options.userAgent);

      const timeoutMs = config.timeoutMs ?? this.options.timeoutMs;
      const { controller, cleanup, didTimeout } = createAbortController(
        config.signal,
        timeoutMs,
      );
      const body = createRequestBody(config.body, headers);

      try {
        const response = await this.options.fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
        const text = await response.text();
        cleanup();
        const parsed = parseJson(text);
        const apiError = isApiErrorResponse(parsed) ? parsed : null;

        if (!response.ok || apiError) {
          const error = createApiError(
            response.status,
            apiError,
            response.headers,
            response.statusText || "Request failed.",
            parsed,
          );

          if (
            shouldRetry(method, response.status, attempt, this.options.retry)
          ) {
            const delay = computeDelay(attempt, response, this.options.retry);
            attempt += 1;
            await sleep(delay);
            continue;
          }

          throw error;
        }

        if (!isSuccessEnvelope(parsed)) {
          throw createApiError(
            response.status,
            null,
            response.headers,
            "Mukhtabir returned an unexpected response shape.",
            parsed,
          );
        }

        return parsed as TEnvelope;
      } catch (error) {
        cleanup();

        if (error instanceof MukhtabirError) {
          throw error;
        }

        if (isAbortError(error)) {
          if (config.signal?.aborted && !didTimeout()) {
            throw new ConnectionError("Request was aborted by the caller.", {
              cause: error,
            });
          }

          if (shouldRetry(method, null, attempt, this.options.retry)) {
            const delay = computeDelay(attempt, null, this.options.retry);
            attempt += 1;
            await sleep(delay);
            continue;
          }

          throw new TimeoutError(`Request timed out after ${timeoutMs}ms.`, {
            cause: error,
          });
        }

        if (shouldRetry(method, null, attempt, this.options.retry)) {
          const delay = computeDelay(attempt, null, this.options.retry);
          attempt += 1;
          await sleep(delay);
          continue;
        }

        throw new ConnectionError("Network request failed.", {
          cause: error,
        });
      }
    }
  }
}
