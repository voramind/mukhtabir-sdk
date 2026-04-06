from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .._parsing import (
    compact_dict,
    expect_mapping,
    get_float,
    get_int,
    get_str,
    parse_model_list,
    require_int,
    require_str,
)


@dataclass(frozen=True, slots=True)
class CreateCandidateRequest:
    email: str
    name: str
    interview_id: str | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "email": self.email,
                "name": self.name,
                "interview_id": self.interview_id,
            }
        )


@dataclass(frozen=True, slots=True)
class InviteCandidateRequest:
    email: str
    name: str
    expires_in_hours: int = 72

    def to_payload(self) -> dict[str, Any]:
        return {
            "email": self.email,
            "name": self.name,
            "expires_in_hours": self.expires_in_hours,
        }


@dataclass(frozen=True, slots=True)
class CandidateRegistration:
    email: str
    name: str
    access_token: str = field(repr=False)
    interview_url: str
    expires_at: str
    interview_id: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> CandidateRegistration:
        data = expect_mapping(payload, context="candidate_registration")
        return cls(
            email=require_str(data, "email", "candidate_email"),
            name=require_str(data, "name", "candidate_name"),
            access_token=require_str(data, "access_token", "accessToken"),
            interview_url=require_str(data, "interview_url", "interviewUrl"),
            expires_at=require_str(data, "expires_at", "expiresAt"),
            interview_id=get_str(data, "interview_id", "interviewId"),
        )


@dataclass(frozen=True, slots=True)
class InterviewInvite:
    access_token: str = field(repr=False)
    interview_url: str
    expires_at: str
    candidate_email: str
    candidate_name: str

    @classmethod
    def from_payload(cls, payload: Any) -> InterviewInvite:
        data = expect_mapping(payload, context="interview_invite")
        return cls(
            access_token=require_str(data, "access_token", "accessToken"),
            interview_url=require_str(data, "interview_url", "interviewUrl"),
            expires_at=require_str(data, "expires_at", "expiresAt"),
            candidate_email=require_str(data, "candidate_email", "email"),
            candidate_name=require_str(data, "candidate_name", "name"),
        )


@dataclass(frozen=True, slots=True)
class CandidateSummary:
    email: str
    name: str | None
    total_tokens: int
    completed_interviews: int
    first_invited_at: str | None
    last_invited_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> CandidateSummary:
        data = expect_mapping(payload, context="candidate_summary")
        return cls(
            email=require_str(data, "email"),
            name=get_str(data, "name"),
            total_tokens=require_int(data, "total_tokens", "totalTokens"),
            completed_interviews=require_int(data, "completed_interviews", "completedInterviews"),
            first_invited_at=get_str(data, "first_invited_at", "firstInvitedAt"),
            last_invited_at=get_str(data, "last_invited_at", "lastInvitedAt"),
        )


@dataclass(frozen=True, slots=True)
class CandidateInterviewHistory:
    interview_id: str | None
    interview_role: str | None
    interview_type: str | None
    status: str | None
    invited_at: str | None
    completed_at: str | None
    expires_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> CandidateInterviewHistory:
        data = expect_mapping(payload, context="candidate_interview_history")
        return cls(
            interview_id=get_str(data, "interview_id", "interviewId"),
            interview_role=get_str(data, "interview_role", "interviewRole"),
            interview_type=get_str(data, "interview_type", "interviewType"),
            status=get_str(data, "status"),
            invited_at=get_str(data, "invited_at", "invitedAt"),
            completed_at=get_str(data, "completed_at", "completedAt"),
            expires_at=get_str(data, "expires_at", "expiresAt"),
        )


@dataclass(frozen=True, slots=True)
class CandidateFeedbackSummary:
    feedback_id: str
    interview_id: str | None
    interview_role: str | None
    total_score: float | None
    interview_duration: int | None
    created_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> CandidateFeedbackSummary:
        data = expect_mapping(payload, context="candidate_feedback_summary")
        return cls(
            feedback_id=require_str(data, "feedback_id", "feedbackId"),
            interview_id=get_str(data, "interview_id", "interviewId"),
            interview_role=get_str(data, "interview_role", "interviewRole"),
            total_score=get_float(data, "total_score", "totalScore"),
            interview_duration=get_int(data, "interview_duration", "interviewDuration"),
            created_at=get_str(data, "created_at", "createdAt"),
        )


@dataclass(frozen=True, slots=True)
class CandidateDetails:
    email: str
    name: str | None
    interviews: list[CandidateInterviewHistory] = field(default_factory=list)
    feedback: list[CandidateFeedbackSummary] = field(default_factory=list)

    @classmethod
    def from_payload(cls, payload: Any) -> CandidateDetails:
        data = expect_mapping(payload, context="candidate_details")
        return cls(
            email=require_str(data, "email"),
            name=get_str(data, "name"),
            interviews=parse_model_list(
                data.get("interviews", []),
                CandidateInterviewHistory.from_payload,
                context="candidate_details.interviews",
            ),
            feedback=parse_model_list(
                data.get("feedback", []),
                CandidateFeedbackSummary.from_payload,
                context="candidate_details.feedback",
            ),
        )
