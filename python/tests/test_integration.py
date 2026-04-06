from __future__ import annotations

import asyncio
import uuid
import warnings
from collections.abc import AsyncIterator, Iterable, Iterator
from typing import Any

import pytest

from mukhtabir import AsyncMukhtabirClient, MukhtabirClient
from mukhtabir.errors import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PermissionError,
    ValidationError,
)
from mukhtabir.models import (
    AddCriteriaRequest,
    AddQuestionRequest,
    AddSubquestionRequest,
    CreateCandidateRequest,
    CreateInterviewRequest,
    InviteCandidateRequest,
    UpdateCriteriaRequest,
    UpdateInterviewRequest,
    UpdateQuestionRequest,
    UpdateSubquestionRequest,
)
from mukhtabir.webhooks import CreateWebhookRequest, UpdateWebhookRequest

from .support.integration import (
    IntegrationConfig,
    load_integration_config,
    make_async_client,
    make_sync_client,
)

pytestmark = pytest.mark.integration


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}@example.com"


def _take_first(iterable: Iterator[Any]) -> Any | None:
    return next(iterable, None)


async def _take_first_async(iterable: AsyncIterator[Any]) -> Any | None:
    async for item in iterable:
        return item
    return None


def _make_sync_client_for_api_key(config: IntegrationConfig, api_key: str) -> MukhtabirClient:
    if config.base_url is None:
        return MukhtabirClient(api_key=api_key)
    return MukhtabirClient(api_key=api_key, base_url=config.base_url)


def _make_async_client_for_api_key(config: IntegrationConfig, api_key: str) -> AsyncMukhtabirClient:
    if config.base_url is None:
        return AsyncMukhtabirClient(api_key=api_key)
    return AsyncMukhtabirClient(api_key=api_key, base_url=config.base_url)


def _require_item_by_id(items: Iterable[object], item_id: str, label: str) -> Any:
    for item in items:
        if getattr(item, "id", None) == item_id:
            return item

    raise AssertionError(f"Expected {label} {item_id} in response payload.")


def _iterable_contains_id(items: Iterable[object], expected_id: str) -> bool:
    return any(getattr(item, "id", None) == expected_id for item in items)


async def _async_iterable_contains_id(
    items: AsyncIterator[object], expected_id: str
) -> bool:
    async for item in items:
        if getattr(item, "id", None) == expected_id:
            return True
    return False


def _assert_sync_recording_url_surface(
    client: MukhtabirClient,
    feedback_id: str,
    expected_source: str,
    expected_recording_url: str | None = None,
) -> None:
    recording_url = client.feedback.get_recording_url(feedback_id)

    assert recording_url.success is True
    assert recording_url.request_id
    assert recording_url.data.feedback_id == feedback_id
    assert recording_url.data.recording_url
    assert recording_url.data.source == expected_source
    if expected_recording_url is not None:
        assert recording_url.data.recording_url == expected_recording_url
    elif expected_source == "local":
        assert f"/api/recordings/{feedback_id}" in recording_url.data.recording_url


async def _assert_async_recording_url_surface(
    client: AsyncMukhtabirClient,
    feedback_id: str,
    expected_source: str,
    expected_recording_url: str | None = None,
) -> None:
    recording_url = await client.feedback.get_recording_url(feedback_id)

    assert recording_url.success is True
    assert recording_url.request_id
    assert recording_url.data.feedback_id == feedback_id
    assert recording_url.data.recording_url
    assert recording_url.data.source == expected_source
    if expected_recording_url is not None:
        assert recording_url.data.recording_url == expected_recording_url
    elif expected_source == "local":
        assert f"/api/recordings/{feedback_id}" in recording_url.data.recording_url


