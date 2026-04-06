# Mukhtabir TypeScript SDK

Official TypeScript SDK for the Mukhtabir API.

## Install

```bash
npm install @mukhtabir/sdk
```

Node 18+ is required. In other runtimes, provide a compatible `fetch` implementation.

The snippets below use `logger` as a placeholder for your application's structured logger.

## Quick Start

```ts
import { Mukhtabir } from "@mukhtabir/sdk";

const client = new Mukhtabir({
  apiKey: process.env.MUKHTABIR_API_KEY!,
});

const created = await client.interviews.create({
  role: "Senior Software Engineer",
  type: "technical",
  level: "senior",
  duration: 30,
  techstack: ["TypeScript", "PostgreSQL"],
  visibility: "restricted",
});

await client.interviews.publish(created.data.interview_id);

const invite = await client.interviews.invite(created.data.interview_id, {
  email: "candidate@example.com",
  name: "Sarah Al-Rashid",
});

logger.info("Mukhtabir invite created", {
  interviewUrl: invite.data.interview_url,
});
```

## Client Options

- `apiKey` is required.
- `baseUrl` defaults to `https://mukhtabir.hbku.edu.qa/api/v1`.
- `timeoutMs` defaults to `30000`.
- `retry` defaults to 2 retries for `GET`, `HEAD`, and `OPTIONS` on transient failures.
- `headers` adds headers to every request.
- `fetch` lets you supply a custom fetch implementation.
- Non-HTTPS `baseUrl` values are rejected unless they target a loopback host or `allowInsecureBaseUrl: true` is set.

## Resources

| Resource | Methods |
| --- | --- |
| `client.interviews` | `create`, `list`, `listAll`, `get`, `update`, `delete`, `publish`, `invite`, `addQuestion`, `updateQuestion`, `deleteQuestion`, `addSubquestion`, `updateSubquestion`, `deleteSubquestion`, `addCriteria`, `updateCriteria`, `deleteCriteria`, `results`, `resultsAll`, `analytics` |
| `client.candidates` | `create`, `list`, `listAll`, `get` |
| `client.feedback` | `get`, `transcript`, `recordingUrl` |
| `client.webhooks` | `create`, `list`, `listAll`, `get`, `update`, `delete`, `test`, `deliveries`, `deliveriesAll` |

All request and response types are exported from `@mukhtabir/sdk`. If you want narrower imports, the package also exposes `@mukhtabir/sdk/core`, `@mukhtabir/sdk/resources`, `@mukhtabir/sdk/types`, and `@mukhtabir/sdk/webhooks`.

## Interview Content Mutations

Use interview-scoped content routes to add and mutate questions, subquestions, and criteria after interview creation.

```ts
const created = await client.interviews.create({ role: "Backend Engineer" });

const question = await client.interviews.addQuestion(created.data.interview_id, {
  question: "How do you design idempotent workers?",
  subquestions: ["How do you handle duplicate events?"],
  order_index: 0,
});

await client.interviews.updateQuestion(created.data.interview_id, question.data.question_id, {
  question: "How do you design resilient and idempotent workers?",
  order_index: 0,
});

await client.interviews.deleteQuestion(created.data.interview_id, question.data.question_id);
```

Use IDs returned from `addQuestion`, `addSubquestion`, and `addCriteria` for follow-up updates and deletions.
`client.interviews.get(...)` now returns stable nested question, subquestion, and criteria IDs along with read-side ordering metadata. Read payloads use camelCase `orderIndex`, while mutation inputs still use snake_case `order_index`.

## Responses and Pagination

Resource methods return Mukhtabir's API envelopes, including `meta.request_id`, `meta.timestamp`, and `pagination` for list endpoints.

```ts
const page = await client.interviews.list({ page: 1, page_size: 20 });
logger.info("Mukhtabir interview page loaded", {
  total: page.pagination.total,
});

for await (const candidate of client.candidates.listAll({ page_size: 100 })) {
  logger.info("Mukhtabir candidate loaded", { email: candidate.email });
}
```

If you need custom pagination flow, the package also exports `paginate`.

## Webhooks

Use the raw request body when verifying Mukhtabir webhooks.

```ts
import { parseWebhookEvent } from "@mukhtabir/sdk";

export async function POST(request: Request) {
  const body = await request.text();

  const webhook = await parseWebhookEvent({
    body,
    headers: request.headers,
    secret: process.env.MUKHTABIR_WEBHOOK_SECRET!,
  });

  logger.info("Mukhtabir webhook received", {
    deliveryId: webhook.headers.deliveryId,
    event: webhook.event.event,
  });
  return new Response(null, { status: 200 });
}
```

By default, `parseWebhookEvent` verifies signatures and enforces a 5-minute replay window. The package also exports `verifyWebhookSignature` and `computeWebhookSignature` for lower-level handling.

## Errors

SDK failures throw typed errors that extend `MukhtabirError`, including `AuthenticationError`, `ValidationError`, `NotFoundError`, `RateLimitError`, `ServerError`, `TimeoutError`, `ConnectionError`, and `WebhookVerificationError`.

```ts
import { Mukhtabir, RateLimitError } from "@mukhtabir/sdk";

const client = new Mukhtabir({
  apiKey: process.env.MUKHTABIR_API_KEY!,
});

try {
  await client.feedback.get("fb_123");
} catch (error) {
  if (error instanceof RateLimitError) {
    logger.warn("Mukhtabir rate limited", { retryAfter: error.retryAfter });
  }
  throw error;
}
```

## Examples

See `examples/create-and-invite.ts`, `examples/fetch-feedback.ts`, `examples/nextjs-webhook-route.ts`, and `examples/express-webhook.ts`.

## Testing

- `npm test` runs the unit test suite.
- `npm run test:package` verifies the packed tarball, ESM/CJS entrypoints, subpath exports, and a temporary TypeScript consumer against the installed artifact.
- `npm run test:integration:live` runs the live integration suite when `MUKHTABIR_INTEGRATION=1` and credentials are available.
- `npm run test:integration` runs the full integration lane, including both the packaged-artifact smoke and the live integration suite.
