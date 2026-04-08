# Mukhtabir Python SDK

Typed sync and async clients for the Mukhtabir API.

- Python `3.10+`
- Default base URL: `https://mukhtabir.hbku.edu.qa/api/v1`
- Import clients from `mukhtabir`, models from `mukhtabir.models`, errors from `mukhtabir.errors`, and webhook helpers from `mukhtabir.webhooks`

## Install

Install a published release from PyPI:

```bash
pip install mukhtabir
```

Install from a local checkout of this repository:

```bash
pip install ./python
```

For local SDK development:

```bash
cd python
pip install -e ".[dev]"
```

## Quick Start

```python
import logging

from mukhtabir import MukhtabirClient
from mukhtabir.models import CreateInterviewRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

with MukhtabirClient(api_key="mk_live_your_key") as client:
    created = client.interviews.create(
        CreateInterviewRequest(
            role="Senior Software Engineer",
            type="technical",
            level="senior",
            duration=30,
            techstack=["Python", "PostgreSQL"],
            visibility="restricted",
        )
    )

    interview = client.interviews.get(created.data.interview_id)
    logger.info("Interview %s", interview.data.id)
    logger.info("Role %s", interview.data.role)
```

All resource methods return typed envelope objects:

- `ApiResponse[T]` with `success`, `data`, and `meta`
- `PaginatedResponse[T]` with `success`, `data`, `pagination`, and `meta`

## Async Client

The async client mirrors the sync API.

```python
import logging

from mukhtabir import AsyncMukhtabirClient
from mukhtabir.models import CreateCandidateRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async with AsyncMukhtabirClient(api_key="mk_live_your_key") as client:
    candidate = await client.candidates.create(
        CreateCandidateRequest(
            email="candidate@example.com",
            name="Sarah Al-Rashid",
        )
    )
    logger.info("Interview URL %s", candidate.data.interview_url)
```

## Nested Interview APIs

The interviews resource also exposes nested mutation APIs for interview questions, subquestions, and evaluation criteria.

```python
from mukhtabir import MukhtabirClient
from mukhtabir.models import (
    AddCriteriaRequest,
    AddQuestionRequest,
    AddSubquestionRequest,
    UpdateCriteriaRequest,
    UpdateQuestionRequest,
    UpdateSubquestionRequest,
)

with MukhtabirClient(api_key="mk_live_your_key") as client:
    question = client.interviews.add_question(
        "interview-id",
        AddQuestionRequest(
            question="How would you design a rate limiter?",
            subquestions=["What would you store in Redis?"],
        ),
    )

    client.interviews.update_question(
        "interview-id",
        question.data.question_id,
        UpdateQuestionRequest(order_index=1),
    )

    subquestion = client.interviews.add_subquestion(
        "interview-id",
        question.data.question_id,
        AddSubquestionRequest(subquestion="How would you handle burst traffic?"),
    )

    client.interviews.update_subquestion(
        "interview-id",
        question.data.question_id,
        subquestion.data.subquestion_id,
        UpdateSubquestionRequest(disabled=False),
    )

    criteria = client.interviews.add_criteria(
        "interview-id",
        AddCriteriaRequest(
            criteria_title="System design",
            description="Tradeoffs, scaling, and operational clarity",
        ),
    )

    client.interviews.update_criteria(
        "interview-id",
        criteria.data.criteria_id,
        UpdateCriteriaRequest(order_index=0),
    )

    client.interviews.delete_subquestion(
        "interview-id",
        question.data.question_id,
        subquestion.data.subquestion_id,
    )

    client.interviews.delete_criteria(
        "interview-id",
        criteria.data.criteria_id,
    )

    client.interviews.delete_question(
        "interview-id",
        question.data.question_id,
    )
```

Persist `question_id`, `subquestion_id`, and `criteria_id` returned by create calls. `GET /interviews/:id` now also exposes stable nested IDs and ordering metadata on the interview detail payload, so existing nested items can be discovered from the read surface as well. Read payloads use camelCase `orderIndex`, while mutation inputs still use snake_case `order_index`.

## Sync/Async Maintenance

Sync and async endpoint definitions are maintained from a shared source of truth in `mukhtabir/resources/_request_specs.py`.

When adding or changing an endpoint:

- define the request path, parser, and payload shape in `_request_specs.py`
- add matching sync and async resource wrappers with the same public method name
- add paired sync/async tests for the mirrored surface so behavior does not drift

## Live Integration

Run the live API suite from the package root:

```bash
./scripts/run-live-integration.sh -q
```

The script requires `MUKHTABIR_API_KEY`, uses `MUKHTABIR_BASE_URL` when provided, and sets
`MUKHTABIR_INTEGRATION=1` automatically. To keep `./scripts/run-live-integration.sh` as the
full-coverage entrypoint instead of a partial subset, it also requires these environment
variables:

- `MUKHTABIR_INTEGRATION_INTERVIEW_ID`
- `MUKHTABIR_INTEGRATION_FEEDBACK_ID`
- `MUKHTABIR_INTEGRATION_EXTERNAL_FEEDBACK_ID`
- `MUKHTABIR_INTEGRATION_EXTERNAL_RECORDING_URL`
- `MUKHTABIR_INTEGRATION_CANDIDATE_EMAIL`
- `MUKHTABIR_INTEGRATION_WEBHOOK_ID`
- `MUKHTABIR_INTEGRATION_LIMITED_API_KEY`