def _exercise_sync_nested_authoring(
    client: MukhtabirClient, interview_id: str, suffix: str
) -> None:
    initial_question_text = f"Explain retry backpressure {suffix}"
    updated_question_text = f"{initial_question_text} updated"
    inline_subquestion_text = "How do you stop a retry storm?"
    created_subquestion_text = f"How would you detect backlog growth {suffix}?"
    updated_subquestion_text = f"How would you detect sustained backlog growth {suffix}?"
    initial_criteria_title = f"Reliability {suffix}"
    updated_criteria_title = f"Reliability Signals {suffix}"
    updated_criteria_description = "Uses metrics and tradeoffs to explain impact clearly"

    created_question = client.interviews.add_question(
        interview_id,
        AddQuestionRequest(
            question=initial_question_text,
            subquestions=[inline_subquestion_text],
        ),
    )

    assert created_question.success is True
    assert created_question.request_id
    question_id = created_question.data.question_id
    assert question_id
    assert created_question.data.interview_id == interview_id
    assert created_question.data.order_index >= 0

    updated_question = client.interviews.update_question(
        interview_id,
        question_id,
        UpdateQuestionRequest(
            question=updated_question_text,
            disabled=True,
            order_index=1,
        ),
    )

    assert updated_question.success is True
    assert updated_question.request_id
    assert updated_question.data.question_id == question_id
    assert updated_question.data.updated is True

    created_subquestion = client.interviews.add_subquestion(
        interview_id,
        question_id,
        AddSubquestionRequest(
            subquestion=created_subquestion_text,
            order_index=1,
        ),
    )

    assert created_subquestion.success is True
    assert created_subquestion.request_id
    assert created_subquestion.data.question_id == question_id
    assert created_subquestion.data.interview_id == interview_id
    assert created_subquestion.data.order_index == 1
    subquestion_id = created_subquestion.data.subquestion_id

    updated_subquestion = client.interviews.update_subquestion(
        interview_id,
        question_id,
        subquestion_id,
        UpdateSubquestionRequest(
            subquestion=updated_subquestion_text,
            disabled=True,
            order_index=2,
        ),
    )

    assert updated_subquestion.success is True
    assert updated_subquestion.request_id
    assert updated_subquestion.data.subquestion_id == subquestion_id
    assert updated_subquestion.data.updated is True

    created_criteria = client.interviews.add_criteria(
        interview_id,
        AddCriteriaRequest(
            criteria_title=initial_criteria_title,
            description="Evaluates resilience and incident judgment",
        ),
    )

    assert created_criteria.success is True
    assert created_criteria.request_id
    assert created_criteria.data.interview_id == interview_id
    assert created_criteria.data.order_index >= 0
    criteria_id = created_criteria.data.criteria_id

    updated_criteria = client.interviews.update_criteria(
        interview_id,
        criteria_id,
        UpdateCriteriaRequest(
            criteria_title=updated_criteria_title,
            description=updated_criteria_description,
            disabled=True,
            order_index=1,
        ),
    )

    assert updated_criteria.success is True
    assert updated_criteria.request_id
    assert updated_criteria.data.criteria_id == criteria_id
    assert updated_criteria.data.updated is True

    detail = client.interviews.get(interview_id)

    assert detail.success is True
    assert detail.request_id
    authored_question = _require_item_by_id(detail.data.questions, question_id, "question")
    assert authored_question.question == updated_question_text
    assert authored_question.disabled is True
    assert authored_question.order_index == 1
    subquestions = authored_question.subquestions
    assert any(getattr(item, "text", None) == inline_subquestion_text for item in subquestions)
    authored_subquestion = _require_item_by_id(subquestions, subquestion_id, "subquestion")
    assert authored_subquestion.text == updated_subquestion_text
    assert authored_subquestion.disabled is True
    assert authored_subquestion.order_index == 2

    authored_criteria = _require_item_by_id(
        detail.data.evaluation_criteria,
        criteria_id,
        "criterion",
    )
    assert authored_criteria.title == updated_criteria_title
    assert authored_criteria.description == updated_criteria_description
    assert authored_criteria.disabled is True
    assert authored_criteria.order_index == 1

    deleted_subquestion = client.interviews.delete_subquestion(
        interview_id,
        question_id,
        subquestion_id,
    )
    assert deleted_subquestion.success is True
    assert deleted_subquestion.request_id
    assert deleted_subquestion.data.subquestion_id == subquestion_id
    assert deleted_subquestion.data.deleted is True

    deleted_question = client.interviews.delete_question(interview_id, question_id)
    assert deleted_question.success is True
    assert deleted_question.request_id
    assert deleted_question.data.question_id == question_id
    assert deleted_question.data.deleted is True

    deleted_criteria = client.interviews.delete_criteria(interview_id, criteria_id)
    assert deleted_criteria.success is True
    assert deleted_criteria.request_id
    assert deleted_criteria.data.criteria_id == criteria_id
    assert deleted_criteria.data.deleted is True

    cleaned_detail = client.interviews.get(interview_id)
    assert cleaned_detail.success is True
    assert not _iterable_contains_id(cleaned_detail.data.questions, question_id)
    assert not _iterable_contains_id(cleaned_detail.data.evaluation_criteria, criteria_id)


