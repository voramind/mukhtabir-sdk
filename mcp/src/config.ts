import { DEFAULT_BASE_URL } from "../../typescript/src/core/types";

import {
  findUnsupportedMukhtabirMcpScopes,
  formatSupportedMukhtabirMcpScopes,
  normalizeMukhtabirMcpScopes,
} from "./authorization";
import type { MukhtabirMcpAuditLogger } from "./shared/audit";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export interface MukhtabirMcpConfigInput {
  apiKey?: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}

export interface MukhtabirMcpConfig {
  apiKey: string;
  baseUrl?: string;
}

export function loadMukhtabirMcpConfig(
  input: MukhtabirMcpConfigInput = {},
): MukhtabirMcpConfig {
  const env = input.env ?? process.env;
  const apiKey = input.apiKey ?? env.MUKHTABIR_API_KEY;

  if (!apiKey) {
    throw new ConfigurationError(
      "Missing Mukhtabir credentials. Set MUKHTABIR_API_KEY before starting the MCP server.",
    );
  }

  const baseUrl = input.baseUrl ?? env.MUKHTABIR_BASE_URL;

  return {
    apiKey,
    baseUrl: baseUrl || undefined,
  };
}

export type MukhtabirMcpHttpTenantStatus = "active" | "suspended" | "revoked";

export interface MukhtabirMcpHttpTenantInput {
  tenantId?: string;
  bearerToken: string;
  apiKey?: string;
  baseUrl?: string;
  clientId?: string;
  scopes?: string[];
  status?: MukhtabirMcpHttpTenantStatus;
  secretRef?: string;
  secretVersion?: string;
}

export interface MukhtabirMcpHttpResolvedTenantInput {
  tenantId?: string;
  bearerToken?: string;
  apiKey?: string;
  baseUrl?: string;
  clientId?: string;
  scopes?: string[];
  status?: MukhtabirMcpHttpTenantStatus;
  secretRef?: string;
  secretVersion?: string;
}

export interface MukhtabirMcpHttpTenantResolverInput {
  bearerToken: string;
}

export type MukhtabirMcpHttpTenantResolver = (
  input: MukhtabirMcpHttpTenantResolverInput,
) =>
  | MukhtabirMcpHttpResolvedTenantInput
  | undefined
  | Promise<MukhtabirMcpHttpResolvedTenantInput | undefined>;

export interface MukhtabirMcpResolvedSecret {
  apiKey: string;
  secretVersion?: string;
}

export interface MukhtabirMcpSecretResolverInput {
  tenantId: string;
  bearerToken: string;
  clientId: string;
  baseUrl?: string;
  scopes: string[];
  status: MukhtabirMcpHttpTenantStatus;
  secretRef: string;
  secretVersion?: string;
}

export type MukhtabirMcpSecretResolver = (
  input: MukhtabirMcpSecretResolverInput,
) =>
  | string
  | MukhtabirMcpResolvedSecret
  | Promise<string | MukhtabirMcpResolvedSecret>;

export interface MukhtabirMcpHttpRateLimitConfigInput {
  windowMs?: number;
  maxRequests?: number;
  maxInitializeRequests?: number;
}

export interface MukhtabirMcpHttpRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxInitializeRequests: number;
}

export interface MukhtabirMcpHttpRateLimitRequest {
  key: string;
  kind: "initialize" | "request";
  tenantId: string;
  clientId: string;
  sessionId?: string;
}

export interface MukhtabirMcpHttpRateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

export interface MukhtabirMcpHttpRateLimiter {
  consume: (
    input: MukhtabirMcpHttpRateLimitRequest,
  ) =>
    | MukhtabirMcpHttpRateLimitResult
    | Promise<MukhtabirMcpHttpRateLimitResult>;
}

export interface MukhtabirMcpHttpTenantDefinition {
  tenantId: string;
  bearerToken: string;
  apiKey?: string;
  baseUrl?: string;
  clientId: string;
  scopes: string[];
  status: MukhtabirMcpHttpTenantStatus;
  secretRef?: string;
  secretVersion?: string;
}

export interface MukhtabirMcpHttpTenant extends Omit<
  MukhtabirMcpHttpTenantDefinition,
  "apiKey"
> {
  apiKey: string;
}