The fixture IDs and URLs are not secrets. Pass them explicitly in CI or on the command line rather
than storing them in `.env`. `MUKHTABIR_INTEGRATION_LIMITED_API_KEY` is a secret and should be
handled like any other API key.

## Client Configuration

`MukhtabirClient` and `AsyncMukhtabirClient` accept:

- `api_key`: required bearer token
- `base_url`: override the default API base URL
- `timeout`: `float`, `httpx.Timeout`, or `None` (default `10.0`)
- `max_retries`: retry count for idempotent requests only (default `2`)
- `http_client`: pass your own `httpx.Client` or `httpx.AsyncClient`

Retries apply to idempotent methods (`GET`, `DELETE`, `HEAD`, `OPTIONS`) for transport failures and retryable responses such as `429` and `5xx`.

## Pagination

List endpoints return `PaginatedResponse[...]`. For auto-paging, use the iterator helpers:

```python
import logging

from mukhtabir import MukhtabirClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

with MukhtabirClient(api_key="mk_live_your_key") as client:
    for interview in client.interviews.iter_all(page_size=50):
        logger.info("Interview %s (%s)", interview.id, interview.role)
```

Available auto-paging helpers:

- `client.interviews.iter_all()`
- `client.interviews.iter_all_results(interview_id)`
- `client.candidates.iter_all()`
- `client.webhooks.iter_all()`
- `client.webhooks.iter_all_deliveries(webhook_id)`

## Resources

| Resource | Methods |
| --- | --- |
| `client.interviews` | `create`, `list`, `iter_all`, `get`, `update`, `delete`, `add_question`, `update_question`, `delete_question`, `add_subquestion`, `update_subquestion`, `delete_subquestion`, `add_criteria`, `update_criteria`, `delete_criteria`, `publish`, `invite`, `list_results`, `iter_all_results`, `get_analytics` |
| `client.candidates` | `create`, `list`, `iter_all`, `get` |
| `client.feedback` | `get`, `get_transcript`, `get_recording_url` |
| `client.webhooks` | `create`, `list`, `iter_all`, `get`, `update`, `delete`, `test`, `list_deliveries`, `iter_all_deliveries` |

Request and response bodies are exposed as typed dataclasses.

- `CreateInterviewRequest`, `UpdateInterviewRequest`
- `AddQuestionRequest`, `UpdateQuestionRequest`, `QuestionCreateResult`
- `AddSubquestionRequest`, `UpdateSubquestionRequest`, `SubquestionCreateResult`
- `AddCriteriaRequest`, `UpdateCriteriaRequest`, `CriteriaCreateResult`
- `CreateCandidateRequest`, `InviteCandidateRequest`
- `InterviewDetails`, `CandidateDetails`, `FeedbackDetails`

Import interview, candidate, feedback, and shared envelope models from `mukhtabir.models`.

Import webhook request/response models and payload helpers from `mukhtabir.webhooks`.

- `CreateWebhookRequest`, `UpdateWebhookRequest`
- `WebhookDetails`, `WebhookCreateResult`, `WebhookPayload`

## Publishing

GitHub Actions publishes tags named `python-sdk-vX.Y.Z` to PyPI through
`.github/workflows/python-sdk-release.yml`.

1. Update `src/mukhtabir/_version.py`.
2. Merge the release commit to `main`.
3. Ensure the PyPI project `mukhtabir` trusts this repository's `pypi-release` GitHub Actions
   environment before the first release.
4. Push a tag named `python-sdk-vX.Y.Z`.
5. Keep the Python release repository secrets and vars configured so the live integration gate can run on tags.

Manual workflow runs build and validate the distribution artifacts without publishing them.

## Errors

All SDK exceptions inherit from `MukhtabirError`.

- API errors: `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServerError`, `APIError`
- Client/runtime errors: `TransportError`, `UnexpectedResponseError`

Exceptions may include `status_code`, `code`, `details`, `request_id`, and `retry_after`.

```python
import logging

from mukhtabir import MukhtabirClient
from mukhtabir.errors import MukhtabirError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    with MukhtabirClient(api_key="mk_live_your_key") as client:
        client.feedback.get("feedback-id")
except MukhtabirError as exc:
    logger.exception("Feedback request failed: %s", exc)
    logger.info("Request ID %s", exc.request_id)
```

## Webhook Verification

The SDK includes helpers for signature verification and payload parsing:

```python
import logging

from mukhtabir.webhooks import (
    parse_webhook_headers,
    parse_webhook_payload,
    verify_webhook_signature,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def handle_webhook(headers: dict[str, str], body: bytes, secret: str) -> None:
    webhook_headers = parse_webhook_headers(headers)

    if not verify_webhook_signature(
        body=body,
        signature=webhook_headers.signature,
        timestamp=webhook_headers.timestamp,
        secret=secret,
        tolerance_seconds=300,
    ):
        raise ValueError("Invalid webhook signature")

    payload = parse_webhook_payload(body)
    logger.info("Webhook event %s", payload.event)
```