async def _exercise_async_nested_authoring(
    client: AsyncMukhtabirClient, interview_id: str, suffix: str
) -> None:
    initial_question_text = f"Explain queue backpressure {suffix}"
    updated_question_text = f"{initial_question_text} updated"
    inline_subquestion_text = "What metric spikes first?"
    created_subquestion_text = f"How would you cap retries {suffix}?"
    updated_subquestion_text = f"How would you cap retries during outages {suffix}?"
    initial_criteria_title = f"Operational Judgment {suffix}"
    updated_criteria_title = f"Operational Signals {suffix}"
    updated_criteria_description = "Explains alerts, thresholds, and tradeoffs clearly"

    created_question = await client.interviews.add_question(
        interview_id,
        AddQuestionRequest(
            question=initial_question_text,
            subquestions=[inline_subquestion_text],
        ),
    )

    assert created_question.success is True
    assert created_question.request_id
    question_id = created_question.data.question_id
    assert question_id
    assert created_question.data.interview_id == interview_id
    assert created_question.data.order_index >= 0

    updated_question = await client.interviews.update_question(
        interview_id,
        question_id,
        UpdateQuestionRequest(
            question=updated_question_text,
            disabled=True,
            order_index=1,
        ),
    )

    assert updated_question.success is True
    assert updated_question.request_id
    assert updated_question.data.question_id == question_id
    assert updated_question.data.updated is True

    created_subquestion = await client.interviews.add_subquestion(
        interview_id,
        question_id,
        AddSubquestionRequest(
            subquestion=created_subquestion_text,
            order_index=1,
        ),
    )

    assert created_subquestion.success is True
    assert created_subquestion.request_id
    assert created_subquestion.data.question_id == question_id
    assert created_subquestion.data.interview_id == interview_id
    assert created_subquestion.data.order_index == 1
    subquestion_id = created_subquestion.data.subquestion_id

    updated_subquestion = await client.interviews.update_subquestion(
        interview_id,
        question_id,
        subquestion_id,
        UpdateSubquestionRequest(
            subquestion=updated_subquestion_text,
            disabled=True,
            order_index=2,
        ),
    )

    assert updated_subquestion.success is True
    assert updated_subquestion.request_id
    assert updated_subquestion.data.subquestion_id == subquestion_id
    assert updated_subquestion.data.updated is True

    created_criteria = await client.interviews.add_criteria(
        interview_id,
        AddCriteriaRequest(
            criteria_title=initial_criteria_title,
            description="Evaluates incident response reasoning",
        ),
    )

    assert created_criteria.success is True
    assert created_criteria.request_id
    assert created_criteria.data.interview_id == interview_id
    assert created_criteria.data.order_index >= 0
    criteria_id = created_criteria.data.criteria_id

    updated_criteria = await client.interviews.update_criteria(
        interview_id,
        criteria_id,
        UpdateCriteriaRequest(
            criteria_title=updated_criteria_title,
            description=updated_criteria_description,
            disabled=True,
            order_index=1,
        ),
    )

    assert updated_criteria.success is True
    assert updated_criteria.request_id
    assert updated_criteria.data.criteria_id == criteria_id
    assert updated_criteria.data.updated is True

    detail = await client.interviews.get(interview_id)

    assert detail.success is True
    assert detail.request_id
    authored_question = _require_item_by_id(detail.data.questions, question_id, "question")
    assert authored_question.question == updated_question_text
    assert authored_question.disabled is True
    assert authored_question.order_index == 1
    subquestions = authored_question.subquestions
    assert any(getattr(item, "text", None) == inline_subquestion_text for item in subquestions)
    authored_subquestion = _require_item_by_id(subquestions, subquestion_id, "subquestion")
    assert authored_subquestion.text == updated_subquestion_text
    assert authored_subquestion.disabled is True
    assert authored_subquestion.order_index == 2

    authored_criteria = _require_item_by_id(
        detail.data.evaluation_criteria,
        criteria_id,
        "criterion",
    )
    assert authored_criteria.title == updated_criteria_title
    assert authored_criteria.description == updated_criteria_description
    assert authored_criteria.disabled is True
    assert authored_criteria.order_index == 1

    deleted_subquestion = await client.interviews.delete_subquestion(
        interview_id,
        question_id,
        subquestion_id,
    )
    assert deleted_subquestion.success is True
    assert deleted_subquestion.request_id
    assert deleted_subquestion.data.subquestion_id == subquestion_id
    assert deleted_subquestion.data.deleted is True

    deleted_question = await client.interviews.delete_question(interview_id, question_id)
    assert deleted_question.success is True
    assert deleted_question.request_id
    assert deleted_question.data.question_id == question_id
    assert deleted_question.data.deleted is True

    deleted_criteria = await client.interviews.delete_criteria(interview_id, criteria_id)
    assert deleted_criteria.success is True
    assert deleted_criteria.request_id
    assert deleted_criteria.data.criteria_id == criteria_id
    assert deleted_criteria.data.deleted is True

    cleaned_detail = await client.interviews.get(interview_id)
    assert cleaned_detail.success is True
    assert not _iterable_contains_id(cleaned_detail.data.questions, question_id)
    assert not _iterable_contains_id(cleaned_detail.data.evaluation_criteria, criteria_id)


def _require_seeded_read_surface(config: IntegrationConfig) -> tuple[str, str, str, str]:
    missing = [
        name
        for name, value in (
            ("MUKHTABIR_INTEGRATION_INTERVIEW_ID", config.interview_id),
            ("MUKHTABIR_INTEGRATION_FEEDBACK_ID", config.feedback_id),
            ("MUKHTABIR_INTEGRATION_CANDIDATE_EMAIL", config.candidate_email),
            ("MUKHTABIR_INTEGRATION_WEBHOOK_ID", config.webhook_id),
        )
        if not value
    ]
    if missing:
        pytest.skip(
            "Set "
            + ", ".join(missing)
            + " to run seeded live integration coverage for results, feedback, and "
            + "webhook deliveries."
        )

    return (
        config.interview_id or "",
        config.feedback_id or "",
        config.candidate_email or "",
        config.webhook_id or "",
    )


def _require_external_recording_surface(config: IntegrationConfig) -> tuple[str, str]:
    missing = [
        name
        for name, value in (
            ("MUKHTABIR_INTEGRATION_EXTERNAL_FEEDBACK_ID", config.external_feedback_id),
            ("MUKHTABIR_INTEGRATION_EXTERNAL_RECORDING_URL", config.external_recording_url),
        )
        if not value
    ]
    if missing:
        pytest.skip(
            "Set "
            + ", ".join(missing)
            + " to run the external recording URL live integration coverage."
        )

    return (
        config.external_feedback_id or "",
        config.external_recording_url or "",
    )


def _require_limited_scope_api_key(config: IntegrationConfig) -> str:
    if not config.limited_api_key:
        pytest.skip(
            "Set MUKHTABIR_INTEGRATION_LIMITED_API_KEY to run the live insufficient-scope "
            "integration coverage."
        )

    return config.limited_api_key


def _assert_nested_metadata_present(
    interview_id: str, detail_questions: list[object], detail_criteria: list[object]
) -> None:
    assert detail_questions, f"Seeded interview {interview_id} should expose nested questions."
    assert detail_criteria, f"Seeded interview {interview_id} should expose evaluation criteria."

    for question in detail_questions:
        assert getattr(question, "id", None), "Expected question IDs in interview detail."
        assert getattr(question, "order_index", None) is not None, (
            "Expected question order metadata."
        )
        subquestions = getattr(question, "subquestions", [])
        assert subquestions, "Expected seeded subquestions in interview detail."
        for subquestion in subquestions:
            assert getattr(subquestion, "id", None), "Expected subquestion IDs in interview detail."
            assert getattr(subquestion, "order_index", None) is not None, (
                "Expected subquestion order metadata."
            )

    for criterion in detail_criteria:
        assert getattr(criterion, "id", None), "Expected criteria IDs in interview detail."
        assert getattr(criterion, "order_index", None) is not None, (
            "Expected criteria order metadata."
        )


