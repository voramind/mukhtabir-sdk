from __future__ import annotations

import asyncio
import inspect
import json

import httpx
import pytest

from mukhtabir import AsyncMukhtabirClient, MukhtabirClient
from mukhtabir.errors import RateLimitError
from mukhtabir.models import (
    AddCriteriaRequest,
    AddQuestionRequest,
    AddSubquestionRequest,
    CreateCandidateRequest,
    UpdateCriteriaRequest,
    UpdateQuestionRequest,
    UpdateSubquestionRequest,
)
from mukhtabir.resources import (
    AsyncCandidatesResource,
    AsyncFeedbackResource,
    AsyncInterviewsResource,
    AsyncWebhooksResource,
    SyncCandidatesResource,
    SyncFeedbackResource,
    SyncInterviewsResource,
    SyncWebhooksResource,
)


def _public_methods(resource_type: type[object]) -> set[str]:
    return {
        name
        for name, value in inspect.getmembers(resource_type, predicate=callable)
        if not name.startswith("_")
    }


def test_interview_detail_normalizes_backend_shape() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/interviews/123"
        body = {
            "success": True,
            "data": {
                "id": "123",
                "role": "Senior Software Engineer",
                "type": "technical",
                "level": "senior",
                "duration": 30,
                "published": True,
                "finalized": False,
                "visibility": "restricted",
                "maxScore": 100,
                "createdAt": "2026-03-11T10:00:00Z",
                "updatedAt": "2026-03-11T10:30:00Z",
                "techstack": ["Python", "Django"],
                "questions": [
                    {
                        "question": "Explain joins.",
                        "subquestions": [{"text": "Give an example.", "disabled": False}],
                    }
                ],
                "evaluationCriteriaList": [
                    {
                        "criteriaTitle": "Technical Knowledge",
                        "description": "Depth and accuracy",
                        "scoringGuides": [{"scoreRange": "80-100", "description": "Excellent"}],
                    }
                ],
                "performanceLevels": [{"minScore": 0, "maxScore": 100, "label": "Pass"}],
                "voiceId": "voice_123",
                "interviewInformation": "Bring examples.",
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:30:00Z"},
        }
        return httpx.Response(200, json=body)

    client = MukhtabirClient(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    response = client.interviews.get("123")

    assert response.success is True
    assert response.data.max_score == 100
    assert response.data.voice_id == "voice_123"
    assert response.data.questions[0].subquestions[0].text == "Give an example."
    assert response.data.evaluation_criteria[0].title == "Technical Knowledge"


def test_rate_limit_raises_typed_error() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            headers={"Retry-After": "42", "X-Request-Id": "req_429"},
            json={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                },
                "meta": {"request_id": "req_429", "timestamp": "2026-03-11T10:00:00Z"},
            },
        )

    client = MukhtabirClient(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        max_retries=0,
    )

    with pytest.raises(RateLimitError) as exc_info:
        client.candidates.list()

    assert exc_info.value.retry_after == 42
    assert exc_info.value.request_id == "req_429"


def test_async_candidate_create() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/candidates"
        assert json.loads(request.content.decode("utf-8"))["email"] == "candidate@example.com"
        return httpx.Response(
            201,
            json={
                "success": True,
                "data": {
                    "email": "candidate@example.com",
                    "name": "Sarah Al-Rashid",
                    "access_token": "token_123",
                    "interview_url": "https://example.test/interview",
                    "expires_at": "2026-03-14T10:00:00Z",
                    "interview_id": None,
                },
                "meta": {"request_id": "req_async", "timestamp": "2026-03-11T10:00:00Z"},
            },
        )

    async def run() -> None:
        async with AsyncMukhtabirClient(
            api_key="mk_test_key",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        ) as client:
            response = await client.candidates.create(
                CreateCandidateRequest(email="candidate@example.com", name="Sarah Al-Rashid")
            )

        assert response.success is True
        assert response.data.access_token == "token_123"

    asyncio.run(run())


