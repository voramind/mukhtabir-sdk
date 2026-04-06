import { beforeEach, describe, expect, it, vi } from "vitest";

import packageJson from "../../package.json";
import { MukhtabirTransport } from "../../src/core/transport";
import { RateLimitError, TimeoutError, ValidationError } from "../../src/index";
import { jsonResponse } from "../helpers/http";

describe("MukhtabirTransport", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("retries eligible requests and eventually returns success", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests.",
            },
            meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
          },
          {
            status: 429,
            headers: { "Retry-After": "0" },
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { ok: true },
          meta: { request_id: "req_2", timestamp: "2026-03-14T00:00:01Z" },
        }),
      );

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    const result = await transport.request({
      method: "GET",
      path: "/feedback/fb_1",
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
  });

  it("maps API validation failures to ValidationError", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: [{ field: "email", issue: "Invalid email" }],
          },
          meta: { request_id: "req_3", timestamp: "2026-03-14T00:00:02Z" },
        },
        { status: 400 },
      ),
    );

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: false,
    });

    await expect(
      transport.request({
        method: "POST",
        path: "/candidates",
        body: { email: "bad" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws TimeoutError when a request exceeds the timeout", async () => {
    vi.useFakeTimers();

    const fetch = vi.fn().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: false,
      timeoutMs: 50,
    });

    const pending = transport.request({
      method: "GET",
      path: "/feedback/fb_1",
    });
    const expectation = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });

  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();

    const fetch = vi.fn().mockImplementation(async (_input, init) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: () =>
        new Promise<string>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        }),
    }));

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: false,
      timeoutMs: 50,
    });

    const pending = transport.request({
      method: "GET",
      path: "/feedback/fb_1",
    });
    const expectation = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });

  it("throws RateLimitError when retries are exhausted", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests.",
          },
          meta: { request_id: "req_4", timestamp: "2026-03-14T00:00:03Z" },
        },
        { status: 429 },
      ),
    );

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: { maxRetries: 0 },
    });

    await expect(
      transport.request({
        method: "GET",
        path: "/feedback/fb_1",
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("rejects non-HTTPS base URLs for non-loopback hosts", () => {
    expect(
      () =>
        new MukhtabirTransport({
          apiKey: "mk_test",
          baseUrl: "http://example.com/api/v1",
          fetch: vi.fn(),
          retry: false,
        }),
    ).toThrow(/baseUrl/);
  });

  it("allows HTTP base URLs for loopback hosts", () => {
    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      baseUrl: "http://127.0.0.1:8787/api/v1",
      fetch: vi.fn(),
      retry: false,
    });

    expect(transport.baseUrl).toBe("http://127.0.0.1:8787/api/v1");
  });

  it("allows explicitly opting into insecure non-loopback base URLs", () => {
    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      baseUrl: "http://example.com/api/v1",
      allowInsecureBaseUrl: true,
      fetch: vi.fn(),
      retry: false,
    });

    expect(transport.baseUrl).toBe("http://example.com/api/v1");
  });

  it("normalizes custom headers before dispatching requests", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { ok: true },
        meta: { request_id: "req_5", timestamp: "2026-03-14T00:00:04Z" },
      }),
    );

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: false,
      headers: {
        "X-Boolean": true,
        "X-Number": 7,
        "X-Omit": null,
      },
    });

    await transport.request({
      method: "GET",
      path: "/feedback/fb_1",
      headers: {
        "X-Boolean": false,
        "X-Request-Count": 3,
        "X-Skip": undefined,
      },
    });

    const [, init] = fetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.get("x-boolean")).toBe("false");
    expect(headers.get("x-number")).toBe("7");
    expect(headers.get("x-request-count")).toBe("3");
    expect(headers.has("x-omit")).toBe(false);
    expect(headers.has("x-skip")).toBe(false);
  });

  it("uses the package version in SDK metadata headers", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { ok: true },
        meta: { request_id: "req_6", timestamp: "2026-03-14T00:00:05Z" },
      }),
    );

    const transport = new MukhtabirTransport({
      apiKey: "mk_test",
      fetch,
      retry: false,
    });

    await transport.request({
      method: "GET",
      path: "/feedback/fb_1",
    });

    const [, init] = fetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.get("x-mukhtabir-sdk-version")).toBe(packageJson.version);
    expect(headers.get("user-agent")).toBe(
      `@mukhtabir/sdk/${packageJson.version}`,
    );
  });
});