def test_sync_client_manages_interview_lifecycle() -> None:
    config = load_integration_config()
    role = f"Python Integration Test {uuid.uuid4().hex[:12]}"
    updated_role = f"{role} Updated"
    invite_email = _unique_email("python-sync-invite")
    interview_id: str | None = None
    test_error: BaseException | None = None

    with make_sync_client(config) as client:
        try:
            created = client.interviews.create(
                CreateInterviewRequest(
                    role=role,
                    type="technical",
                    level="mid",
                    duration=30,
                    techstack=["Python", "pytest"],
                    visibility="private",
                )
            )

            assert created.success is True
            assert created.request_id
            interview_id = created.data.interview_id
            assert interview_id

            fetched = client.interviews.get(interview_id)

            assert fetched.success is True
            assert fetched.request_id
            assert fetched.data.id == interview_id
            assert fetched.data.role == role
            assert fetched.data.type == "technical"
            assert fetched.data.level == "mid"
            assert fetched.data.duration == 30
            assert "Python" in fetched.data.techstack

            page = client.interviews.list(page=1, page_size=5)

            assert page.success is True
            assert page.pagination.page == 1
            assert page.pagination.page_size == 5
            assert isinstance(page.data, list)
            assert page.request_id

            first_interview = _take_first(client.interviews.iter_all(page_size=1))
            assert first_interview is not None
            assert getattr(first_interview, "id", None)
            assert getattr(first_interview, "role", None)

            updated = client.interviews.update(
                interview_id,
                UpdateInterviewRequest(
                    role=updated_role,
                    duration=45,
                    visibility="restricted",
                ),
            )

            assert updated.success is True
            assert updated.request_id
            assert updated.data.id == interview_id
            assert updated.data.role == updated_role
            assert updated.data.duration == 45
            assert updated.data.visibility == "restricted"

            refreshed = client.interviews.get(interview_id)

            assert refreshed.success is True
            assert refreshed.data.id == interview_id
            assert refreshed.data.role == updated_role
            assert refreshed.data.duration == 45
            assert refreshed.data.visibility == "restricted"

            _exercise_sync_nested_authoring(client, interview_id, role)

            published = client.interviews.publish(interview_id)

            assert published.success is True
            assert published.request_id
            assert published.data.interview_id == interview_id
            assert published.data.published is True

            invited = client.interviews.invite(
                interview_id,
                InviteCandidateRequest(
                    email=invite_email,
                    name="Python Sync Invitee",
                    expires_in_hours=24,
                ),
            )

            assert invited.success is True
            assert invited.request_id
            assert invited.data.candidate_email == invite_email
            assert invited.data.candidate_name == "Python Sync Invitee"
            assert invited.data.interview_url

            with pytest.raises(ConflictError):
                client.interviews.invite(
                    interview_id,
                    InviteCandidateRequest(
                        email=invite_email,
                        name="Python Sync Invitee",
                        expires_in_hours=24,
                    ),
                )
        except BaseException as exc:
            test_error = exc
            raise
        finally:
            if interview_id is not None:
                try:
                    deleted = client.interviews.delete(interview_id)
                    assert deleted.success is True
                    assert deleted.request_id
                    assert deleted.data.deleted is True
                except Exception as cleanup_exc:
                    message = (
                        "Failed to delete live integration interview "
                        f"{interview_id}. Remove it manually if it still exists."
                    )
                    if test_error is None:
                        raise AssertionError(message) from cleanup_exc
                    warnings.warn(message, stacklevel=2)


def test_sync_client_exercises_seeded_read_surfaces() -> None:
    config = load_integration_config()
    interview_id, feedback_id, candidate_email, webhook_id = _require_seeded_read_surface(config)

    with make_sync_client(config) as client:
        detail = client.interviews.get(interview_id)

        assert detail.success is True
        assert detail.request_id
        assert detail.data.id == interview_id
        assert detail.data.user_id
        _assert_nested_metadata_present(
            interview_id,
            detail.data.questions,
            detail.data.evaluation_criteria,
        )

        results = client.interviews.list_results(interview_id, page=1, page_size=10)

        assert results.success is True
        assert results.request_id
        assert results.pagination.page == 1
        assert results.pagination.total >= 1
        assert any(item.id == feedback_id for item in results.data)
        assert _iterable_contains_id(
            client.interviews.iter_all_results(interview_id, page_size=10),
            feedback_id,
        )

        analytics = client.interviews.get_analytics(interview_id)

        assert analytics.success is True
        assert analytics.request_id
        assert analytics.data.interview_id == interview_id
        assert analytics.data.total_candidates >= 1
        assert analytics.data.evaluated_count >= 1
        assert analytics.data.completion.completed >= 1

        candidate = client.candidates.get(candidate_email)

        assert candidate.success is True
        assert candidate.request_id
        assert candidate.data.email == candidate_email
        assert any(item.feedback_id == feedback_id for item in candidate.data.feedback)
        first_candidate = _take_first(client.candidates.iter_all(page_size=1))
        assert first_candidate is not None
        assert getattr(first_candidate, "email", None)

        feedback = client.feedback.get(feedback_id)

        assert feedback.success is True
        assert feedback.request_id
        assert feedback.data.id == feedback_id
        assert feedback.data.final_assessment

        transcript = client.feedback.get_transcript(feedback_id)

        assert transcript.success is True
        assert transcript.request_id
        assert transcript.data.feedback_id == feedback_id
        assert transcript.data.transcript

        _assert_sync_recording_url_surface(client, feedback_id, "local")

        webhook = client.webhooks.get(webhook_id)

        assert webhook.success is True
        assert webhook.request_id
        assert webhook.data.id == webhook_id
        first_webhook = _take_first(client.webhooks.iter_all(page_size=1))
        assert first_webhook is not None
        assert getattr(first_webhook, "id", None)

        tested = client.webhooks.test(webhook_id)

        assert tested.success is True
        assert tested.request_id
        assert tested.data.delivery_id
        assert tested.data.status == "delivered"

        deliveries = client.webhooks.list_deliveries(webhook_id, page=1, page_size=10)

        assert deliveries.success is True
        assert deliveries.request_id
        assert deliveries.pagination.total >= 1
        assert any(item.id == tested.data.delivery_id for item in deliveries.data)
        assert _iterable_contains_id(
            client.webhooks.iter_all_deliveries(webhook_id, page_size=10),
            tested.data.delivery_id,
        )


