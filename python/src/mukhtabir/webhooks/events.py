from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, TypeAlias, cast

from .._parsing import (
    JSONMapping,
    expect_mapping,
    get_float,
    get_str,
    get_value,
    parse_model_list,
    require_str,
)

WebhookEventType = Literal[
    "interview.created",
    "interview.published",
    "interview.started",
    "interview.completed",
    "evaluation.generated",
    "candidate.invited",
]


@dataclass(frozen=True, slots=True)
class WebhookCategoryScore:
    name: str
    score: float | None

    @classmethod
    def from_payload(cls, payload: Any) -> WebhookCategoryScore:
        data = expect_mapping(payload, context="webhook_category_score")
        return cls(
            name=require_str(data, "name"),
            score=get_float(data, "score"),
        )


@dataclass(frozen=True, slots=True)
class InterviewCreatedEventData:
    interview_id: str | None
    role: str | None
    type: str | None


@dataclass(frozen=True, slots=True)
class InterviewPublishedEventData:
    interview_id: str | None


@dataclass(frozen=True, slots=True)
class InterviewStartedEventData:
    interview_id: str | None
    candidate_email: str | None


@dataclass(frozen=True, slots=True)
class InterviewCompletedEventData:
    interview_id: str | None
    feedback_id: str | None
    candidate_email: str | None


@dataclass(frozen=True, slots=True)
class EvaluationGeneratedEventData:
    feedback_id: str | None
    total_score: float | None
    category_scores: list[WebhookCategoryScore] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class CandidateInvitedEventData:
    interview_id: str | None
    candidate_email: str | None
    candidate_name: str | None


@dataclass(frozen=True, slots=True)
class UnknownWebhookData:
    values: dict[str, Any]


@dataclass(frozen=True, slots=True)
class InterviewCreatedWebhookPayload:
    event: Literal["interview.created"]
    timestamp: str
    data: InterviewCreatedEventData


@dataclass(frozen=True, slots=True)
class InterviewPublishedWebhookPayload:
    event: Literal["interview.published"]
    timestamp: str
    data: InterviewPublishedEventData


@dataclass(frozen=True, slots=True)
class InterviewStartedWebhookPayload:
    event: Literal["interview.started"]
    timestamp: str
    data: InterviewStartedEventData


@dataclass(frozen=True, slots=True)
class InterviewCompletedWebhookPayload:
    event: Literal["interview.completed"]
    timestamp: str
    data: InterviewCompletedEventData


@dataclass(frozen=True, slots=True)
class EvaluationGeneratedWebhookPayload:
    event: Literal["evaluation.generated"]
    timestamp: str
    data: EvaluationGeneratedEventData


@dataclass(frozen=True, slots=True)
class CandidateInvitedWebhookPayload:
    event: Literal["candidate.invited"]
    timestamp: str
    data: CandidateInvitedEventData


@dataclass(frozen=True, slots=True)
class UnknownWebhookPayload:
    event: str
    timestamp: str
    data: UnknownWebhookData


KnownWebhookPayload: TypeAlias = (
    InterviewCreatedWebhookPayload
    | InterviewPublishedWebhookPayload
    | InterviewStartedWebhookPayload
    | InterviewCompletedWebhookPayload
    | EvaluationGeneratedWebhookPayload
    | CandidateInvitedWebhookPayload
)

WebhookPayload: TypeAlias = KnownWebhookPayload | UnknownWebhookPayload


def _parse_interview_created(
    timestamp: str,
    raw_data: JSONMapping,
) -> InterviewCreatedWebhookPayload:
    return InterviewCreatedWebhookPayload(
        event="interview.created",
        timestamp=timestamp,
        data=InterviewCreatedEventData(
            interview_id=get_str(raw_data, "interview_id", "interviewId"),
            role=get_str(raw_data, "role"),
            type=get_str(raw_data, "type"),
        ),
    )


def _parse_interview_published(
    timestamp: str,
    raw_data: JSONMapping,
) -> InterviewPublishedWebhookPayload:
    return InterviewPublishedWebhookPayload(
        event="interview.published",
        timestamp=timestamp,
        data=InterviewPublishedEventData(
            interview_id=get_str(raw_data, "interview_id", "interviewId"),
        ),
    )


