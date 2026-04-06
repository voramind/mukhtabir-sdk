from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Generic, TypeVar, overload
from urllib.parse import quote

from .._parsing import expect_mapping, get_bool
from .._transport import AsyncTransport, SyncTransport
from ..models.candidates import (
    CandidateDetails,
    CandidateRegistration,
    CandidateSummary,
    CreateCandidateRequest,
    InterviewInvite,
    InviteCandidateRequest,
)
from ..models.common import ApiResponse, DeleteResult, PaginatedResponse
from ..models.feedback import FeedbackDetails, FeedbackSummary, RecordingUrl, Transcript
from ..models.interviews import (
    AddCriteriaRequest,
    AddQuestionRequest,
    AddSubquestionRequest,
    CreateInterviewRequest,
    CreateInterviewResult,
    CriteriaCreateResult,
    CriteriaDeleteResult,
    CriteriaUpdateResult,
    InterviewAnalytics,
    InterviewDetails,
    InterviewSummary,
    PublishInterviewResult,
    QuestionCreateResult,
    QuestionDeleteResult,
    QuestionUpdateResult,
    SubquestionCreateResult,
    SubquestionDeleteResult,
    SubquestionUpdateResult,
    UpdateCriteriaRequest,
    UpdateInterviewRequest,
    UpdateQuestionRequest,
    UpdateSubquestionRequest,
)
from ..webhooks import (
    CreateWebhookRequest,
    UpdateWebhookRequest,
    WebhookCreateResult,
    WebhookDelivery,
    WebhookDetails,
    WebhookTestResult,
)

T = TypeVar("T")
PayloadParser = Callable[[Any], T]


