export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxLength).trimEnd()}\n…`,
    truncated: true,
  };
}

export function sanitizeInvitationUrl(value: string) {
  try {
    const url = new URL(value);
    const hadSecretMaterial = url.search.length > 0 || url.hash.length > 0;

    url.search = "";
    url.hash = "";

    return {
      value: url.toString(),
      redacted: hadSecretMaterial,
    };
  } catch {
    const sanitized = value.split(/[?#]/, 1)[0] ?? value;

    return {
      value: sanitized,
      redacted: sanitized !== value,
    };
  }
}

export function sanitizeInvitation<
  T extends {
    access_token?: string;
    interview_url?: string;
  },
>(value: T) {
  const { access_token: _token, interview_url, ...rest } = value;
  const sanitizedUrl =
    typeof interview_url === "string"
      ? sanitizeInvitationUrl(interview_url)
      : undefined;

  return {
    ...rest,
    ...(sanitizedUrl
      ? {
          interview_url: sanitizedUrl.value,
          interview_url_redacted: sanitizedUrl.redacted,
        }
      : {}),
    access_token_redacted: typeof value.access_token === "string",
  };
}

export function sanitizeWebhookSecret<T extends { secret?: string }>(value: T) {
  const { secret: _secret, ...rest } = value;

  return {
    ...rest,
    secret_redacted: typeof value.secret === "string",
  };
}