def test_sync_client_exercises_external_recording_url_surface_if_configured() -> None:
    config = load_integration_config()
    external_feedback_id, external_recording_url = _require_external_recording_surface(config)

    with make_sync_client(config) as client:
        _assert_sync_recording_url_surface(
            client,
            external_feedback_id,
            "external",
            external_recording_url,
        )


def test_sync_client_maps_live_error_surfaces() -> None:
    config = load_integration_config()
    missing_feedback_id = str(uuid.uuid4())
    limited_api_key = _require_limited_scope_api_key(config)

    with make_sync_client(config) as client:
        with pytest.raises(NotFoundError):
            client.feedback.get(missing_feedback_id)

        with pytest.raises(ValidationError):
            client.candidates.create(
                CreateCandidateRequest(
                    email="not-an-email",
                    name="Invalid Candidate",
                )
            )

    with _make_sync_client_for_api_key(config, f"invalid-{config.api_key}") as invalid_client:
        with pytest.raises(AuthenticationError):
            invalid_client.interviews.list(page=1, page_size=1)

    with _make_sync_client_for_api_key(config, limited_api_key) as limited_client:
        with pytest.raises(PermissionError):
            limited_client.webhooks.list(page=1, page_size=1)


def test_async_client_manages_cross_resource_lifecycle() -> None:
    config = load_integration_config()
    role = f"Python Async Integration Test {uuid.uuid4().hex[:12]}"
    candidate_email = _unique_email("python-async-candidate")
    invite_email = _unique_email("python-async-invite")
    webhook_suffix = uuid.uuid4().hex[:12]
    webhook_url = f"https://example.com/mukhtabir/python/async/{webhook_suffix}"
    interview_id: str | None = None
    webhook_id: str | None = None
    test_error: BaseException | None = None

    async def run() -> None:
        nonlocal interview_id, webhook_id, test_error

        async with make_async_client(config) as client:
            try:
                listing = await client.interviews.list(page=1, page_size=1)

                assert listing.success is True
                assert listing.pagination.page >= 1
                assert listing.pagination.page_size >= 1
                assert isinstance(listing.data, list)
                assert listing.request_id

                first_interview = await _take_first_async(client.interviews.iter_all(page_size=1))
                assert first_interview is not None
                assert getattr(first_interview, "id", None)
                assert getattr(first_interview, "role", None)

                created = await client.interviews.create(
                    CreateInterviewRequest(
                        role=role,
                        type="technical",
                        level="mid",
                        duration=30,
                        techstack=["Python", "asyncio"],
                        visibility="private",
                    )
                )

                assert created.success is True
                assert created.request_id
                interview_id = created.data.interview_id
                assert interview_id

                updated = await client.interviews.update(
                    interview_id,
                    UpdateInterviewRequest(role=f"{role} Updated", duration=45),
                )

                assert updated.success is True
                assert updated.data.id == interview_id
                assert updated.data.duration == 45

                await _exercise_async_nested_authoring(client, interview_id, role)

                published = await client.interviews.publish(interview_id)

                assert published.success is True
                assert published.data.interview_id == interview_id
                assert published.data.published is True

                invited = await client.interviews.invite(
                    interview_id,
                    InviteCandidateRequest(
                        email=invite_email,
                        name="Python Async Invitee",
                        expires_in_hours=24,
                    ),
                )

                assert invited.success is True
                assert invited.data.candidate_email == invite_email
                assert invited.data.interview_url

                with pytest.raises(ConflictError):
                    await client.interviews.invite(
                        interview_id,
                        InviteCandidateRequest(
                            email=invite_email,
                            name="Python Async Invitee",
                            expires_in_hours=24,
                        ),
                    )

                created_candidate = await client.candidates.create(
                    CreateCandidateRequest(
                        email=candidate_email,
                        name="Python Async Candidate",
                    )
                )

                assert created_candidate.success is True
                assert created_candidate.request_id
                assert created_candidate.data.email == candidate_email
                assert created_candidate.data.interview_url

                fetched_candidate = await client.candidates.get(candidate_email)

                assert fetched_candidate.success is True
                assert fetched_candidate.request_id
                assert fetched_candidate.data.email == candidate_email

                candidates = await client.candidates.list(page=1, page_size=10)

                assert candidates.success is True
                assert candidates.request_id
                assert candidates.pagination.page == 1
                assert candidates.pagination.page_size == 10
                first_candidate = await _take_first_async(client.candidates.iter_all(page_size=1))
                assert first_candidate is not None
                assert getattr(first_candidate, "email", None)

                created_webhook = await client.webhooks.create(
                    CreateWebhookRequest(
                        url=webhook_url,
                        events=["interview.created"],
                        description="Python async integration webhook",
                    )
                )

                assert created_webhook.success is True
                assert created_webhook.request_id
                webhook_id = created_webhook.data.id
                assert webhook_id
                assert created_webhook.data.secret
                assert created_webhook.data.secret_preview == (
                    f"{created_webhook.data.secret[:8]}..."
                )

                fetched_webhook = await client.webhooks.get(webhook_id)

                assert fetched_webhook.success is True
                assert fetched_webhook.request_id
                assert fetched_webhook.data.id == webhook_id
                first_webhook = await _take_first_async(client.webhooks.iter_all(page_size=1))
                assert first_webhook is not None
                assert getattr(first_webhook, "id", None)

                updated_webhook = await client.webhooks.update(
                    webhook_id,
                    UpdateWebhookRequest(
                        description="Python async integration webhook updated",
                        is_active=False,
                    ),
                )

                assert updated_webhook.success is True
                assert updated_webhook.request_id
                assert updated_webhook.data.id == webhook_id
                assert updated_webhook.data.is_active is False
            except BaseException as exc:
                test_error = exc
                raise
            finally:
                if webhook_id is not None:
                    try:
                        deleted = await client.webhooks.delete(webhook_id)
                        assert deleted.success is True
                        assert deleted.request_id
                        assert deleted.data.deleted is True
                    except Exception as cleanup_exc:
                        message = (
                            "Failed to delete live integration webhook "
                            f"{webhook_id}. Remove it manually if it still exists."
                        )
                        if test_error is None:
                            raise AssertionError(message) from cleanup_exc
                        warnings.warn(message, stacklevel=2)

                if interview_id is not None:
                    try:
                        deleted = await client.interviews.delete(interview_id)
                        assert deleted.success is True
                        assert deleted.request_id
                        assert deleted.data.deleted is True
                    except Exception as cleanup_exc:
                        message = (
                            "Failed to delete live integration interview "
                            f"{interview_id}. Remove it manually if it still exists."
                        )
                        if test_error is None:
                            raise AssertionError(message) from cleanup_exc
                        warnings.warn(message, stacklevel=2)

    asyncio.run(run())


