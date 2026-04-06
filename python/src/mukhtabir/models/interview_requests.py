from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from .._parsing import compact_dict, expect_mapping, require_bool, require_int, require_str

DocumentedInterviewType = Literal["behavioral", "technical", "mixed"]
DocumentedInterviewLevel = Literal["junior", "mid", "senior", "lead"]
InterviewVisibility = Literal["private", "restricted", "public"]


@dataclass(frozen=True, slots=True)
class CreateInterviewRequest:
    role: str
    type: DocumentedInterviewType = "technical"
    level: DocumentedInterviewLevel = "mid"
    duration: int = 30
    techstack: list[str] | None = None
    max_score: int = 100
    visibility: InterviewVisibility = "private"

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "role": self.role,
                "type": self.type,
                "level": self.level,
                "duration": self.duration,
                "techstack": self.techstack,
                "max_score": self.max_score,
                "visibility": self.visibility,
            }
        )


@dataclass(frozen=True, slots=True)
class UpdateInterviewRequest:
    role: str | None = None
    type: DocumentedInterviewType | None = None
    level: DocumentedInterviewLevel | None = None
    duration: int | None = None
    max_score: int | None = None
    visibility: InterviewVisibility | None = None
    published: bool | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "role": self.role,
                "type": self.type,
                "level": self.level,
                "duration": self.duration,
                "max_score": self.max_score,
                "visibility": self.visibility,
                "published": self.published,
            }
        )


@dataclass(frozen=True, slots=True)
class CreateInterviewResult:
    interview_id: str

    @classmethod
    def from_payload(cls, payload: Any) -> CreateInterviewResult:
        data = expect_mapping(payload, context="create_interview")
        return cls(interview_id=require_str(data, "interview_id", "interviewId"))


@dataclass(frozen=True, slots=True)
class PublishInterviewResult:
    published: bool
    interview_id: str

    @classmethod
    def from_payload(cls, payload: Any) -> PublishInterviewResult:
        data = expect_mapping(payload, context="publish_interview")
        return cls(
            published=require_bool(data, "published"),
            interview_id=require_str(data, "interview_id", "interviewId"),
        )


@dataclass(frozen=True, slots=True)
class AddQuestionRequest:
    question: str
    subquestions: list[str] | None = None
    order_index: int | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "question": self.question,
                "subquestions": self.subquestions,
                "order_index": self.order_index,
            }
        )


@dataclass(frozen=True, slots=True)
class UpdateQuestionRequest:
    question: str | None = None
    disabled: bool | None = None
    order_index: int | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "question": self.question,
                "disabled": self.disabled,
                "order_index": self.order_index,
            }
        )


@dataclass(frozen=True, slots=True)
class AddSubquestionRequest:
    subquestion: str
    order_index: int | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "subquestion": self.subquestion,
                "order_index": self.order_index,
            }
        )


@dataclass(frozen=True, slots=True)
class UpdateSubquestionRequest:
    subquestion: str | None = None
    disabled: bool | None = None
    order_index: int | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "subquestion": self.subquestion,
                "disabled": self.disabled,
                "order_index": self.order_index,
            }
        )


@dataclass(frozen=True, slots=True)
class AddCriteriaRequest:
    criteria_title: str
    description: str | None = None
    order_index: int | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "criteria_title": self.criteria_title,
                "description": self.description,
                "order_index": self.order_index,
            }
        )


@dataclass(frozen=True, slots=True)
class UpdateCriteriaRequest:
    criteria_title: str | None = None
    description: str | None = None
    disabled: bool | None = None
    order_index: int | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "criteria_title": self.criteria_title,
                "description": self.description,
                "disabled": self.disabled,
                "order_index": self.order_index,
            }
        )


@dataclass(frozen=True, slots=True)
class QuestionCreateResult:
    question_id: str
    interview_id: str
    order_index: int

    @classmethod
    def from_payload(cls, payload: Any) -> QuestionCreateResult:
        data = expect_mapping(payload, context="question_create")
        return cls(
            question_id=require_str(data, "question_id", "questionId"),
            interview_id=require_str(data, "interview_id", "interviewId"),
            order_index=require_int(data, "order_index", "orderIndex"),
        )


