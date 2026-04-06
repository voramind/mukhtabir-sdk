# Historical Note: MCP Interview Content Mutation APIs

Status: completed. This note is retained as a historical implementation record and is no longer an active plan.

## Summary

The work described here has been implemented in this repo.

- `mcp/` now exposes nested question, subquestion, and evaluation-criteria mutation tools.
- `get_interview` now exposes stable nested IDs plus read-side `orderIndex` metadata, so nested updates and deletes are discoverable from the read surface.
- The MCP server currently exposes the 31-tool surface documented in `mcp/README.md`.
- Read payloads use camelCase `orderIndex`, while mutation inputs still use snake_case `order_index`.

## Historical Goal

The original goal of this work was to add `mcp/` support for the interview-content mutation APIs exposed by the reference backend at `/Users/yinyang/Mukhtabir-interview-agent`, without widening unrelated backend-only request fields.

## Historical Backend APIs Reflected

The implemented MCP surface reflects these backend routes:

| Backend route | Operation | MCP tool |
| --- | --- | --- |
| `POST /interviews/{id}/questions` | add question | `add_interview_question` |
| `PATCH /interviews/{id}/questions/{question_id}` | update question | `update_interview_question` |
| `DELETE /interviews/{id}/questions/{question_id}` | delete question | `delete_interview_question` |
| `POST /interviews/{id}/questions/{question_id}/subquestions` | add subquestion | `add_interview_subquestion` |
| `PATCH /interviews/{id}/questions/{question_id}/subquestions/{subquestion_id}` | update subquestion | `update_interview_subquestion` |
| `DELETE /interviews/{id}/questions/{question_id}/subquestions/{subquestion_id}` | delete subquestion | `delete_interview_subquestion` |
| `POST /interviews/{id}/criteria` | add evaluation criteria | `add_interview_criteria` |
| `PATCH /interviews/{id}/criteria/{criteria_id}` | update evaluation criteria | `update_interview_criteria` |
| `DELETE /interviews/{id}/criteria/{criteria_id}` | delete evaluation criteria | `delete_interview_criteria` |

## Historical Gap Before Implementation

Before this work landed:

- `mcp/src/interviews/tools.ts` only exposed top-level interview CRUD, publish, invite, results, and analytics.
- `mcp/src/adapter/mukhtabir.ts` depended on TypeScript SDK methods that did not yet cover these nested routes.
- `mcp/src/schemas.ts` did not yet define input shapes for question, subquestion, or criteria mutations.
- `mcp/test/mock-api.ts` and `mcp/test/server.test.ts` did not yet model or verify the richer read contract.
- `mcp/README.md` still described the older, smaller interview tool surface.

These gaps are now resolved.

## Historical Constraint That Is Now Resolved

Earlier in the work, nested content was only partially discoverable because the public interview detail payload did not clearly expose stable nested identifiers.

That constraint is now resolved. `GET /interviews/{id}` returns:

- question `id`, `disabled`, and `orderIndex`
- subquestion `id`, `disabled`, and `orderIndex`
- evaluation-criteria `id`, `disabled`, and `orderIndex`

MCP callers can now discover nested items from `get_interview` and use those IDs with the nested update and delete tools.

## Implemented Changes

The completed implementation included:

1. Confirming the nested interview-content routes as part of the supported public SDK/MCP contract.
2. Extending the TypeScript SDK interview resource and types with the nine endpoint-specific nested mutation methods and response types.
3. Extending `mcp/src/adapter/mukhtabir.ts` so MCP delegates to those SDK methods.
4. Adding the nested mutation schemas to `mcp/src/schemas.ts`.
5. Registering the nine nested interview-content tools in `mcp/src/interviews/tools.ts`.
6. Updating mock fixtures and tests to cover both nested mutation flows and richer interview read payloads.
7. Updating MCP documentation to reflect the expanded tool surface and nested discoverability.

## Validation Completed

The work was validated through updates to:

- TypeScript SDK tests for request typing, nested read models, and transport path generation
- MCP adapter, schema, mock API, and stdio server tests
- MCP documentation describing the current 31-tool surface

## Scope Boundary

Included in this completed work:

- nested question APIs
- nested subquestion APIs
- nested evaluation-criteria APIs
- only the TypeScript SDK work needed for MCP to call those routes

Left out of this work:

- widening existing interview create/update request surfaces to all backend-only fields
- synthetic nested MCP resources
- prompt additions beyond the existing interview workflows

## Optional Adjacent Scope

This note does not claim that every adjacent read-side field from backend docs has been modeled. In particular, scoring-guide `id` and `orderIndex` remain separate optional follow-up scope rather than part of the completed MCP parity work recorded here.
