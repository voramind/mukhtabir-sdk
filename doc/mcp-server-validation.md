# MCP Server Validation

## Latest Validation

Validated on 2026-03-17 in `/Users/yinyang/Desktop/mukhtabir-sdk/mcp`.

Automated checks run:

- `npm run typecheck`
- `npm test`
- `npm run build`

Automated client smoke coverage now includes:

- `test/adapter.test.ts` for transport-independent adapter delegation
- `test/errors.test.ts` for MCP-safe tool and resource error mapping
- `test/server.test.ts` for the local `stdio` server using `StdioClientTransport`
- `test/http.test.ts` for the Streamable HTTP server using `StreamableHTTPClientTransport`
- `test/config.test.ts` for missing credential and tenant config cases
- `test/schemas.test.ts` for docs-first schema enforcement
- `test/utils.test.ts` for resource pagination parsing and logging redaction

Covered scenarios:

- full tool, prompt, and resource-template registration
- workflow prompt retrieval with structured prompt content
- interview create, publish, and invite happy path
- interview-content mutations for add/update/delete question, subquestion, and criteria
- interview-content mutation outputs exposing returned nested IDs for follow-up edits
- interview list/detail, analytics, update, delete, and resource reads
- candidate list/detail tool coverage and candidate resource reads
- feedback detail and recording URL tool/resource reads
- candidate invitation token and URL redaction
- transcript tool and resource reads
- compact preview shaping for interview results and webhook deliveries
- paginated interview-results and webhook-deliveries resource reads
- webhook creation secret redaction, list/get/update/delete, test delivery, and delivery inspection
- MCP-safe tool errors for `404`
- MCP-safe resource errors for `404`
- MCP-safe resource errors preserving `details` and `Retry-After`
- rate-limit mapping with `Retry-After`
- invalid tool input validation
- adapter delegation
- docs-first schema rejection for backend-only variants
- HTTP transport auth and session initialization
- HTTP host allowlist enforcement
- HTTP cross-tenant session rejection
- HTTP read-only tenant scope filtering for tools and prompts
- HTTP idle session expiration
- HTTP active-session cap enforcement
- log redaction for secret-bearing MCP payload fields

## Manual Validation

### MCP Inspector CLI

Validated on 2026-03-17 against the local `stdio` server backed by `test/mock-api.ts`.

Commands used:

```bash
cd /Users/yinyang/Desktop/mukhtabir-sdk/mcp
npx tsx --eval 'import { createMockMukhtabirApi } from "./test/mock-api.ts"; const server = createMockMukhtabirApi(); server.listen(39123, "127.0.0.1", () => console.log("MOCK_API_READY http://127.0.0.1:39123"));'

npx -y @modelcontextprotocol/inspector --cli \
  -e MUKHTABIR_API_KEY=mk_test_123 \
  -e MUKHTABIR_BASE_URL=http://127.0.0.1:39123 \
  node /Users/yinyang/Desktop/mukhtabir-sdk/mcp/node_modules/tsx/dist/cli.mjs \
  /Users/yinyang/Desktop/mukhtabir-sdk/mcp/src/cli.ts \
  --method tools/list
```

Observed results:

- `tools/list` returned all 31 planned tools
- `prompts/list` returned all 5 workflow prompts
- `resources/templates/list` returned all 9 resource templates
- `tools/call` for `get_feedback_transcript` returned a `resource_link` to `mukhtabir://feedback/fb_123/transcript`
- `resources/read` for `mukhtabir://feedback/fb_123/transcript` returned the full transcript body

### Real MCP Client

Validated on 2026-03-14 with the installed Codex CLI as a non-SDK MCP client.

Commands used:

```bash
cd /Users/yinyang/Desktop/mukhtabir-sdk
codex mcp add mukhtabir-validation \
  --env MUKHTABIR_API_KEY=mk_test_123 \
  --env MUKHTABIR_BASE_URL=http://127.0.0.1:39123 \
  -- node /Users/yinyang/Desktop/mukhtabir-sdk/mcp/node_modules/tsx/dist/cli.mjs \
  /Users/yinyang/Desktop/mukhtabir-sdk/mcp/src/cli.ts

printf '%s\n' 'Use the mukhtabir-validation MCP server to call get_feedback_transcript with id fb_123. Reply with exactly two lines: resource_link=<true|false> and transcript_truncated=<true|false>.' \
  | codex exec -s read-only --skip-git-repo-check --ephemeral -

codex mcp remove mukhtabir-validation
```

Observed results:

- Codex successfully called `mukhtabir-validation.get_feedback_transcript({"id":"fb_123"})`
- the tool response included a `resource_link`
- `transcript_truncated` was `false`
- Codex printed local state-db warnings during startup, but the MCP call itself succeeded and returned the expected structured content

### Local Live Stack with Codex CLI

Validated on 2026-04-03 against the sibling local Rust API in
`/Users/yinyang/Desktop/mukhtabir-rpc` and the built MCP HTTP transport in
`/Users/yinyang/Desktop/mukhtabir-sdk/mcp`.

Session evidence for this path:

- `docker compose up --build` in the sibling `mukhtabir-rpc` repo starts PostgreSQL and the API,
  but it only loads the schema.
