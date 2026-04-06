export function createWorkflowPrompt(description: string, lines: string[]) {
  return {
    description,
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: lines.join("\n\n"),
        },
      },
    ],
  };
}

export function formatKnownInputs(entries: Array<[string, unknown]>) {
  const defined = entries.filter(
    ([, value]) => value !== undefined && value !== null,
  );

  if (defined.length === 0) {
    return "Known inputs: none yet.";
  }

  return [
    "Known inputs:",
    ...defined.map(([label, value]) =>
      Array.isArray(value)
        ? `- ${label}: ${value.join(", ")}`
        : `- ${label}: ${String(value)}`,
    ),
  ].join("\n");
}
