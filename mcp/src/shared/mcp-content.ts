export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function createTextContent(text: string) {
  return {
    type: "text" as const,
    text,
  };
}

export function createResourceLink(
  uri: string,
  name: string,
  description?: string,
  mimeType = "application/json",
) {
  return {
    type: "resource_link" as const,
    uri,
    name,
    description,
    mimeType,
  };
}

export function createToolResult(
  summary: string,
  structuredContent: Record<string, unknown>,
  resourceLinks: Array<ReturnType<typeof createResourceLink>> = [],
) {
  return {
    content: [createTextContent(summary), ...resourceLinks],
    structuredContent,
  };
}

export function createJsonResource(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: formatJson(value),
      },
    ],
  };
}

export function createTextResource(
  uri: string,
  text: string,
  mimeType = "text/plain",
) {
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
}
