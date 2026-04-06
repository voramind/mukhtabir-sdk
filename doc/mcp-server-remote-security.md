# MCP Remote Security and Secret Strategy

## Scope

This document defines the multi-tenant secret strategy and shared-hosting security posture for the Mukhtabir MCP HTTP server.

It applies to the Streamable HTTP transport in `mcp/`.

## Current Posture

What is implemented today:

- transport-level Bearer authentication for HTTP clients
- static tenant-to-credential mapping from environment variables or process input
- optional programmatic `tenantResolver` integration for control-plane-backed tenant resolution, plus a bundled `createHttpTenantResolver` helper
- optional programmatic `secretResolver` integration for secret-reference-backed API key resolution, plus a bundled `createHttpSecretResolver` helper
- per-session tenant binding so a session cannot be reused across tenants
- hierarchical tenant scope enforcement for tools, resources, and workflow prompts
- host binding with an optional host allowlist through the MCP Express app
- optional upstream Mukhtabir base-URL allowlisting
- invitation URL and webhook-secret sanitization before data enters MCP tool output
- idle session TTLs, absolute session TTLs, and an active-session cap for the in-memory HTTP session map
- built-in authenticated request rate limiting for initialize and follow-up traffic, plus optional external rate limiting through a bundled `createHttpRateLimiter` helper
- server-side log redaction for common secret-bearing fields
- bundled stderr and HTTP audit sinks for auth failures, session lifecycle, and destructive tool calls
- immediate tenant session eviction through `handleTenantControlEvent` and `closeTenantSessions`

Known gaps in the current implementation:

- static environment/process tenant mappings are still a bootstrap mechanism rather than a shared-hosting control plane
- the repository still does not ship a hosted control plane, managed secret store, abuse-detection service, or security-event backend; operators must provide those services and wire the bundled helpers or custom hooks to them
- the bootstrap defaults are still the in-memory limiter and structured stderr audit sink unless the operator opts into external services
- TLS termination, bearer issuance, and operational rotation or suspension workflows remain deployment responsibilities

These gaps remain part of the current shared-hosting risk posture and should be tracked alongside future control-plane work.

What the current implementation is suitable for:

- local development
- self-hosted single-tenant deployments
- tightly controlled self-hosted HTTP deployments where the operator owns the runtime, trusts the MCP clients, and injects tenant secrets directly

What it is not approved for by default:

- shared internet-facing hosting where arbitrary customers onboard themselves
- deployments that need runtime secret rotation, revocation, or delegated tenant provisioning

The current `MUKHTABIR_MCP_TENANTS_JSON` and single-tenant environment variables are bootstrap mechanisms, not the long-term shared-hosting secret strategy.

## Multi-Tenant Secret Strategy

### Design Goals

- Bearer tokens identify the MCP caller, not the Mukhtabir API secret itself.
- Mukhtabir API keys stay outside model context, tool outputs, logs, and source control.
- Tenant credentials can be rotated or revoked without changing tool code.
- Each tenant is isolated to its own Mukhtabir credential set, base URL policy, client ID, and enforceable authorization policy.

### Recommended Model

For shared hosting, use a control plane plus secret manager. This repository provides `tenantResolver` and `secretResolver` hooks for that model, along with bundled HTTP helpers for both, but operators still need to supply the backing services.

1. the HTTP Bearer token resolves to a `tenantId`
2. `tenantId` resolves through a `tenantResolver` hook to non-secret metadata plus a secret reference
3. the server loads the Mukhtabir API key from a secret manager using that reference through `secretResolver`
4. the API key is held only in process memory for a bounded session lifecycle
5. tools and resources are exposed only after server-side authorization checks for the tenant's allowed capabilities
6. the deployment enforces a dedicated audit sink, request rate limits, and an allowlist of approved upstream Mukhtabir base URLs

Recommended tenant record shape in the control plane:

- `tenantId`
- `clientId`
- `allowedScopes` or equivalent capability set that the server enforces
- `allowedBaseUrls` or an approved Mukhtabir environment identifier
- `secretRef` for the Mukhtabir API key
- `status` such as `active`, `suspended`, or `revoked`
- optional `bearerTokenRef` or external auth subject mapping

### Secret Storage Requirements

- Store Mukhtabir API keys in a managed secret store.
- Do not place raw API keys in `mcp.json`, repository files, or long-lived plaintext env files.
- If env vars are used in development, treat them as local-only and short-lived.
- Never emit raw Mukhtabir API keys, transport bearer tokens, invitation URLs or tokens, webhook signing secrets, or other created credentials in logs, tool output, resources, traces, or analytics.
- Sanitize upstream responses before they enter MCP results. Return opaque identifiers or redacted previews instead of live credentials.
- If the deployment exposes a dedicated audit sink, apply the same secret-handling rules there and include only redacted tenant IDs, session IDs, and request metadata.

