# Mukhtabir MCP Server

TypeScript MCP server for Mukhtabir. It exposes Mukhtabir interviews, candidates, feedback, and webhooks through MCP tools, resources, and prompts.

## Install

Install globally:

```bash
npm install -g @voramind/mukhtabir-mcp
```

```bash
pnpm add -g @voramind/mukhtabir-mcp
```

Or run it without a global install:

```bash
npx @voramind/mukhtabir-mcp
```

```bash
yarn dlx @voramind/mukhtabir-mcp
```

```bash
pnpm dlx @voramind/mukhtabir-mcp
```

The HTTP transport is intended for operator-managed, self-hosted deployments. This package now ships programmatic helpers for control-plane tenant lookup, secret-reference resolution, external rate limiting, HTTP audit sinks, and immediate tenant-control events, but operators still need to provide the backing services before exposing it to shared internet-facing traffic.

## What It Provides

- `stdio` transport for local MCP clients
- Streamable HTTP transport for operator-managed, self-hosted MCP clients
- tools for interview, candidate, feedback, and webhook operations
- read-only resources for fuller payloads such as interview results, analytics, transcripts, and webhook deliveries
- workflow prompts for common Mukhtabir tasks
- HTTP Bearer auth with optional tenant scoping for self-hosted deployments
- optional programmatic helpers for HTTP-backed tenant resolution, secret resolution, external rate limiting, and audit sinks
- immediate tenant session eviction through `handleTenantControlEvent()` and `closeTenantSessions()`
- redaction of invitation URL secrets and webhook signing secrets in MCP output

## Requirements

- Node.js `>=18`
- `MUKHTABIR_API_KEY`
- optional `MUKHTABIR_BASE_URL` for non-default API endpoints

## Quick Start

Run the published CLI over `stdio`:

```bash
MUKHTABIR_API_KEY=... mukhtabir-mcp
```

Or without a global install:

```bash
MUKHTABIR_API_KEY=... npx @voramind/mukhtabir-mcp
```

For local development from this repository:

```bash
cd mcp
npm install
MUKHTABIR_API_KEY=... npx tsx src/cli.ts
```

The CLI defaults to `stdio`. To build the package:

```bash
cd mcp
npm run build
```

## Connect from Claude and Codex

If you installed the package globally, point clients at the published CLI binary:

```bash
npm install -g @voramind/mukhtabir-mcp
```

For local development from this repository, build once and point the client at the compiled CLI entrypoint:

```bash
cd /path/to/mukhtabir-sdk/mcp
npm install
npm run build
```

The examples below assume `MUKHTABIR_API_KEY` is already available in your environment. If you use a non-default API endpoint, pass `MUKHTABIR_BASE_URL` the same way.

### Codex

Add the installed `stdio` server:

```bash
codex mcp add mukhtabir \
  --env MUKHTABIR_API_KEY="$MUKHTABIR_API_KEY" \
  -- mukhtabir-mcp

codex mcp list
```

Or add the local built server from a checkout:

```bash
codex mcp add mukhtabir \
  --env MUKHTABIR_API_KEY="$MUKHTABIR_API_KEY" \
  -- node /path/to/mukhtabir-sdk/mcp/dist/cli.js

codex mcp list
```

If you are running the HTTP transport from the next section, add that instead:

```bash
codex mcp add mukhtabir-http \
  --url http://127.0.0.1:3000/mcp \
  --bearer-token-env-var MUKHTABIR_MCP_HTTP_BEARER_TOKEN
```

### Claude Code

Add the installed `stdio` server:

```bash
claude mcp add --transport stdio --scope project \
  -e MUKHTABIR_API_KEY="$MUKHTABIR_API_KEY" \
  mukhtabir -- \
  mukhtabir-mcp

claude mcp get mukhtabir
```

Project-scoped `.mcp.json` equivalent for an installed package:

```json
{
  "mcpServers": {
    "mukhtabir": {
      "type": "stdio",
      "command": "mukhtabir-mcp",
      "env": {
        "MUKHTABIR_API_KEY": "${MUKHTABIR_API_KEY}"
      }
    }
  }
}
```

Or add the local built `stdio` server from a checkout:

