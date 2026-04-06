from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .._parsing import (
    expect_mapping,
    get_float,
    get_int,
    get_str,
    parse_model_list,
    parse_string_list,
    require_str,
)


@dataclass(frozen=True, slots=True)
class CategoryScore:
    name: str
    score: float | None
    comment: str | None = None

    @classmethod
    def from_payload(cls, payload: Any) -> CategoryScore:
        data = expect_mapping(payload, context="category_score")
        return cls(
            name=require_str(data, "name"),
            score=get_float(data, "score"),
            comment=get_str(data, "comment"),
        )


@dataclass(frozen=True, slots=True)
class FeedbackSummary:
    id: str
    interview_id: str
    total_score: float | None
    interviewee_email: str | None
    interviewee_name: str | None
    interview_duration: int | None
    evaluation_model: str | None
    category_scores: list[CategoryScore] = field(default_factory=list)
    created_at: str | None = None
    evaluated_at: str | None = None

    @classmethod
    def from_payload(cls, payload: Any) -> FeedbackSummary:
        data = expect_mapping(payload, context="feedback_summary")
        category_scores = parse_model_list(
            data.get("category_scores", []),
            CategoryScore.from_payload,
            context="feedback_summary.category_scores",
        )
        return cls(
            id=require_str(data, "id"),
            interview_id=require_str(data, "interview_id", "interviewId"),
            total_score=get_float(data, "total_score", "totalScore"),
            interviewee_email=get_str(data, "interviewee_email", "intervieweeEmail"),
            interviewee_name=get_str(data, "interviewee_name", "intervieweeName"),
            interview_duration=get_int(data, "interview_duration", "interviewDuration"),
            evaluation_model=get_str(data, "evaluation_model", "evaluationModel"),
            category_scores=category_scores,
            created_at=get_str(data, "created_at", "createdAt"),
            evaluated_at=get_str(data, "evaluated_at", "evaluatedAt"),
        )


@dataclass(frozen=True, slots=True)
class FeedbackDetails:
    id: str
    interview_id: str
    total_score: float | None
    interviewee_email: str | None
    interviewee_name: str | None
    interview_duration: int | None
    evaluation_model: str | None
    resume_file_name: str | None
    category_scores: list[CategoryScore] = field(default_factory=list)
    strengths: list[str] = field(default_factory=list)
    areas_for_improvement: list[str] = field(default_factory=list)
    final_assessment: str | None = None
    created_at: str | None = None
    evaluated_at: str | None = None

    @classmethod
    def from_payload(cls, payload: Any) -> FeedbackDetails:
        data = expect_mapping(payload, context="feedback_details")
        return cls(
            id=require_str(data, "id"),
            interview_id=require_str(data, "interview_id", "interviewId"),
            total_score=get_float(data, "total_score", "totalScore"),
            interviewee_email=get_str(data, "interviewee_email", "intervieweeEmail"),
            interviewee_name=get_str(data, "interviewee_name", "intervieweeName"),
            interview_duration=get_int(data, "interview_duration", "interviewDuration"),
            evaluation_model=get_str(data, "evaluation_model", "evaluationModel"),
            resume_file_name=get_str(data, "resume_file_name", "resumeFileName"),
            category_scores=parse_model_list(
                data.get("category_scores", []),
                CategoryScore.from_payload,
                context="feedback_details.category_scores",
            ),
            strengths=parse_string_list(
                data.get("strengths", []),
                context="feedback_details.strengths",
            ),
            areas_for_improvement=parse_string_list(
                data.get("areas_for_improvement", []),
                context="feedback_details.areas_for_improvement",
            ),
            final_assessment=get_str(data, "final_assessment", "finalAssessment"),
            created_at=get_str(data, "created_at", "createdAt"),
            evaluated_at=get_str(data, "evaluated_at", "evaluatedAt"),
        )


@dataclass(frozen=True, slots=True)
class Transcript:
    feedback_id: str
    interview_id: str
    transcript: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> Transcript:
        data = expect_mapping(payload, context="transcript")
        return cls(
            feedback_id=require_str(data, "feedback_id", "feedbackId"),
            interview_id=require_str(data, "interview_id", "interviewId"),
            transcript=get_str(data, "transcript"),
        )


@dataclass(frozen=True, slots=True)
class RecordingUrl:
    feedback_id: str
    recording_url: str
    source: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> RecordingUrl:
        data = expect_mapping(payload, context="recording_url")
        return cls(
            feedback_id=require_str(data, "feedback_id", "feedbackId"),
            recording_url=require_str(data, "recording_url", "recordingUrl"),
            source=get_str(data, "source"),
        )
