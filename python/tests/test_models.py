from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest

import mukhtabir.models as model_namespace
from mukhtabir.errors import UnexpectedResponseError
from mukhtabir.models import (
    AddCriteriaRequest,
    AddQuestionRequest,
    AddSubquestionRequest,
    CandidateRegistration,
    CreateInterviewRequest,
    CriteriaCreateResult,
    CriteriaDeleteResult,
    CriteriaUpdateResult,
    FeedbackDetails,
    InterviewAnalytics,
    InterviewDetails,
    InterviewInvite,
    InterviewSummary,
    QuestionCreateResult,
    QuestionDeleteResult,
    QuestionUpdateResult,
    SubquestionCreateResult,
    SubquestionDeleteResult,
    SubquestionUpdateResult,
    UpdateCriteriaRequest,
    UpdateQuestionRequest,
    UpdateSubquestionRequest,
)
from mukhtabir.webhooks import (
    CreateWebhookRequest,
    UnknownWebhookPayload,
    UpdateWebhookRequest,
    WebhookCreateResult,
    parse_webhook_payload,
)


def test_request_models_compact_optional_fields() -> None:
    create_payload = CreateInterviewRequest(role="Platform Engineer").to_payload()
    add_question_payload = AddQuestionRequest(
        question="Explain database indexes.",
        subquestions=["What tradeoffs matter most?"],
    ).to_payload()
    update_question_payload = UpdateQuestionRequest(disabled=True).to_payload()
    add_subquestion_payload = AddSubquestionRequest(
        subquestion="Give a production example."
    ).to_payload()
    update_subquestion_payload = UpdateSubquestionRequest(order_index=3).to_payload()
    add_criteria_payload = AddCriteriaRequest(criteria_title="Communication").to_payload()
    update_criteria_payload = UpdateCriteriaRequest(description="Clear and structured").to_payload()
    webhook_payload = UpdateWebhookRequest(
        url="https://example.test/webhooks/mukhtabir",
        is_active=True,
    ).to_payload()

    assert create_payload == {
        "role": "Platform Engineer",
        "type": "technical",
        "level": "mid",
        "duration": 30,
        "max_score": 100,
        "visibility": "private",
    }
    assert add_question_payload == {
        "question": "Explain database indexes.",
        "subquestions": ["What tradeoffs matter most?"],
    }
    assert update_question_payload == {"disabled": True}
    assert add_subquestion_payload == {"subquestion": "Give a production example."}
    assert update_subquestion_payload == {"order_index": 3}
    assert add_criteria_payload == {"criteria_title": "Communication"}
    assert update_criteria_payload == {"description": "Clear and structured"}
    assert webhook_payload == {
        "url": "https://example.test/webhooks/mukhtabir",
        "is_active": True,
    }


def test_interview_analytics_parses_backend_variants() -> None:
    analytics = InterviewAnalytics.from_payload(
        {
            "interviewId": "int_123",
            "maxPossibleScore": 100,
            "totalCandidates": 5,
            "evaluatedCount": 3,
            "averageScore": 88.5,
            "minScore": 70,
            "maxScore": 97,
            "averageDurationSeconds": 1240,
            "categoryAverages": [
                {
                    "name": "Technical Knowledge",
                    "averageScore": 90,
                    "sampleCount": 3,
                }
            ],
            "completion": {"pending": 2, "completed": 3},
        }
    )

    assert analytics.interview_id == "int_123"
    assert analytics.average_score == 88.5
    assert analytics.category_averages[0].average_score == 90
    assert analytics.completion.pending == 2
    assert analytics.completion.completed == 3


def test_nested_interview_mutation_results_parse_backend_variants() -> None:
    question_created = QuestionCreateResult.from_payload(
        {"questionId": "q_123", "interviewId": "int_123", "orderIndex": 4}
    )
    question_updated = QuestionUpdateResult.from_payload({"question_id": "q_123", "updated": True})
    question_deleted = QuestionDeleteResult.from_payload({"question_id": "q_123", "deleted": True})
    subquestion_created = SubquestionCreateResult.from_payload(
        {
            "subquestion_id": "sq_123",
            "question_id": "q_123",
            "interview_id": "int_123",
            "order_index": 2,
        }
    )
    subquestion_updated = SubquestionUpdateResult.from_payload(
        {"subquestionId": "sq_123", "updated": True}
    )
    subquestion_deleted = SubquestionDeleteResult.from_payload(
        {"subquestionId": "sq_123", "deleted": True}
    )
    criteria_created = CriteriaCreateResult.from_payload(
        {"criteriaId": "c_123", "interviewId": "int_123", "orderIndex": 1}
    )
    criteria_updated = CriteriaUpdateResult.from_payload({"criteria_id": "c_123", "updated": True})
    criteria_deleted = CriteriaDeleteResult.from_payload({"criteria_id": "c_123", "deleted": True})

    assert question_created.question_id == "q_123"
    assert question_created.order_index == 4
    assert question_updated.updated is True
    assert question_deleted.deleted is True
    assert subquestion_created.interview_id == "int_123"
    assert subquestion_created.order_index == 2
    assert subquestion_updated.subquestion_id == "sq_123"
    assert subquestion_deleted.deleted is True
    assert criteria_created.criteria_id == "c_123"
    assert criteria_created.order_index == 1
    assert criteria_updated.updated is True
    assert criteria_deleted.deleted is True