def test_async_client_creates_candidate_bound_to_interview() -> None:
    config = load_integration_config()
    interview_id: str | None = None
    candidate_email = _unique_email("python-async-bound-candidate")
    test_error: BaseException | None = None

    async def run() -> None:
        nonlocal interview_id, test_error

        async with make_async_client(config) as client:
            try:
                created_interview = await client.interviews.create(
                    CreateInterviewRequest(
                        role=f"Python Async Bound Candidate Test {uuid.uuid4().hex[:12]}",
                        type="technical",
                        level="mid",
                        duration=30,
                        techstack=["Python"],
                        visibility="private",
                    )
                )

                assert created_interview.success is True
                interview_id = created_interview.data.interview_id
                assert interview_id

                created_candidate = await client.candidates.create(
                    CreateCandidateRequest(
                        email=candidate_email,
                        name="Python Async Bound Candidate",
                        interview_id=interview_id,
                    )
                )

                assert created_candidate.success is True
                assert created_candidate.request_id
                assert created_candidate.data.email == candidate_email
                assert created_candidate.data.interview_id == interview_id
                assert f"/interview/{interview_id}" in created_candidate.data.interview_url

                fetched_candidate = await client.candidates.get(candidate_email)

                assert fetched_candidate.success is True
                assert fetched_candidate.request_id
                assert fetched_candidate.data.email == candidate_email
                assert any(
                    getattr(item, "interview_id", None) == interview_id
                    for item in fetched_candidate.data.interviews
                )
            except BaseException as exc:
                test_error = exc
                raise
            finally:
                if interview_id is not None:
                    try:
                        deleted = await client.interviews.delete(interview_id)
                        assert deleted.success is True
                        assert deleted.request_id
                        assert deleted.data.deleted is True
                    except Exception as cleanup_exc:
                        message = (
                            "Failed to delete live integration interview "
                            f"{interview_id}. Remove it manually if it still exists."
                        )
                        if test_error is None:
                            raise AssertionError(message) from cleanup_exc
                        warnings.warn(message, stacklevel=2)

    asyncio.run(run())


def test_async_client_exercises_seeded_read_surfaces() -> None:
    config = load_integration_config()
    interview_id, feedback_id, candidate_email, webhook_id = _require_seeded_read_surface(config)

    async def run() -> None:
        async with make_async_client(config) as client:
            detail = await client.interviews.get(interview_id)

            assert detail.success is True
            assert detail.request_id
            assert detail.data.id == interview_id
            _assert_nested_metadata_present(
                interview_id,
                detail.data.questions,
                detail.data.evaluation_criteria,
            )

            results = await client.interviews.list_results(interview_id, page=1, page_size=10)

            assert results.success is True
            assert results.request_id
            assert results.pagination.total >= 1
            assert any(item.id == feedback_id for item in results.data)
            assert await _async_iterable_contains_id(
                client.interviews.iter_all_results(interview_id, page_size=10),
                feedback_id,
            )

            analytics = await client.interviews.get_analytics(interview_id)

            assert analytics.success is True
            assert analytics.request_id
            assert analytics.data.interview_id == interview_id
            assert analytics.data.total_candidates >= 1

            candidate = await client.candidates.get(candidate_email)

            assert candidate.success is True
            assert candidate.request_id
            assert candidate.data.email == candidate_email
            assert any(item.feedback_id == feedback_id for item in candidate.data.feedback)
            first_candidate = await _take_first_async(client.candidates.iter_all(page_size=1))
            assert first_candidate is not None
            assert getattr(first_candidate, "email", None)

            feedback = await client.feedback.get(feedback_id)

            assert feedback.success is True
            assert feedback.request_id
            assert feedback.data.id == feedback_id

            transcript = await client.feedback.get_transcript(feedback_id)

            assert transcript.success is True
            assert transcript.request_id
            assert transcript.data.feedback_id == feedback_id
            assert transcript.data.transcript

            await _assert_async_recording_url_surface(client, feedback_id, "local")

            webhook = await client.webhooks.get(webhook_id)

            assert webhook.success is True
            assert webhook.request_id
            assert webhook.data.id == webhook_id
            first_webhook = await _take_first_async(client.webhooks.iter_all(page_size=1))
            assert first_webhook is not None
            assert getattr(first_webhook, "id", None)

            tested = await client.webhooks.test(webhook_id)

            assert tested.success is True
            assert tested.request_id
            assert tested.data.delivery_id
            assert tested.data.status == "delivered"

            deliveries = await client.webhooks.list_deliveries(webhook_id, page=1, page_size=10)

            assert deliveries.success is True
            assert deliveries.request_id
            assert deliveries.pagination.total >= 1
            assert any(item.id == tested.data.delivery_id for item in deliveries.data)
            assert await _async_iterable_contains_id(
                client.webhooks.iter_all_deliveries(webhook_id, page_size=10),
                tested.data.delivery_id,
            )

    asyncio.run(run())