@dataclass(frozen=True, slots=True)
class RequestSpec(Generic[T]):
    method: str
    path: str
    parser: PayloadParser[T]
    params: Mapping[str, Any] | None = None
    json_body: Mapping[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class PaginatedRequestSpec(Generic[T]):
    method: str
    path: str
    parser: PayloadParser[T]
    params: Mapping[str, Any] | None = None
    json_body: Mapping[str, Any] | None = None


def _page_params(page: int, page_size: int) -> dict[str, int]:
    return {"page": page, "page_size": page_size}


def _resource_path(resource: str, identifier: str, *suffixes: str) -> str:
    segments = [resource.strip("/"), quote(identifier, safe="")]
    segments.extend(quote(suffix.strip("/"), safe="") for suffix in suffixes)
    return "/" + "/".join(segments)


def _parse_delete_result(payload: Any) -> DeleteResult:
    data = expect_mapping(payload, context="delete_result")
    deleted = get_bool(data, "deleted", default=False)
    return DeleteResult(deleted=deleted or False)


@overload
def execute_sync(transport: SyncTransport, spec: RequestSpec[T]) -> ApiResponse[T]: ...


@overload
def execute_sync(
    transport: SyncTransport,
    spec: PaginatedRequestSpec[T],
) -> PaginatedResponse[T]: ...


def execute_sync(
    transport: SyncTransport,
    spec: RequestSpec[T] | PaginatedRequestSpec[T],
) -> ApiResponse[T] | PaginatedResponse[T]:
    if isinstance(spec, PaginatedRequestSpec):
        return transport.request_paginated(
            spec.method,
            spec.path,
            parser=spec.parser,
            params=spec.params,
            json_body=spec.json_body,
        )
    return transport.request(
        spec.method,
        spec.path,
        parser=spec.parser,
        params=spec.params,
        json_body=spec.json_body,
    )


@overload
async def execute_async(
    transport: AsyncTransport,
    spec: RequestSpec[T],
) -> ApiResponse[T]: ...


@overload
async def execute_async(
    transport: AsyncTransport,
    spec: PaginatedRequestSpec[T],
) -> PaginatedResponse[T]: ...


async def execute_async(
    transport: AsyncTransport,
    spec: RequestSpec[T] | PaginatedRequestSpec[T],
) -> ApiResponse[T] | PaginatedResponse[T]:
    if isinstance(spec, PaginatedRequestSpec):
        return await transport.request_paginated(
            spec.method,
            spec.path,
            parser=spec.parser,
            params=spec.params,
            json_body=spec.json_body,
        )
    return await transport.request(
        spec.method,
        spec.path,
        parser=spec.parser,
        params=spec.params,
        json_body=spec.json_body,
    )


def candidate_create_spec(request: CreateCandidateRequest) -> RequestSpec[CandidateRegistration]:
    return RequestSpec(
        method="POST",
        path="/candidates",
        parser=CandidateRegistration.from_payload,
        json_body=request.to_payload(),
    )


def candidate_list_spec(*, page: int, page_size: int) -> PaginatedRequestSpec[CandidateSummary]:
    return PaginatedRequestSpec(
        method="GET",
        path="/candidates",
        parser=CandidateSummary.from_payload,
        params=_page_params(page, page_size),
    )


def candidate_get_spec(email: str) -> RequestSpec[CandidateDetails]:
    return RequestSpec(
        method="GET",
        path=_resource_path("candidates", email),
        parser=CandidateDetails.from_payload,
    )


def feedback_get_spec(feedback_id: str) -> RequestSpec[FeedbackDetails]:
    return RequestSpec(
        method="GET",
        path=_resource_path("feedback", feedback_id),
        parser=FeedbackDetails.from_payload,
    )


def feedback_transcript_spec(feedback_id: str) -> RequestSpec[Transcript]:
    return RequestSpec(
        method="GET",
        path=_resource_path("feedback", feedback_id, "transcript"),
        parser=Transcript.from_payload,
    )


def feedback_recording_url_spec(feedback_id: str) -> RequestSpec[RecordingUrl]:
    return RequestSpec(
        method="GET",
        path=_resource_path("feedback", feedback_id, "recording-url"),
        parser=RecordingUrl.from_payload,
    )


def interview_create_spec(request: CreateInterviewRequest) -> RequestSpec[CreateInterviewResult]:
    return RequestSpec(
        method="POST",
        path="/interviews",
        parser=CreateInterviewResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_list_spec(*, page: int, page_size: int) -> PaginatedRequestSpec[InterviewSummary]:
    return PaginatedRequestSpec(
        method="GET",
        path="/interviews",
        parser=InterviewSummary.from_payload,
        params=_page_params(page, page_size),
    )


def interview_get_spec(interview_id: str) -> RequestSpec[InterviewDetails]:
    return RequestSpec(
        method="GET",
        path=_resource_path("interviews", interview_id),
        parser=InterviewDetails.from_payload,
    )


def interview_update_spec(
    interview_id: str,
    request: UpdateInterviewRequest,
) -> RequestSpec[InterviewDetails]:
    return RequestSpec(
        method="PATCH",
        path=_resource_path("interviews", interview_id),
        parser=InterviewDetails.from_payload,
        json_body=request.to_payload(),
    )


def interview_delete_spec(interview_id: str) -> RequestSpec[DeleteResult]:
    return RequestSpec(
        method="DELETE",
        path=_resource_path("interviews", interview_id),
        parser=_parse_delete_result,
    )


def interview_publish_spec(interview_id: str) -> RequestSpec[PublishInterviewResult]:
    return RequestSpec(
        method="POST",
        path=_resource_path("interviews", interview_id, "publish"),
        parser=PublishInterviewResult.from_payload,
    )


def interview_invite_spec(
    interview_id: str,
    request: InviteCandidateRequest,
) -> RequestSpec[InterviewInvite]:
    return RequestSpec(
        method="POST",
        path=_resource_path("interviews", interview_id, "invite"),
        parser=InterviewInvite.from_payload,
        json_body=request.to_payload(),
    )


def interview_results_spec(
    interview_id: str,
    *,
    page: int,
    page_size: int,
) -> PaginatedRequestSpec[FeedbackSummary]:
    return PaginatedRequestSpec(
        method="GET",
        path=_resource_path("interviews", interview_id, "results"),
        parser=FeedbackSummary.from_payload,
        params=_page_params(page, page_size),
    )


def interview_analytics_spec(interview_id: str) -> RequestSpec[InterviewAnalytics]:
    return RequestSpec(
        method="GET",
        path=_resource_path("interviews", interview_id, "analytics"),
        parser=InterviewAnalytics.from_payload,
    )


def interview_add_question_spec(
    interview_id: str,
    request: AddQuestionRequest,
) -> RequestSpec[QuestionCreateResult]:
    return RequestSpec(
        method="POST",
        path=_resource_path("interviews", interview_id, "questions"),
        parser=QuestionCreateResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_update_question_spec(
    interview_id: str,
    question_id: str,
    request: UpdateQuestionRequest,
) -> RequestSpec[QuestionUpdateResult]:
    return RequestSpec(
        method="PATCH",
        path=_resource_path("interviews", interview_id, "questions", question_id),
        parser=QuestionUpdateResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_delete_question_spec(
    interview_id: str,
    question_id: str,
) -> RequestSpec[QuestionDeleteResult]:
    return RequestSpec(
        method="DELETE",
        path=_resource_path("interviews", interview_id, "questions", question_id),
        parser=QuestionDeleteResult.from_payload,
    )


def interview_add_subquestion_spec(
    interview_id: str,
    question_id: str,
    request: AddSubquestionRequest,
) -> RequestSpec[SubquestionCreateResult]:
    return RequestSpec(
        method="POST",
        path=_resource_path("interviews", interview_id, "questions", question_id, "subquestions"),
        parser=SubquestionCreateResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_update_subquestion_spec(
    interview_id: str,
    question_id: str,
    subquestion_id: str,
    request: UpdateSubquestionRequest,
) -> RequestSpec[SubquestionUpdateResult]:
    return RequestSpec(
        method="PATCH",
        path=_resource_path(
            "interviews",
            interview_id,
            "questions",
            question_id,
            "subquestions",
            subquestion_id,
        ),
        parser=SubquestionUpdateResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_delete_subquestion_spec(
    interview_id: str,
    question_id: str,
    subquestion_id: str,
) -> RequestSpec[SubquestionDeleteResult]:
    return RequestSpec(
        method="DELETE",
        path=_resource_path(
            "interviews",
            interview_id,
            "questions",
            question_id,
            "subquestions",
            subquestion_id,
        ),
        parser=SubquestionDeleteResult.from_payload,
    )


def interview_add_criteria_spec(
    interview_id: str,
    request: AddCriteriaRequest,
) -> RequestSpec[CriteriaCreateResult]:
    return RequestSpec(
        method="POST",
        path=_resource_path("interviews", interview_id, "criteria"),
        parser=CriteriaCreateResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_update_criteria_spec(
    interview_id: str,
    criteria_id: str,
    request: UpdateCriteriaRequest,
) -> RequestSpec[CriteriaUpdateResult]:
    return RequestSpec(
        method="PATCH",
        path=_resource_path("interviews", interview_id, "criteria", criteria_id),
        parser=CriteriaUpdateResult.from_payload,
        json_body=request.to_payload(),
    )


def interview_delete_criteria_spec(
    interview_id: str,
    criteria_id: str,
) -> RequestSpec[CriteriaDeleteResult]:
    return RequestSpec(
        method="DELETE",
        path=_resource_path("interviews", interview_id, "criteria", criteria_id),
        parser=CriteriaDeleteResult.from_payload,
    )


def webhook_create_spec(request: CreateWebhookRequest) -> RequestSpec[WebhookCreateResult]:
    return RequestSpec(
        method="POST",
        path="/webhooks",
        parser=WebhookCreateResult.from_payload,
        json_body=request.to_payload(),
    )


def webhook_list_spec(*, page: int, page_size: int) -> PaginatedRequestSpec[WebhookDetails]:
    return PaginatedRequestSpec(
        method="GET",
        path="/webhooks",
        parser=WebhookDetails.from_payload,
        params=_page_params(page, page_size),
    )


def webhook_get_spec(webhook_id: str) -> RequestSpec[WebhookDetails]:
    return RequestSpec(
        method="GET",
        path=_resource_path("webhooks", webhook_id),
        parser=WebhookDetails.from_payload,
    )


def webhook_update_spec(
    webhook_id: str,
    request: UpdateWebhookRequest,
) -> RequestSpec[WebhookDetails]:
    return RequestSpec(
        method="PATCH",
        path=_resource_path("webhooks", webhook_id),
        parser=WebhookDetails.from_payload,
        json_body=request.to_payload(),
    )


def webhook_delete_spec(webhook_id: str) -> RequestSpec[DeleteResult]:
    return RequestSpec(
        method="DELETE",
        path=_resource_path("webhooks", webhook_id),
        parser=_parse_delete_result,
    )


def webhook_test_spec(webhook_id: str) -> RequestSpec[WebhookTestResult]:
    return RequestSpec(
        method="POST",
        path=_resource_path("webhooks", webhook_id, "test"),
        parser=WebhookTestResult.from_payload,
    )


def webhook_deliveries_spec(
    webhook_id: str,
    *,
    page: int,
    page_size: int,
) -> PaginatedRequestSpec[WebhookDelivery]:
    return PaginatedRequestSpec(
        method="GET",
        path=_resource_path("webhooks", webhook_id, "deliveries"),
        parser=WebhookDelivery.from_payload,
        params=_page_params(page, page_size),
    )


__all__ = [
    "PaginatedRequestSpec",
    "RequestSpec",
    "candidate_create_spec",
    "candidate_get_spec",
    "candidate_list_spec",
    "execute_async",
    "execute_sync",
    "feedback_get_spec",
    "feedback_recording_url_spec",
    "feedback_transcript_spec",
    "interview_add_criteria_spec",
    "interview_add_question_spec",
    "interview_add_subquestion_spec",
    "interview_analytics_spec",
    "interview_create_spec",
    "interview_delete_criteria_spec",
    "interview_delete_spec",
    "interview_delete_question_spec",
    "interview_delete_subquestion_spec",
    "interview_get_spec",
    "interview_invite_spec",
    "interview_list_spec",
    "interview_publish_spec",
    "interview_results_spec",
    "interview_update_criteria_spec",
    "interview_update_question_spec",
    "interview_update_spec",
    "interview_update_subquestion_spec",
    "webhook_create_spec",
    "webhook_delete_spec",
    "webhook_deliveries_spec",
    "webhook_get_spec",
    "webhook_list_spec",
    "webhook_test_spec",
    "webhook_update_spec",
]