@dataclass(frozen=True, slots=True)
class QuestionUpdateResult:
    question_id: str
    updated: bool

    @classmethod
    def from_payload(cls, payload: Any) -> QuestionUpdateResult:
        data = expect_mapping(payload, context="question_update")
        return cls(
            question_id=require_str(data, "question_id", "questionId"),
            updated=require_bool(data, "updated"),
        )


@dataclass(frozen=True, slots=True)
class QuestionDeleteResult:
    question_id: str
    deleted: bool

    @classmethod
    def from_payload(cls, payload: Any) -> QuestionDeleteResult:
        data = expect_mapping(payload, context="question_delete")
        return cls(
            question_id=require_str(data, "question_id", "questionId"),
            deleted=require_bool(data, "deleted"),
        )


@dataclass(frozen=True, slots=True)
class SubquestionCreateResult:
    subquestion_id: str
    question_id: str
    interview_id: str
    order_index: int

    @classmethod
    def from_payload(cls, payload: Any) -> SubquestionCreateResult:
        data = expect_mapping(payload, context="subquestion_create")
        return cls(
            subquestion_id=require_str(data, "subquestion_id", "subquestionId"),
            question_id=require_str(data, "question_id", "questionId"),
            interview_id=require_str(data, "interview_id", "interviewId"),
            order_index=require_int(data, "order_index", "orderIndex"),
        )


@dataclass(frozen=True, slots=True)
class SubquestionUpdateResult:
    subquestion_id: str
    updated: bool

    @classmethod
    def from_payload(cls, payload: Any) -> SubquestionUpdateResult:
        data = expect_mapping(payload, context="subquestion_update")
        return cls(
            subquestion_id=require_str(data, "subquestion_id", "subquestionId"),
            updated=require_bool(data, "updated"),
        )


@dataclass(frozen=True, slots=True)
class SubquestionDeleteResult:
    subquestion_id: str
    deleted: bool

    @classmethod
    def from_payload(cls, payload: Any) -> SubquestionDeleteResult:
        data = expect_mapping(payload, context="subquestion_delete")
        return cls(
            subquestion_id=require_str(data, "subquestion_id", "subquestionId"),
            deleted=require_bool(data, "deleted"),
        )


@dataclass(frozen=True, slots=True)
class CriteriaCreateResult:
    criteria_id: str
    interview_id: str
    order_index: int

    @classmethod
    def from_payload(cls, payload: Any) -> CriteriaCreateResult:
        data = expect_mapping(payload, context="criteria_create")
        return cls(
            criteria_id=require_str(data, "criteria_id", "criteriaId"),
            interview_id=require_str(data, "interview_id", "interviewId"),
            order_index=require_int(data, "order_index", "orderIndex"),
        )


@dataclass(frozen=True, slots=True)
class CriteriaUpdateResult:
    criteria_id: str
    updated: bool

    @classmethod
    def from_payload(cls, payload: Any) -> CriteriaUpdateResult:
        data = expect_mapping(payload, context="criteria_update")
        return cls(
            criteria_id=require_str(data, "criteria_id", "criteriaId"),
            updated=require_bool(data, "updated"),
        )


@dataclass(frozen=True, slots=True)
class CriteriaDeleteResult:
    criteria_id: str
    deleted: bool

    @classmethod
    def from_payload(cls, payload: Any) -> CriteriaDeleteResult:
        data = expect_mapping(payload, context="criteria_delete")
        return cls(
            criteria_id=require_str(data, "criteria_id", "criteriaId"),
            deleted=require_bool(data, "deleted"),
        )


__all__ = [
    "AddCriteriaRequest",
    "AddQuestionRequest",
    "AddSubquestionRequest",
    "CriteriaCreateResult",
    "CriteriaDeleteResult",
    "CriteriaUpdateResult",
    "CreateInterviewRequest",
    "CreateInterviewResult",
    "DocumentedInterviewLevel",
    "DocumentedInterviewType",
    "InterviewVisibility",
    "PublishInterviewResult",
    "QuestionCreateResult",
    "QuestionDeleteResult",
    "QuestionUpdateResult",
    "SubquestionCreateResult",
    "SubquestionDeleteResult",
    "SubquestionUpdateResult",
    "UpdateCriteriaRequest",
    "UpdateInterviewRequest",
    "UpdateQuestionRequest",
    "UpdateSubquestionRequest",
]