```bash
claude mcp add --transport stdio --scope project \
  -e MUKHTABIR_API_KEY="$MUKHTABIR_API_KEY" \
  mukhtabir -- \
  node /path/to/mukhtabir-sdk/mcp/dist/cli.js

claude mcp get mukhtabir
```

Project-scoped `.mcp.json` equivalent for a checkout:

```json
{
  "mcpServers": {
    "mukhtabir": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mukhtabir-sdk/mcp/dist/cli.js"],
      "env": {
        "MUKHTABIR_API_KEY": "${MUKHTABIR_API_KEY}"
      }
    }
  }
}
```

If you are using the HTTP transport, Claude Code can connect with:

```bash
claude mcp add --transport http \
  -H "Authorization: Bearer $MUKHTABIR_MCP_HTTP_BEARER_TOKEN" \
  mukhtabir-http http://127.0.0.1:3000/mcp
```

### Claude Desktop

For an installed `stdio` server, add an entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mukhtabir": {
      "type": "stdio",
      "command": "mukhtabir-mcp",
      "env": {
        "MUKHTABIR_API_KEY": "..."
      }
    }
  }
}
```

For a local checkout, add the compiled CLI entrypoint instead:

```json
{
  "mcpServers": {
    "mukhtabir": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mukhtabir-sdk/mcp/dist/cli.js"],
      "env": {
        "MUKHTABIR_API_KEY": "..."
      }
    }
  }
}
```

If you keep secrets in the repository root `.env`, a shell wrapper keeps them out of the Claude Desktop config:

```json
{
  "mcpServers": {
    "mukhtabir": {
      "type": "stdio",
      "command": "/bin/zsh",
      "args": [
        "-lc",
        "cd /absolute/path/to/mukhtabir-sdk && set -a && source ./.env && set +a && exec node ./mcp/dist/cli.js"
      ],
      "env": {}
    }
  }
}
```

Claude Desktop does not use `claude_desktop_config.json` for remote MCP servers. If you expose the HTTP transport, add it from Claude via `Settings > Connectors` instead.

If a GUI client cannot find `node`, replace `node` with the absolute path returned by `which node`.

## HTTP Transport

Start the server in HTTP mode with `--http`, `http`, or `--transport=http`.

Single-tenant example:

```bash
cd mcp
MUKHTABIR_MCP_TRANSPORT=http \
MUKHTABIR_MCP_HTTP_BEARER_TOKEN=... \
MUKHTABIR_API_KEY=... \
npx tsx src/cli.ts
```

For local development, you can also use the packaged helper:

```bash
cd /path/to/mukhtabir-sdk/mcp
npm install
npm run build
npm run start:http
```

`npm run start:http` sources the repository root `.env`, resolves the effective
`MUKHTABIR_BASE_URL` before launch, and refuses to start if the chosen HTTP
port is already occupied by another process. That makes it safer to switch
between a local Mukhtabir backend and the default hosted API without
accidentally reusing a stale MCP listener on the same port.

Multi-tenant example:

Bootstrap example for trusted operator-managed runtimes only, not a shared SaaS control plane:

```bash
cd mcp
MUKHTABIR_MCP_TRANSPORT=http \
MUKHTABIR_MCP_TENANTS_JSON='{
  "acme": {
    "bearerToken": "token-acme",
    "apiKey": "mk_live_acme",
    "scopes": ["read", "write"]
  },
  "ops": {
    "bearerToken": "token-ops",
    "apiKey": "mk_live_ops",
    "scopes": ["read"]
  }
}' \
npx tsx src/cli.ts
```

HTTP settings:

- `MUKHTABIR_MCP_HTTP_HOST` default `127.0.0.1`
- `MUKHTABIR_MCP_HTTP_PORT` default `3000`
- `MUKHTABIR_MCP_HTTP_PATH` default `/mcp`
- `MUKHTABIR_MCP_HTTP_ALLOWED_HOSTS` optional comma-separated host allowlist
- `MUKHTABIR_MCP_HTTP_ALLOWED_BASE_URLS` optional comma-separated allowlist for upstream Mukhtabir base URLs
- `MUKHTABIR_MCP_HTTP_CLIENT_ID` default `mukhtabir-mcp` in single-tenant mode
- `MUKHTABIR_MCP_HTTP_SCOPES` optional comma-separated scopes in single-tenant mode
- `MUKHTABIR_MCP_HTTP_SESSION_TTL_MS` default `900000`
- `MUKHTABIR_MCP_HTTP_SESSION_ABSOLUTE_TTL_MS` default `28800000`
- `MUKHTABIR_MCP_HTTP_MAX_SESSIONS` default `100`
- `MUKHTABIR_MCP_HTTP_RATE_LIMIT_WINDOW_MS` default `60000`
- `MUKHTABIR_MCP_HTTP_RATE_LIMIT_MAX_REQUESTS` default `300`
- `MUKHTABIR_MCP_HTTP_RATE_LIMIT_MAX_INITIALIZE_REQUESTS` default `30`

HTTP mode is intended for operator-managed deployments. If you need shared-hosting behavior, use the programmatic `tenantResolver` and `secretResolver` hooks, or the bundled `createHttpTenantResolver()` and `createHttpSecretResolver()` helpers, point `createHttpRateLimiter()` at your abuse-detection service, send security events to `createHttpAuditLogger()`, and wire control-plane revocation or rotation events into `handleTenantControlEvent()` before exposing the server to arbitrary customers.

The current single-tenant and `MUKHTABIR_MCP_TENANTS_JSON` examples are bootstrap mechanisms for trusted runtime injection. They are not a shared SaaS control plane.

Tenant scopes are hierarchical:

- `read` enables read-only tools, resources, and prompts
- `write` adds create, update, publish, invite, and test operations
- `delete` adds destructive delete operations
- `admin`, `full`, or `*` restore unrestricted access

If you are building a shared-hosting control plane, keep bearer tokens as caller identity only and resolve them to tenant metadata plus secret references outside the model context with a `tenantResolver`, `secretResolver`, or the bundled HTTP helpers above.

## MCP Surface

The server currently exposes 31 tools.

Tools:

- Interviews: `create_interview`, `list_interviews`, `get_interview`, `update_interview`, `publish_interview`, `delete_interview`, `invite_candidate_to_interview`, `add_interview_question`, `update_interview_question`, `delete_interview_question`, `add_interview_subquestion`, `update_interview_subquestion`, `delete_interview_subquestion`, `add_interview_criteria`, `update_interview_criteria`, `delete_interview_criteria`, `list_interview_results`, `get_interview_analytics`
- Candidates: `register_candidate`, `list_candidates`, `get_candidate`
- Feedback: `get_feedback`, `get_feedback_transcript`, `get_feedback_recording_url`
- Webhooks: `create_webhook`, `list_webhooks`, `get_webhook`, `update_webhook`, `delete_webhook`, `test_webhook`, `list_webhook_deliveries`

Resources:

- Interviews: `mukhtabir://interviews/{id}`, `mukhtabir://interviews/{id}/analytics`, `mukhtabir://interviews/{id}/results{?page,page_size}`
- Candidates: `mukhtabir://candidates/{email}`
- Feedback: `mukhtabir://feedback/{id}`, `mukhtabir://feedback/{id}/transcript`, `mukhtabir://feedback/{id}/recording-url`
- Webhooks: `mukhtabir://webhooks/{id}`, `mukhtabir://webhooks/{id}/deliveries{?page,page_size}`

Prompts:

- `create_interview_workflow`
- `invite_candidate_workflow`
- `candidate_evaluation_summary`
- `interview_analytics_report`
- `webhook_delivery_triage`

## Notes

- `delete_*` tools are destructive and should only be used when explicitly requested.
- Nested interview-content update and delete operations are now discoverable from the `get_interview` payload because the backend returns stable nested question, subquestion, and criteria IDs plus read-side ordering metadata. Read payloads use camelCase `orderIndex`, while mutation inputs still use snake_case `order_index`.
- For local development and validation details, see [`../doc/mcp-server-validation.md`](../doc/mcp-server-validation.md).
- For HTTP deployment and secret-handling guidance, see [`../doc/mcp-server-remote-security.md`](../doc/mcp-server-remote-security.md).