export interface MukhtabirMcpHttpConfigInput extends MukhtabirMcpConfigInput {
  bearerToken?: string;
  clientId?: string;
  scopes?: string[];
  host?: string;
  port?: number;
  path?: string;
  allowedHosts?: string[];
  allowedBaseUrls?: string[];
  sessionTtlMs?: number;
  sessionAbsoluteTtlMs?: number;
  maxSessions?: number;
  rateLimit?: MukhtabirMcpHttpRateLimitConfigInput;
  rateLimiter?: MukhtabirMcpHttpRateLimiter;
  tenantResolver?: MukhtabirMcpHttpTenantResolver;
  secretResolver?: MukhtabirMcpSecretResolver;
  auditLogger?: MukhtabirMcpAuditLogger;
  tenants?: MukhtabirMcpHttpTenantInput[];
}

export interface MukhtabirMcpHttpConfig {
  host: string;
  port: number;
  path: string;
  allowedHosts?: string[];
  allowedBaseUrls?: string[];
  sessionTtlMs: number;
  sessionAbsoluteTtlMs: number;
  maxSessions: number;
  rateLimit: MukhtabirMcpHttpRateLimitConfig;
  rateLimiter?: MukhtabirMcpHttpRateLimiter;
  tenantResolver?: MukhtabirMcpHttpTenantResolver;
  secretResolver?: MukhtabirMcpSecretResolver;
  auditLogger?: MukhtabirMcpAuditLogger;
  tenants: MukhtabirMcpHttpTenantDefinition[];
}

const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_HTTP_PATH = "/mcp";
const DEFAULT_HTTP_SESSION_TTL_MS = 15 * 60_000;
const DEFAULT_HTTP_SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60_000;
const DEFAULT_HTTP_MAX_SESSIONS = 100;
const DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_HTTP_RATE_LIMIT_MAX_REQUESTS = 300;
const DEFAULT_HTTP_RATE_LIMIT_MAX_INITIALIZE_REQUESTS = 30;
const DEFAULT_TENANT_ID = "default";
const DEFAULT_CLIENT_ID = "mukhtabir-mcp";
const ACTIVE_TENANT_STATUS = "active";
const SUPPORTED_TENANT_STATUSES = new Set<MukhtabirMcpHttpTenantStatus>([
  ACTIVE_TENANT_STATUS,
  "suspended",
  "revoked",
]);

function parseCommaSeparatedList(rawValue?: string): string[] | undefined {
  if (!rawValue) {
    return undefined;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length > 0 ? values : undefined;
}

function parsePort(rawValue: number | string | undefined): number {
  if (rawValue === undefined) {
    return DEFAULT_HTTP_PORT;
  }

  const port =
    typeof rawValue === "number" ? rawValue : Number.parseInt(rawValue, 10);

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new ConfigurationError(
      "Invalid MCP HTTP port. Set MUKHTABIR_MCP_HTTP_PORT to an integer between 0 and 65535.",
    );
  }

  return port;
}