- the local stack is not usable until the database also contains an active organization, an
  admin-equivalent organization member, and an active `mk_...` API key with the needed scopes
- a `.pdf` filename alone is not enough for JD-driven authoring; validate that the artifact is an
  actual readable PDF before handing it to Codex

Recommended local validation flow:

```bash
# 1. Start the sibling local API stack.
cd /Users/yinyang/Desktop/mukhtabir-rpc
docker compose up --build -d
curl http://127.0.0.1:3000/healthz

# 2. Seed a local API key if the database only has schema data.
#    The Docker stack does not create organizations, memberships, or API keys for you.
docker exec -i mukhtabir-rpc-postgres psql -U mukhtabir_user -d mukhtabir_db <<'SQL'
WITH new_user AS (
  INSERT INTO users (uid, display_name, email)
  VALUES (
    'uid_local_mcp_validation',
    'Local MCP Validation Owner',
    'local-mcp-validation@example.com'
  )
  RETURNING id
), new_org AS (
  INSERT INTO organizations (name, slug, contact_email, is_active)
  VALUES (
    'Local MCP Validation Org',
    'local-mcp-validation',
    'local-mcp-validation@example.com',
    true
  )
  RETURNING id
), new_member AS (
  INSERT INTO organization_members (organization_id, user_id, role)
  SELECT new_org.id, new_user.id, 'org_admin'
  FROM new_org, new_user
)
INSERT INTO api_keys (
  organization_id,
  created_by,
  name,
  key_prefix,
  key_hash,
  scopes,
  environment,
  is_revoked
)
SELECT
  new_org.id,
  new_user.id,
  'Local MCP Validation Key',
  'mk_test_demo',
  '<sha256-of-the-full-raw-key>',
  ARRAY[
    'interviews:read',
    'interviews:write',
    'interviews:delete',
    'candidates:read',
    'candidates:write',
    'feedback:read',
    'webhooks:manage',
    'analytics:read',
    'questions:write',
    'criteria:write'
  ],
  'test',
  false
FROM new_org, new_user;
SQL

# 3. Build the MCP package.
cd /Users/yinyang/Desktop/mukhtabir-sdk/mcp
npm install
npm run build

# 4. Start the MCP server in local HTTP mode.
cd /Users/yinyang/Desktop/mukhtabir-sdk
export MUKHTABIR_API_KEY=mk_test_your_raw_key_here
export MUKHTABIR_BASE_URL=http://127.0.0.1:3000/api/v1
export MUKHTABIR_MCP_TRANSPORT=http
export MUKHTABIR_MCP_HTTP_HOST=127.0.0.1
export MUKHTABIR_MCP_HTTP_PORT=3100
export MUKHTABIR_MCP_HTTP_PATH=/mcp
export MUKHTABIR_MCP_HTTP_BEARER_TOKEN=your-local-mcp-bearer-token
node ./mcp/dist/cli.js
```

In a second terminal, register the HTTP server in Codex CLI:

```bash
cd /Users/yinyang/Desktop/mukhtabir-sdk
codex mcp add mukhtabir-http-local \
  --url http://127.0.0.1:3100/mcp \
  --bearer-token-env-var MUKHTABIR_MCP_HTTP_BEARER_TOKEN

codex mcp list
```

Before asking Codex to author from a JD artifact, confirm the file is actually a PDF. A quick guard
is:

```bash
file /absolute/path/to/job-description.pdf
```

If the output is generic `data` instead of a PDF type, the file is likely unreadable by local PDF
tooling and Codex should be given a replacement source or an explicit fallback instruction.

Once the MCP server is registered, a representative end-to-end prompt is:

```bash
printf '%s\n' \
  'Use the mukhtabir-http-local MCP server to create one unpublished interview from /absolute/path/to/job-description.pdf, add at least 5 questions with follow-up subquestions, add at least 5 evaluation criteria, call get_interview to confirm the final structure, and return the created interview ID plus the question, subquestion, and criteria counts.' \
  | codex exec -C /Users/yinyang/Desktop/mukhtabir-sdk --dangerously-bypass-approvals-and-sandbox -
```

Verify the created interview independently through the Python SDK:

```bash
cd /Users/yinyang/Desktop/mukhtabir-sdk
python3 -m venv .venv
. .venv/bin/activate
pip install -e ./python

python - <<'PY'
from mukhtabir import MukhtabirClient

interview_id = "replace-with-created-id"

with MukhtabirClient(
    api_key="mk_test_your_raw_key_here",
    base_url="http://127.0.0.1:3000/api/v1",
) as client:
    detail = client.interviews.get(interview_id)
    interview = detail.data
    print("published=", interview.published)
    print("question_count=", len(interview.questions))
    print("subquestion_count=", sum(len(q.subquestions) for q in interview.questions))
    print("criteria_count=", len(interview.evaluation_criteria))
PY
```

Observed results from the 2026-04-03 live run:

- Codex registered the local HTTP MCP server and used it successfully through `codex exec`
- the created interview remained unpublished
- `get_interview` returned the expected nested question, subquestion, and criteria structure
- the Python SDK independently confirmed the same interview counts and nested content
