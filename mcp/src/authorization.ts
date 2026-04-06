export type MukhtabirMcpAccessLevel = "read" | "write" | "delete";

const FULL_ACCESS_SCOPES = ["*", "admin", "full"] as const;
const SUPPORTED_SCOPES = [
  "read",
  "write",
  "delete",
  ...FULL_ACCESS_SCOPES,
] as const;
const FULL_ACCESS_SCOPE_SET = new Set<string>(FULL_ACCESS_SCOPES);
const SUPPORTED_SCOPE_SET = new Set<string>(SUPPORTED_SCOPES);

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface MukhtabirMcpAuthorizationPolicy {
  scopes: string[];
  restricted: boolean;
  allows: (level: MukhtabirMcpAccessLevel) => boolean;
  assert: (level: MukhtabirMcpAccessLevel, surface: string) => void;
}

export function normalizeMukhtabirMcpScopes(
  scopes: string[] | undefined,
): string[] {
  if (!scopes) {
    return [];
  }

  return [
    ...new Set(
      scopes
        .map((scope) => scope.trim().toLowerCase())
        .filter((scope) => scope.length > 0),
    ),
  ];
}

export function findUnsupportedMukhtabirMcpScopes(scopes: string[]) {
  return scopes.filter((scope) => !SUPPORTED_SCOPE_SET.has(scope));
}

export function formatSupportedMukhtabirMcpScopes() {
  return SUPPORTED_SCOPES.join(", ");
}

function hasFullAccess(scopes: string[]) {
  return (
    scopes.length === 0 ||
    scopes.some((scope) => FULL_ACCESS_SCOPE_SET.has(scope))
  );
}

function allowsLevel(scopes: string[], level: MukhtabirMcpAccessLevel) {
  if (hasFullAccess(scopes)) {
    return true;
  }

  switch (level) {
    case "read":
      return scopes.some((scope) =>
        ["read", "write", "delete"].includes(scope),
      );
    case "write":
      return scopes.some((scope) => ["write", "delete"].includes(scope));
    case "delete":
      return scopes.includes("delete");
  }
}

export function createMukhtabirMcpAuthorizationPolicy(
  scopes: string[] | undefined,
): MukhtabirMcpAuthorizationPolicy {
  const normalizedScopes = normalizeMukhtabirMcpScopes(scopes);
  const unrestricted = hasFullAccess(normalizedScopes);

  return {
    scopes: normalizedScopes,
    restricted: !unrestricted,
    allows: (level) => allowsLevel(normalizedScopes, level),
    assert: (level, surface) => {
      if (allowsLevel(normalizedScopes, level)) {
        return;
      }

      const scopeLabel =
        normalizedScopes.length > 0 ? normalizedScopes.join(", ") : "none";

      throw new AuthorizationError(
        `Configured scopes (${scopeLabel}) do not allow ${surface}. Required ${level} access.`,
      );
    },
  };
}
