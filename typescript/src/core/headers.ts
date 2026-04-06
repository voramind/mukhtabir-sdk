import type { HeadersLike } from "./types";

export function normalizeHeaders(input?: HeadersLike): Headers {
  const headers = new Headers();
  if (!input) {
    return headers;
  }

  if (input instanceof Headers) {
    input.forEach((value, key) => headers.set(key, value));
    return headers;
  }

  if (Array.isArray(input)) {
    for (const [key, value] of input) {
      headers.set(key, value);
    }
    return headers;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }
    headers.set(key, String(value));
  }

  return headers;
}
