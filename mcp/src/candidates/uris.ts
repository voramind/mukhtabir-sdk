export const CANDIDATE_RESOURCE_TEMPLATE =
  "mukhtabir://candidates/{email}" as const;

export function candidateResourceUri(email: string) {
  return `mukhtabir://candidates/${encodeURIComponent(email)}`;
}