### Rotation and Revocation

Required rotation flow for control-plane-backed hosting:

1. write a new Mukhtabir API key version in the secret manager
2. update the tenant metadata to point at the new secret version
3. expire any secret or tenant-metadata cache so new sessions resolve the new version
4. if the deployment only loads tenant config at startup, restart or reload the MCP server before accepting more sessions
5. revoke the previous secret version after cutover
6. invalidate any tenant- or secret-version-scoped caches and update the audit trail

Required revocation flow:

1. disable the tenant or bearer token mapping
2. reject new sessions immediately
3. terminate active sessions and clear cached credentials for that tenant if compromise is suspected
4. revoke the Mukhtabir API key in the upstream system if needed
5. if the deployment uses a tenant resolver, remove or disable the mapping there as well

### Session Handling

- Resolve the tenant before creating the MCP server session.
- Bind the resolved tenant to the session ID and reject later requests that present a different tenant.
- Enforce an idle timeout, an absolute TTL, and a cap on active sessions.
- Rate-limit initialize and follow-up traffic per tenant or bearer token.
- Avoid cross-tenant caches unless the cache key includes tenant identity and secret version.
- Do not permit caller-supplied arbitrary base URLs in shared hosting.
- Close active sessions early when a tenant is suspended or its credential is revoked, either through `handleTenantControlEvent` or `closeTenantSessions`.

## Shared-Hosting Security Review

### Threats Reviewed

- tenant confusion or session mix-up
- bearer token theft or replay
- Mukhtabir API key leakage through logs or tool/resource responses
- exposure of invitation URLs, one-time tokens, or webhook signing secrets through MCP transcripts
- DNS rebinding or hostile host-header access to a localhost deployment
- over-broad network egress if callers can influence upstream destinations
- session exhaustion from unbounded initialize requests
- abusive traffic causing rate-limit amplification against Mukhtabir

### Current Controls

- tenant lookup is keyed by Bearer token using static configured mappings
- control-plane-backed tenant lookup can be delegated to `tenantResolver` or the bundled `createHttpTenantResolver` helper
- secret-reference-backed API key lookup can be delegated to `secretResolver` or the bundled `createHttpSecretResolver` helper
- session reuse across tenants is rejected
- configured `read`/`write`/`delete` scopes gate tools, resources, and workflow prompts
- host binding defaults to `127.0.0.1`
- optional host allowlisting is supported
- invitation URLs are stripped of query/hash secret material before returning MCP results
- webhook creation redacts the one-time signing secret from MCP output
- sessions expire after idle and absolute TTLs and cannot exceed a configured active-session cap
- authenticated request limits can be enforced by the built-in limiter or delegated to an external service through `createHttpRateLimiter`
- server logging redacts common secret-bearing fields
- audit events can be sent to bundled stderr or HTTP sinks, including `createHttpAuditLogger`
- tenant suspension, revocation, and rotation events can close active sessions immediately through `handleTenantControlEvent`
- operator-managed deployments can layer upstream base-URL allowlists and external hosting controls on top of this baseline

### Controls Required Before Shared Internet Hosting

- TLS termination in front of the HTTP server
- external authentication or signed bearer issuance with expiry and rotation
- control-plane-backed tenant resolution and secret-manager-backed API key lookup through `tenantResolver` and `secretResolver`, or the bundled HTTP helpers for those integrations, instead of static plaintext mappings
- authenticated request rate limits and abuse detection beyond the active-session cap, such as an external service behind `createHttpRateLimiter`
- audit logging to a dedicated security event sink for tenant auth failures, session creation and closure, and destructive tool calls, such as a backend behind `createHttpAuditLogger`
- explicit allowlist of upstream Mukhtabir base URLs
- operational runbook for tenant suspension and secret rotation, with control-plane events wired into `handleTenantControlEvent`

### Deployment Decision

Current recommendation:

- ship `stdio` now
- ship self-hosted HTTP for operator-managed clients with the current limitations documented
- keep shared remote hosting behind an explicit operator review and the remaining shared-hosting controls above
- treat shared internet-facing hosting as a separate deployment posture, not the default HTTP mode

Shared hosting is acceptable only after the required controls above are in place. Until then, the repository should describe HTTP multi-tenancy as operator-managed, self-hosted credential mapping with enforced scopes, bounded sessions, and explicit upstream controls, not as a complete shared SaaS posture.