def test_sync_interview_nested_mutation_methods_build_expected_requests() -> None:
    expected_requests = [
        (
            "POST",
            "/api/v1/interviews/int_123/questions",
            {
                "question": "Describe CAP theorem.",
                "subquestions": ["Which tradeoff matters here?"],
            },
            {
                "question_id": "q_123",
                "interview_id": "int_123",
                "order_index": 0,
            },
        ),
        (
            "PATCH",
            "/api/v1/interviews/int_123/questions/q_123",
            {"disabled": True, "order_index": 2},
            {"question_id": "q_123", "updated": True},
        ),
        (
            "DELETE",
            "/api/v1/interviews/int_123/questions/q_123",
            None,
            {"question_id": "q_123", "deleted": True},
        ),
        (
            "POST",
            "/api/v1/interviews/int_123/questions/q_123/subquestions",
            {"subquestion": "Give a concrete example.", "order_index": 1},
            {
                "subquestion_id": "sq_123",
                "question_id": "q_123",
                "interview_id": "int_123",
                "order_index": 1,
            },
        ),
        (
            "PATCH",
            "/api/v1/interviews/int_123/questions/q_123/subquestions/sq_123",
            {"subquestion": "Use a production incident.", "disabled": False},
            {"subquestion_id": "sq_123", "updated": True},
        ),
        (
            "DELETE",
            "/api/v1/interviews/int_123/questions/q_123/subquestions/sq_123",
            None,
            {"subquestion_id": "sq_123", "deleted": True},
        ),
        (
            "POST",
            "/api/v1/interviews/int_123/criteria",
            {"criteria_title": "Communication", "description": "Clarity and structure"},
            {
                "criteria_id": "c_123",
                "interview_id": "int_123",
                "order_index": 0,
            },
        ),
        (
            "PATCH",
            "/api/v1/interviews/int_123/criteria/c_123",
            {"description": "Organized and concise", "order_index": 3},
            {"criteria_id": "c_123", "updated": True},
        ),
        (
            "DELETE",
            "/api/v1/interviews/int_123/criteria/c_123",
            None,
            {"criteria_id": "c_123", "deleted": True},
        ),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        method, path, expected_body, response_data = expected_requests.pop(0)
        assert request.method == method
        assert request.url.path == path
        if expected_body is None:
            assert request.content in {b"", b"null"}
        else:
            assert json.loads(request.content.decode("utf-8")) == expected_body
        return httpx.Response(
            200 if method != "POST" else 201,
            json={
                "success": True,
                "data": response_data,
                "meta": {"request_id": "req_nested", "timestamp": "2026-03-17T10:00:00Z"},
            },
        )

    client = MukhtabirClient(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    question_created = client.interviews.add_question(
        "int_123",
        AddQuestionRequest(
            question="Describe CAP theorem.",
            subquestions=["Which tradeoff matters here?"],
        ),
    )
    question_updated = client.interviews.update_question(
        "int_123",
        "q_123",
        UpdateQuestionRequest(disabled=True, order_index=2),
    )
    question_deleted = client.interviews.delete_question("int_123", "q_123")
    subquestion_created = client.interviews.add_subquestion(
        "int_123",
        "q_123",
        AddSubquestionRequest(subquestion="Give a concrete example.", order_index=1),
    )
    subquestion_updated = client.interviews.update_subquestion(
        "int_123",
        "q_123",
        "sq_123",
        UpdateSubquestionRequest(subquestion="Use a production incident.", disabled=False),
    )
    subquestion_deleted = client.interviews.delete_subquestion("int_123", "q_123", "sq_123")
    criteria_created = client.interviews.add_criteria(
        "int_123",
        AddCriteriaRequest(criteria_title="Communication", description="Clarity and structure"),
    )
    criteria_updated = client.interviews.update_criteria(
        "int_123",
        "c_123",
        UpdateCriteriaRequest(description="Organized and concise", order_index=3),
    )
    criteria_deleted = client.interviews.delete_criteria("int_123", "c_123")

    assert question_created.data.question_id == "q_123"
    assert question_updated.data.updated is True
    assert question_deleted.data.deleted is True
    assert subquestion_created.data.subquestion_id == "sq_123"
    assert subquestion_updated.data.updated is True
    assert subquestion_deleted.data.deleted is True
    assert criteria_created.data.criteria_id == "c_123"
    assert criteria_updated.data.updated is True
    assert criteria_deleted.data.deleted is True
    assert expected_requests == []


@pytest.mark.parametrize(
    ("sync_resource", "async_resource"),
    [
        (SyncInterviewsResource, AsyncInterviewsResource),
        (SyncCandidatesResource, AsyncCandidatesResource),
        (SyncFeedbackResource, AsyncFeedbackResource),
        (SyncWebhooksResource, AsyncWebhooksResource),
    ],
)
def test_sync_and_async_resources_expose_matching_public_methods(
    sync_resource: type[object],
    async_resource: type[object],
) -> None:
    assert _public_methods(sync_resource) == _public_methods(async_resource)