def test_async_client_exercises_external_recording_url_surface_if_configured() -> None:
    config = load_integration_config()
    external_feedback_id, external_recording_url = _require_external_recording_surface(config)

    async def run() -> None:
        async with make_async_client(config) as client:
            await _assert_async_recording_url_surface(
                client,
                external_feedback_id,
                "external",
                external_recording_url,
            )

    asyncio.run(run())


def test_async_client_maps_live_error_surfaces() -> None:
    config = load_integration_config()
    missing_feedback_id = str(uuid.uuid4())
    limited_api_key = _require_limited_scope_api_key(config)

    async def run() -> None:
        async with make_async_client(config) as client:
            with pytest.raises(NotFoundError):
                await client.feedback.get(missing_feedback_id)

            with pytest.raises(ValidationError):
                await client.candidates.create(
                    CreateCandidateRequest(
                        email="not-an-email",
                        name="Invalid Async Candidate",
                    )
                )

        async with _make_async_client_for_api_key(
            config, f"invalid-{config.api_key}"
        ) as invalid_client:
            with pytest.raises(AuthenticationError):
                await invalid_client.interviews.list(page=1, page_size=1)

        async with _make_async_client_for_api_key(config, limited_api_key) as limited_client:
            with pytest.raises(PermissionError):
                await limited_client.webhooks.list(page=1, page_size=1)

    asyncio.run(run())


def test_sync_client_manages_nested_interview_content_lifecycle() -> None:
    config = load_integration_config()
    role = f"Python Nested API Test {uuid.uuid4().hex[:12]}"
    interview_id: str | None = None
    question_id: str | None = None
    subquestion_id: str | None = None
    criteria_id: str | None = None
    test_error: BaseException | None = None

    with make_sync_client(config) as client:
        try:
            created = client.interviews.create(
                CreateInterviewRequest(
                    role=role,
                    type="technical",
                    level="mid",
                    duration=30,
                    techstack=["Python"],
                    visibility="private",
                )
            )

            assert created.success is True
            interview_id = created.data.interview_id
            assert interview_id

            question = client.interviews.add_question(
                interview_id,
                AddQuestionRequest(
                    question="Design a resilient queue consumer.",
                    subquestions=["How would you handle retries?"],
                ),
            )

            assert question.success is True
            question_id = question.data.question_id
            assert question_id

            updated_question = client.interviews.update_question(
                interview_id,
                question_id,
                UpdateQuestionRequest(order_index=1),
            )

            assert updated_question.success is True
            assert updated_question.data.updated is True

            subquestion = client.interviews.add_subquestion(
                interview_id,
                question_id,
                AddSubquestionRequest(subquestion="What metrics would you track?"),
            )

            assert subquestion.success is True
            subquestion_id = subquestion.data.subquestion_id
            assert subquestion_id

            updated_subquestion = client.interviews.update_subquestion(
                interview_id,
                question_id,
                subquestion_id,
                UpdateSubquestionRequest(disabled=False, order_index=2),
            )

            assert updated_subquestion.success is True
            assert updated_subquestion.data.updated is True

            deleted_subquestion = client.interviews.delete_subquestion(
                interview_id,
                question_id,
                subquestion_id,
            )

            assert deleted_subquestion.success is True
            assert deleted_subquestion.data.deleted is True
            subquestion_id = None

            criteria = client.interviews.add_criteria(
                interview_id,
                AddCriteriaRequest(
                    criteria_title="Systems thinking",
                    description="Tradeoffs and failure handling",
                ),
            )

            assert criteria.success is True
            criteria_id = criteria.data.criteria_id
            assert criteria_id

            updated_criteria = client.interviews.update_criteria(
                interview_id,
                criteria_id,
                UpdateCriteriaRequest(disabled=False, order_index=1),
            )

            assert updated_criteria.success is True
            assert updated_criteria.data.updated is True

            deleted_criteria = client.interviews.delete_criteria(interview_id, criteria_id)

            assert deleted_criteria.success is True
            assert deleted_criteria.data.deleted is True
            criteria_id = None

            deleted_question = client.interviews.delete_question(interview_id, question_id)

            assert deleted_question.success is True
            assert deleted_question.data.deleted is True
            question_id = None
        except BaseException as exc:
            test_error = exc
            raise
        finally:
            if interview_id is not None:
                try:
                    if subquestion_id is not None and question_id is not None:
                        client.interviews.delete_subquestion(
                            interview_id, question_id, subquestion_id
                        )
                    if criteria_id is not None:
                        client.interviews.delete_criteria(interview_id, criteria_id)
                    if question_id is not None:
                        client.interviews.delete_question(interview_id, question_id)

                    deleted = client.interviews.delete(interview_id)
                    assert deleted.success is True
                    assert deleted.request_id
                    assert deleted.data.deleted is True
                except Exception as cleanup_exc:
                    message = (
                        "Failed to delete live integration interview "
                        f"{interview_id}. Remove it manually if it still exists."
                    )
                    if test_error is None:
                        raise AssertionError(message) from cleanup_exc
                    warnings.warn(message, stacklevel=2)