def _parse_interview_started(
    timestamp: str,
    raw_data: JSONMapping,
) -> InterviewStartedWebhookPayload:
    return InterviewStartedWebhookPayload(
        event="interview.started",
        timestamp=timestamp,
        data=InterviewStartedEventData(
            interview_id=get_str(raw_data, "interview_id", "interviewId"),
            candidate_email=get_str(raw_data, "candidate_email", "candidateEmail"),
        ),
    )


def _parse_interview_completed(
    timestamp: str,
    raw_data: JSONMapping,
) -> InterviewCompletedWebhookPayload:
    return InterviewCompletedWebhookPayload(
        event="interview.completed",
        timestamp=timestamp,
        data=InterviewCompletedEventData(
            interview_id=get_str(raw_data, "interview_id", "interviewId"),
            feedback_id=get_str(raw_data, "feedback_id", "feedbackId"),
            candidate_email=get_str(raw_data, "candidate_email", "candidateEmail"),
        ),
    )


def _parse_evaluation_generated(
    timestamp: str,
    raw_data: JSONMapping,
) -> EvaluationGeneratedWebhookPayload:
    return EvaluationGeneratedWebhookPayload(
        event="evaluation.generated",
        timestamp=timestamp,
        data=EvaluationGeneratedEventData(
            feedback_id=get_str(raw_data, "feedback_id", "feedbackId"),
            total_score=get_float(raw_data, "total_score", "totalScore"),
            category_scores=parse_model_list(
                raw_data.get("category_scores", raw_data.get("categoryScores", [])),
                WebhookCategoryScore.from_payload,
                context="webhook_payload.data.category_scores",
            ),
        ),
    )


def _parse_candidate_invited(
    timestamp: str,
    raw_data: JSONMapping,
) -> CandidateInvitedWebhookPayload:
    return CandidateInvitedWebhookPayload(
        event="candidate.invited",
        timestamp=timestamp,
        data=CandidateInvitedEventData(
            interview_id=get_str(raw_data, "interview_id", "interviewId"),
            candidate_email=get_str(raw_data, "candidate_email", "candidateEmail"),
            candidate_name=get_str(raw_data, "candidate_name", "candidateName"),
        ),
    )


WebhookPayloadParser = Callable[[str, JSONMapping], KnownWebhookPayload]

_KNOWN_WEBHOOK_PARSERS: dict[WebhookEventType, WebhookPayloadParser] = {
    "interview.created": _parse_interview_created,
    "interview.published": _parse_interview_published,
    "interview.started": _parse_interview_started,
    "interview.completed": _parse_interview_completed,
    "evaluation.generated": _parse_evaluation_generated,
    "candidate.invited": _parse_candidate_invited,
}


def parse_webhook_payload(payload: bytes | str | dict[str, Any]) -> WebhookPayload:
    if isinstance(payload, bytes):
        loaded = json.loads(payload.decode("utf-8"))
    elif isinstance(payload, str):
        loaded = json.loads(payload)
    else:
        loaded = payload

    data = expect_mapping(loaded, context="webhook_payload")
    event = require_str(data, "event")
    timestamp = require_str(data, "timestamp")
    raw_data = expect_mapping(get_value(data, "data"), context="webhook_payload.data")

    parser = _KNOWN_WEBHOOK_PARSERS.get(cast(WebhookEventType, event))
    if parser is not None:
        return parser(timestamp, raw_data)

    return UnknownWebhookPayload(
        event=event,
        timestamp=timestamp,
        data=UnknownWebhookData(values=dict(raw_data)),
    )


__all__ = [
    "CandidateInvitedEventData",
    "CandidateInvitedWebhookPayload",
    "EvaluationGeneratedEventData",
    "EvaluationGeneratedWebhookPayload",
    "InterviewCompletedEventData",
    "InterviewCompletedWebhookPayload",
    "InterviewCreatedEventData",
    "InterviewCreatedWebhookPayload",
    "InterviewPublishedEventData",
    "InterviewPublishedWebhookPayload",
    "InterviewStartedEventData",
    "InterviewStartedWebhookPayload",
    "UnknownWebhookData",
    "UnknownWebhookPayload",
    "WebhookCategoryScore",
    "WebhookEventType",
    "WebhookPayload",
    "parse_webhook_payload",
]