function normalizePath(path: string | undefined): string {
  if (!path) {
    return DEFAULT_HTTP_PATH;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function parsePositiveInteger(
  rawValue: number | string | undefined,
  fallback: number,
  settingName: string,
  envName: string,
) {
  if (rawValue === undefined) {
    return fallback;
  }

  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new ConfigurationError(
      `Invalid ${settingName}. Set ${envName} to a positive integer.`,
    );
  }

  return value;
}

function normalizeConfiguredBaseUrl(
  value: string | undefined,
  sourceLabel: string,
) {
  const rawValue = (value?.trim() || DEFAULT_BASE_URL).trim();
  let parsed: URL;

  try {
    parsed = new URL(rawValue);
  } catch {
    throw new ConfigurationError(
      `${sourceLabel} must be a valid absolute URL.`,
    );
  }

  if (parsed.search || parsed.hash) {
    throw new ConfigurationError(
      `${sourceLabel} must not include query parameters or hash fragments.`,
    );
  }

  return rawValue.replace(/\/+$/, "");
}

function normalizeConfiguredBaseUrlList(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return [
    ...new Set(
      values.map((value) =>
        normalizeConfiguredBaseUrl(value, "Allowed Mukhtabir base URLs"),
      ),
    ),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalScopeList(
  value: unknown,
  errorMessage: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    value.some((scope) => typeof scope !== "string")
  ) {
    throw new ConfigurationError(errorMessage);
  }

  return value;
}

function parseTenantScopes(value: Record<string, unknown>) {
  return parseOptionalScopeList(
    value.scopes ?? value.scope,
    "Invalid MUKHTABIR_MCP_TENANTS_JSON entry. `scopes` and `scope` must be arrays of strings.",
  );
}

function parseTenantStatus(value: Record<string, unknown>) {
  const status =
    typeof value.status === "string"
      ? value.status
      : typeof value.tenant_status === "string"
        ? value.tenant_status
        : undefined;

  if (status === undefined) {
    return undefined;
  }

  return status as MukhtabirMcpHttpTenantStatus;
}

function parseTenantRecord(
  tenantId: string,
  value: unknown,
): MukhtabirMcpHttpTenantInput {
  if (!isRecord(value)) {
    throw new ConfigurationError(
      "Invalid MUKHTABIR_MCP_TENANTS_JSON entry. Each tenant must be an object.",
    );
  }

  const bearerToken =
    typeof value.bearerToken === "string"
      ? value.bearerToken
      : typeof value.token === "string"
        ? value.token
        : undefined;
  const apiKey =
    typeof value.apiKey === "string"
      ? value.apiKey
      : typeof value.api_key === "string"
        ? value.api_key
        : undefined;
  const baseUrl =
    typeof value.baseUrl === "string"
      ? value.baseUrl
      : typeof value.base_url === "string"
        ? value.base_url
        : undefined;
  const clientId =
    typeof value.clientId === "string"
      ? value.clientId
      : typeof value.client_id === "string"
        ? value.client_id
        : undefined;
  const scopes = parseTenantScopes(value);
  const status = parseTenantStatus(value);
  const secretRef =
    typeof value.secretRef === "string"
      ? value.secretRef
      : typeof value.secret_ref === "string"
        ? value.secret_ref
        : undefined;
  const secretVersion =
    typeof value.secretVersion === "string"
      ? value.secretVersion
      : typeof value.secret_version === "string"
        ? value.secret_version
        : undefined;

  if (!bearerToken) {
    throw new ConfigurationError(
      "Invalid MUKHTABIR_MCP_TENANTS_JSON entry. Each tenant must include `bearerToken`.",
    );
  }

  if (!apiKey && !secretRef) {
    throw new ConfigurationError(
      "Invalid MUKHTABIR_MCP_TENANTS_JSON entry. Each tenant must include `apiKey` or `secretRef`.",
    );
  }

  return {
    tenantId,
    bearerToken,
    apiKey,
    baseUrl,
    clientId,
    scopes,
    status,
    secretRef,
    secretVersion,
  };
}

function parseTenantsJson(
  rawValue: string | undefined,
): MukhtabirMcpHttpTenantInput[] {
  if (!rawValue) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    throw new ConfigurationError(
      error instanceof Error
        ? `Invalid MUKHTABIR_MCP_TENANTS_JSON: ${error.message}`
        : "Invalid MUKHTABIR_MCP_TENANTS_JSON.",
    );
  }

  if (Array.isArray(parsed)) {
    return parsed.map((tenant, index) => {
      if (!isRecord(tenant)) {
        throw new ConfigurationError(
          "Invalid MUKHTABIR_MCP_TENANTS_JSON entry. Each tenant must be an object.",
        );
      }

      return parseTenantRecord(
        typeof tenant.tenantId === "string"
          ? tenant.tenantId
          : typeof tenant.tenant_id === "string"
            ? tenant.tenant_id
            : `tenant-${index + 1}`,
        tenant,
      );
    });
  }

  if (isRecord(parsed)) {
    return Object.entries(parsed).map(([tenantId, tenant]) =>
      parseTenantRecord(tenantId, tenant),
    );
  }

  throw new ConfigurationError(
    "Invalid MUKHTABIR_MCP_TENANTS_JSON. Expected an array or object.",
  );
}

function normalizeTenantStatus(
  value: string | undefined,
  sourceLabel: string,
): MukhtabirMcpHttpTenantStatus {
  if (!value) {
    return ACTIVE_TENANT_STATUS;
  }

  const normalized = value.trim().toLowerCase() as MukhtabirMcpHttpTenantStatus;

  if (!SUPPORTED_TENANT_STATUSES.has(normalized)) {
    throw new ConfigurationError(
      `${sourceLabel} has unsupported tenant status "${value}". Supported statuses are ${Array.from(SUPPORTED_TENANT_STATUSES).join(", ")}.`,
    );
  }

  return normalized;
}

function normalizeTenantRecord(
  input: MukhtabirMcpHttpResolvedTenantInput,
  options: {
    tenantIdFallback: string;
    bearerToken: string;
    sourceLabel: string;
    allowedBaseUrls?: string[];
    allowDeferredApiKey?: boolean;
  },
): MukhtabirMcpHttpTenantDefinition {
  const tenantId = input.tenantId?.trim() || options.tenantIdFallback;
  const bearerToken = (input.bearerToken ?? options.bearerToken).trim();
  const apiKey = input.apiKey?.trim() || undefined;
  const clientId = input.clientId?.trim() || tenantId || DEFAULT_CLIENT_ID;
  const scopes = normalizeMukhtabirMcpScopes(
    parseOptionalScopeList(
      input.scopes,
      `${options.sourceLabel} has invalid MCP scopes. Expected an array of strings.`,
    ),
  );
  const unsupportedScopes = findUnsupportedMukhtabirMcpScopes(scopes);
  const status = normalizeTenantStatus(input.status, options.sourceLabel);
  const normalizedBaseUrl = normalizeConfiguredBaseUrl(
    input.baseUrl,
    `${options.sourceLabel} base URL`,
  );

  if (!bearerToken) {
    throw new ConfigurationError(
      `${options.sourceLabel} is missing a bearer token for MCP HTTP auth.`,
    );
  }

  if (!apiKey && !input.secretRef?.trim()) {
    throw new ConfigurationError(
      `${options.sourceLabel} is missing a Mukhtabir API key or secret reference.`,
    );
  }

  if (!apiKey && input.secretRef?.trim() && !options.allowDeferredApiKey) {
    throw new ConfigurationError(
      `${options.sourceLabel} requires a secretResolver before using secretRef without an inline Mukhtabir API key.`,
    );
  }

  if (unsupportedScopes.length > 0) {
    throw new ConfigurationError(
      `${options.sourceLabel} has unsupported MCP scopes: ${unsupportedScopes.join(", ")}. Supported scopes are ${formatSupportedMukhtabirMcpScopes()}.`,
    );
  }

  if (
    options.allowedBaseUrls &&
    !options.allowedBaseUrls.includes(normalizedBaseUrl)
  ) {
    throw new ConfigurationError(
      `${options.sourceLabel} uses a Mukhtabir base URL that is not in MUKHTABIR_MCP_HTTP_ALLOWED_BASE_URLS.`,
    );
  }

  return {
    tenantId,
    bearerToken,
    apiKey,
    baseUrl:
      normalizedBaseUrl === DEFAULT_BASE_URL ? undefined : normalizedBaseUrl,
    clientId,
    scopes,
    status,
    secretRef: input.secretRef?.trim() || undefined,
    secretVersion: input.secretVersion?.trim() || undefined,
  };
}

function normalizeTenant(
  input: MukhtabirMcpHttpTenantInput,
  index: number,
  allowDeferredApiKey: boolean,
  allowedBaseUrls?: string[],
): MukhtabirMcpHttpTenantDefinition {
  return normalizeTenantRecord(input, {
    tenantIdFallback: `tenant-${index + 1}`,
    bearerToken: input.bearerToken,
    sourceLabel: `Tenant ${input.tenantId?.trim() || `tenant-${index + 1}`}`,
    allowDeferredApiKey,
    allowedBaseUrls,
  });
}

export function normalizeResolvedMukhtabirMcpHttpTenant(
  input: MukhtabirMcpHttpResolvedTenantInput,
  bearerToken: string,
  options: {
    allowedBaseUrls?: string[];
    sourceLabel?: string;
    allowDeferredApiKey?: boolean;
  } = {},
) {
  return normalizeTenantRecord(input, {
    tenantIdFallback: DEFAULT_TENANT_ID,
    bearerToken,
    sourceLabel: options.sourceLabel ?? "Resolved tenant",
    allowDeferredApiKey: options.allowDeferredApiKey,
    allowedBaseUrls: options.allowedBaseUrls,
  });
}

function ensureUniqueTenants(tenants: MukhtabirMcpHttpTenantDefinition[]) {
  const tenantIds = new Set<string>();
  const bearerTokens = new Set<string>();

  for (const tenant of tenants) {
    if (tenantIds.has(tenant.tenantId)) {
      throw new ConfigurationError(
        `Duplicate tenant ID in MCP HTTP config: ${tenant.tenantId}.`,
      );
    }
    if (bearerTokens.has(tenant.bearerToken)) {
      throw new ConfigurationError(
        `Duplicate bearer token in MCP HTTP config for tenant ${tenant.tenantId}.`,
      );
    }

    tenantIds.add(tenant.tenantId);
    bearerTokens.add(tenant.bearerToken);
  }
}

function parseRateLimitConfig(
  input: MukhtabirMcpHttpRateLimitConfigInput | undefined,
  env: NodeJS.ProcessEnv,
): MukhtabirMcpHttpRateLimitConfig {
  const windowMs = parsePositiveInteger(
    input?.windowMs ?? env.MUKHTABIR_MCP_HTTP_RATE_LIMIT_WINDOW_MS,
    DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS,
    "MCP HTTP rate-limit window",
    "MUKHTABIR_MCP_HTTP_RATE_LIMIT_WINDOW_MS",
  );
  const maxRequests = parsePositiveInteger(
    input?.maxRequests ?? env.MUKHTABIR_MCP_HTTP_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_HTTP_RATE_LIMIT_MAX_REQUESTS,
    "MCP HTTP max requests per window",
    "MUKHTABIR_MCP_HTTP_RATE_LIMIT_MAX_REQUESTS",
  );
  const rawMaxInitializeRequests =
    input?.maxInitializeRequests ??
    env.MUKHTABIR_MCP_HTTP_RATE_LIMIT_MAX_INITIALIZE_REQUESTS;
  const maxInitializeRequests = parsePositiveInteger(
    rawMaxInitializeRequests,
    Math.min(DEFAULT_HTTP_RATE_LIMIT_MAX_INITIALIZE_REQUESTS, maxRequests),
    "MCP HTTP max initialize requests per window",
    "MUKHTABIR_MCP_HTTP_RATE_LIMIT_MAX_INITIALIZE_REQUESTS",
  );

  if (maxInitializeRequests > maxRequests) {
    throw new ConfigurationError(
      "MCP HTTP max initialize requests per window cannot exceed the total max requests per window.",
    );
  }

  return {
    windowMs,
    maxRequests,
    maxInitializeRequests,
  };
}

export function loadMukhtabirMcpHttpConfig(
  input: MukhtabirMcpHttpConfigInput = {},
): MukhtabirMcpHttpConfig {
  const env = input.env ?? process.env;
  const host = input.host ?? env.MUKHTABIR_MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST;
  const path = normalizePath(
    input.path ?? env.MUKHTABIR_MCP_HTTP_PATH ?? DEFAULT_HTTP_PATH,
  );
  const allowedHosts =
    input.allowedHosts ??
    parseCommaSeparatedList(env.MUKHTABIR_MCP_HTTP_ALLOWED_HOSTS);
  const allowedBaseUrls = normalizeConfiguredBaseUrlList(
    input.allowedBaseUrls ??
      parseCommaSeparatedList(env.MUKHTABIR_MCP_HTTP_ALLOWED_BASE_URLS),
  );
  const tenantsFromEnv = parseTenantsJson(env.MUKHTABIR_MCP_TENANTS_JSON);
  const tenantsFromInput = input.tenants ?? [];

  const singleBearerToken =
    input.bearerToken ?? env.MUKHTABIR_MCP_HTTP_BEARER_TOKEN;
  const singleApiKey = input.apiKey ?? env.MUKHTABIR_API_KEY;
  const singleBaseUrl = input.baseUrl ?? env.MUKHTABIR_BASE_URL;
  const singleTenant =
    singleBearerToken && singleApiKey
      ? [
          {
            tenantId: DEFAULT_TENANT_ID,
            bearerToken: singleBearerToken,
            apiKey: singleApiKey,
            baseUrl: singleBaseUrl,
            clientId:
              input.clientId?.trim() ||
              env.MUKHTABIR_MCP_HTTP_CLIENT_ID?.trim() ||
              DEFAULT_CLIENT_ID,
            scopes:
              input.scopes ??
              parseCommaSeparatedList(env.MUKHTABIR_MCP_HTTP_SCOPES) ??
              [],
            status: ACTIVE_TENANT_STATUS,
          } satisfies MukhtabirMcpHttpTenantInput,
        ]
      : [];
  const allowDeferredApiKey = Boolean(input.secretResolver);

  const tenants = [...singleTenant, ...tenantsFromEnv, ...tenantsFromInput].map(
    (tenant, index) =>
      normalizeTenant(tenant, index, allowDeferredApiKey, allowedBaseUrls),
  );

  if (tenants.length === 0 && !input.tenantResolver) {
    throw new ConfigurationError(
      "Missing MCP HTTP credentials. Set MUKHTABIR_MCP_HTTP_BEARER_TOKEN with MUKHTABIR_API_KEY, provide MUKHTABIR_MCP_TENANTS_JSON, or pass a tenantResolver.",
    );
  }

  ensureUniqueTenants(tenants);

  return {
    host,
    port: parsePort(input.port ?? env.MUKHTABIR_MCP_HTTP_PORT),
    path,
    allowedHosts,
    allowedBaseUrls,
    sessionTtlMs: parsePositiveInteger(
      input.sessionTtlMs ?? env.MUKHTABIR_MCP_HTTP_SESSION_TTL_MS,
      DEFAULT_HTTP_SESSION_TTL_MS,
      "MCP HTTP session TTL",
      "MUKHTABIR_MCP_HTTP_SESSION_TTL_MS",
    ),
    sessionAbsoluteTtlMs: parsePositiveInteger(
      input.sessionAbsoluteTtlMs ??
        env.MUKHTABIR_MCP_HTTP_SESSION_ABSOLUTE_TTL_MS,
      DEFAULT_HTTP_SESSION_ABSOLUTE_TTL_MS,
      "MCP HTTP session absolute TTL",
      "MUKHTABIR_MCP_HTTP_SESSION_ABSOLUTE_TTL_MS",
    ),
    maxSessions: parsePositiveInteger(
      input.maxSessions ?? env.MUKHTABIR_MCP_HTTP_MAX_SESSIONS,
      DEFAULT_HTTP_MAX_SESSIONS,
      "MCP HTTP max sessions",
      "MUKHTABIR_MCP_HTTP_MAX_SESSIONS",
    ),
    rateLimit: parseRateLimitConfig(input.rateLimit, env),
    rateLimiter: input.rateLimiter,
    tenantResolver: input.tenantResolver,
    secretResolver: input.secretResolver,
    auditLogger: input.auditLogger,
    tenants,
  };
}

export function findMukhtabirMcpHttpTenant(
  config: MukhtabirMcpHttpConfig,
  bearerToken: string,
) {
  return config.tenants.find((tenant) => tenant.bearerToken === bearerToken);
}

async function hydrateMukhtabirMcpHttpTenant(
  config: MukhtabirMcpHttpConfig,
  tenant: MukhtabirMcpHttpTenantDefinition,
  sourceLabel: string,
): Promise<MukhtabirMcpHttpTenant> {
  if (tenant.apiKey) {
    return {
      ...tenant,
      apiKey: tenant.apiKey,
    };
  }

  if (!tenant.secretRef) {
    throw new ConfigurationError(
      `${sourceLabel} is missing a Mukhtabir API key or secret reference.`,
    );
  }

  if (!config.secretResolver) {
    throw new ConfigurationError(
      `${sourceLabel} requires a secretResolver before using secretRef without an inline Mukhtabir API key.`,
    );
  }

  const resolvedSecret = await config.secretResolver({
    tenantId: tenant.tenantId,
    bearerToken: tenant.bearerToken,
    clientId: tenant.clientId,
    baseUrl: tenant.baseUrl,
    scopes: tenant.scopes,
    status: tenant.status,
    secretRef: tenant.secretRef,
    secretVersion: tenant.secretVersion,
  });
  const secret =
    typeof resolvedSecret === "string"
      ? {
          apiKey: resolvedSecret,
        }
      : resolvedSecret;
  const apiKey = secret.apiKey.trim();

  if (!apiKey) {
    throw new ConfigurationError(
      `${sourceLabel} secretResolver returned an empty Mukhtabir API key.`,
    );
  }

  return {
    ...tenant,
    apiKey,
    secretVersion: secret.secretVersion?.trim() || tenant.secretVersion,
  };
}

export async function resolveMukhtabirMcpHttpTenant(
  config: MukhtabirMcpHttpConfig,
  bearerToken: string,
) {
  let tenant: MukhtabirMcpHttpTenantDefinition | undefined;
  let sourceLabel = "Resolved tenant";

  if (config.tenantResolver) {
    const resolved = await config.tenantResolver({ bearerToken });

    if (resolved) {
      tenant = normalizeResolvedMukhtabirMcpHttpTenant(resolved, bearerToken, {
        allowedBaseUrls: config.allowedBaseUrls,
        allowDeferredApiKey: Boolean(config.secretResolver),
      });
    }
  }

  if (!tenant) {
    tenant = findMukhtabirMcpHttpTenant(config, bearerToken);
    sourceLabel = tenant?.tenantId
      ? `Tenant ${tenant.tenantId}`
      : "Resolved tenant";
  }

  if (!tenant) {
    return undefined;
  }

  return hydrateMukhtabirMcpHttpTenant(config, tenant, sourceLabel);
}