def test_sync_client_manages_candidate_lifecycle() -> None:
    config = load_integration_config()
    candidate_email = _unique_email("python-sync-candidate")

    with make_sync_client(config) as client:
        created = client.candidates.create(
            CreateCandidateRequest(
                email=candidate_email,
                name="Python Sync Candidate",
            )
        )

        assert created.success is True
        assert created.request_id
        assert created.data.email == candidate_email
        assert created.data.interview_url

        fetched = client.candidates.get(candidate_email)

        assert fetched.success is True
        assert fetched.request_id
        assert fetched.data.email == candidate_email
        assert fetched.data.name == "Python Sync Candidate"

        page = client.candidates.list(page=1, page_size=5)

        assert page.success is True
        assert page.request_id
        assert page.pagination.page == 1
        assert page.pagination.page_size == 5
        assert isinstance(page.data, list)


def test_sync_client_creates_candidate_bound_to_interview() -> None:
    config = load_integration_config()
    interview_id: str | None = None
    candidate_email = _unique_email("python-sync-bound-candidate")
    test_error: BaseException | None = None

    with make_sync_client(config) as client:
        try:
            created_interview = client.interviews.create(
                CreateInterviewRequest(
                    role=f"Python Bound Candidate Test {uuid.uuid4().hex[:12]}",
                    type="technical",
                    level="mid",
                    duration=30,
                    techstack=["Python"],
                    visibility="private",
                )
            )

            assert created_interview.success is True
            interview_id = created_interview.data.interview_id
            assert interview_id

            created_candidate = client.candidates.create(
                CreateCandidateRequest(
                    email=candidate_email,
                    name="Python Sync Bound Candidate",
                    interview_id=interview_id,
                )
            )

            assert created_candidate.success is True
            assert created_candidate.request_id
            assert created_candidate.data.email == candidate_email
            assert created_candidate.data.interview_id == interview_id
            assert f"/interview/{interview_id}" in created_candidate.data.interview_url

            fetched_candidate = client.candidates.get(candidate_email)

            assert fetched_candidate.success is True
            assert fetched_candidate.request_id
            assert fetched_candidate.data.email == candidate_email
            assert any(
                getattr(item, "interview_id", None) == interview_id
                for item in fetched_candidate.data.interviews
            )
        except BaseException as exc:
            test_error = exc
            raise
        finally:
            if interview_id is not None:
                try:
                    deleted = client.interviews.delete(interview_id)
                    assert deleted.success is True
                    assert deleted.request_id
                    assert deleted.data.deleted is True
                except Exception as cleanup_exc:
                    message = (
                        "Failed to delete live integration interview "
                        f"{interview_id}. Remove it manually if it still exists."
                    )
                    if test_error is None:
                        raise AssertionError(message) from cleanup_exc
                    warnings.warn(message, stacklevel=2)


def test_sync_client_manages_webhook_lifecycle() -> None:
    config = load_integration_config()
    suffix = uuid.uuid4().hex[:12]
    url = f"https://example.com/mukhtabir/python/{suffix}"
    initial_description = f"Python Integration Webhook {suffix}"
    updated_description = f"{initial_description} Updated"
    webhook_id: str | None = None
    test_error: BaseException | None = None

    with make_sync_client(config) as client:
        try:
            created = client.webhooks.create(
                CreateWebhookRequest(
                    url=url,
                    events=["interview.created"],
                    description=initial_description,
                )
            )

            assert created.success is True
            assert created.request_id
            webhook_id = created.data.id
            assert webhook_id
            assert created.data.url == url
            assert created.data.description == initial_description
            assert "interview.created" in created.data.events
            assert created.data.secret
            assert created.data.secret_preview == f"{created.data.secret[:8]}..."

            fetched = client.webhooks.get(webhook_id)

            assert fetched.success is True
            assert fetched.request_id
            assert fetched.data.id == webhook_id
            assert fetched.data.url == url
            assert fetched.data.description == initial_description
            assert "interview.created" in fetched.data.events

            page = client.webhooks.list(page=1, page_size=10)

            assert page.success is True
            assert page.pagination.page >= 1
            assert page.pagination.page_size >= 1
            assert isinstance(page.data, list)
            assert page.request_id
            assert any(item.id == webhook_id for item in page.data)

            updated = client.webhooks.update(
                webhook_id,
                UpdateWebhookRequest(
                    description=updated_description,
                    is_active=False,
                ),
            )

            assert updated.success is True
            assert updated.request_id
            assert updated.data.id == webhook_id
            assert updated.data.description == updated_description
            assert updated.data.is_active is False

            refreshed = client.webhooks.get(webhook_id)

            assert refreshed.success is True
            assert refreshed.data.id == webhook_id
            assert refreshed.data.description == updated_description
            assert refreshed.data.is_active is False
        except BaseException as exc:
            test_error = exc
            raise
        finally:
            if webhook_id is not None:
                try:
                    deleted = client.webhooks.delete(webhook_id)
                    assert deleted.success is True
                    assert deleted.request_id
                    assert deleted.data.deleted is True
                except Exception as cleanup_exc:
                    message = (
                        "Failed to delete live integration webhook "
                        f"{webhook_id}. Remove it manually if it still exists."
                    )
                    if test_error is None:
                        raise AssertionError(message) from cleanup_exc
                    warnings.warn(message, stacklevel=2)