def test_interview_detail_parses_nested_ids_and_ordering_when_present() -> None:
    interview = InterviewDetails.from_payload(
        {
            "id": "int_123",
            "role": "Platform Engineer",
            "type": "technical",
            "level": "senior",
            "duration": 30,
            "questions": [
                {
                    "question_id": "q_123",
                    "question": "Design an API.",
                    "order_index": 1,
                    "subquestions": [
                        {
                            "subquestion_id": "sq_123",
                            "subquestion": "How would you version it?",
                            "order_index": 2,
                        }
                    ],
                }
            ],
            "evaluation_criteria": [
                {
                    "criteria_id": "c_123",
                    "criteria_title": "System design",
                    "order_index": 0,
                }
            ],
        }
    )

    assert interview.questions[0].id == "q_123"
    assert interview.questions[0].order_index == 1
    assert interview.questions[0].subquestions[0].id == "sq_123"
    assert interview.questions[0].subquestions[0].order_index == 2
    assert interview.evaluation_criteria[0].id == "c_123"
    assert interview.evaluation_criteria[0].order_index == 0


def test_parse_webhook_payload_returns_unknown_variant() -> None:
    payload = parse_webhook_payload(
        {
            "event": "candidate.reminded",
            "timestamp": "2026-03-14T09:00:00Z",
            "data": {"candidate_email": "candidate@example.com"},
        }
    )

    assert isinstance(payload, UnknownWebhookPayload)
    assert payload.event == "candidate.reminded"
    assert payload.data.values == {"candidate_email": "candidate@example.com"}


def test_models_namespace_uses_deprecated_webhook_compat_shim() -> None:
    assert "CreateWebhookRequest" not in model_namespace.__all__
    assert "WebhookDetails" not in model_namespace.__all__

    with pytest.warns(
        DeprecationWarning,
        match="Importing CreateWebhookRequest from 'mukhtabir.models' is deprecated",
    ):
        compat_export = model_namespace.CreateWebhookRequest

    assert compat_export is CreateWebhookRequest


def test_repr_redacts_candidate_access_tokens() -> None:
    registration = CandidateRegistration.from_payload(
        {
            "email": "candidate@example.com",
            "name": "Sarah Al-Rashid",
            "access_token": "token_123",
            "interview_url": "https://example.test/interview",
            "expires_at": "2026-03-14T10:00:00Z",
            "interview_id": "int_123",
        }
    )
    invite = InterviewInvite.from_payload(
        {
            "access_token": "token_456",
            "interview_url": "https://example.test/interview",
            "expires_at": "2026-03-14T10:00:00Z",
            "candidate_email": "candidate@example.com",
            "candidate_name": "Sarah Al-Rashid",
        }
    )

    assert "token_123" not in repr(registration)
    assert "access_token" not in repr(registration)
    assert "token_456" not in repr(invite)
    assert "access_token" not in repr(invite)


def test_repr_redacts_webhook_secret() -> None:
    webhook = WebhookCreateResult.from_payload(
        {
            "id": "wh_123",
            "url": "https://example.test/webhooks/mukhtabir",
            "events": ["evaluation.generated"],
            "description": "Primary webhook",
            "secret_preview": "whsec_***",
            "secret": "whsec_live_secret",
            "is_active": True,
            "created_at": "2026-03-14T10:00:00Z",
        }
    )

    assert webhook.secret == "whsec_live_secret"
    assert "whsec_live_secret" not in repr(webhook)
    assert "secret=" not in repr(webhook)


@pytest.mark.parametrize(
    ("parser", "payload", "message"),
    [
        (
            FeedbackDetails.from_payload,
            {
                "id": "fb_123",
                "interview_id": "int_123",
                "strengths": ["clear communication", 3],
            },
            "Expected a string for feedback_details.strengths[1].",
        ),
        (
            FeedbackDetails.from_payload,
            {
                "id": "fb_123",
                "interview_id": "int_123",
                "areas_for_improvement": "needs structure",
            },
            "Expected an array for feedback_details.areas_for_improvement.",
        ),
        (
            InterviewDetails.from_payload,
            {
                "id": "int_123",
                "role": "Platform Engineer",
                "type": "technical",
                "level": "mid",
                "duration": 30,
                "techstack": ["Python", 3],
            },
            "Expected a string for interview_details.techstack[1].",
        ),
    ],
)
def test_model_parsers_reject_malformed_string_lists(
    parser: Callable[[Any], object],
    payload: Any,
    message: str,
) -> None:
    with pytest.raises(UnexpectedResponseError) as exc_info:
        parser(payload)
    assert str(exc_info.value) == message


@pytest.mark.parametrize(
    ("parser", "payload"),
    [
        (InterviewSummary.from_payload, {}),
        (CandidateRegistration.from_payload, {}),
        (WebhookCreateResult.from_payload, {}),
        (parse_webhook_payload, {"timestamp": "2026-03-14T09:00:00Z", "data": {}}),
    ],
)
def test_model_parsers_raise_on_missing_required_fields(
    parser: Callable[[Any], object],
    payload: Any,
) -> None:
    with pytest.raises(UnexpectedResponseError, match="Missing expected field"):
        parser(payload)
