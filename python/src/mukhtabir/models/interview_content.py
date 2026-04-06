from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .._parsing import (
    expect_mapping,
    get_bool,
    get_float,
    get_int,
    get_str,
    parse_model_list,
    parse_string_list,
    require_int,
    require_str,
)


@dataclass(frozen=True, slots=True)
class InterviewSubquestion:
    text: str
    id: str | None = None
    order_index: int | None = None
    disabled: bool = False

    @classmethod
    def from_payload(cls, payload: Any) -> InterviewSubquestion:
        if isinstance(payload, str):
            return cls(text=payload)
        data = expect_mapping(payload, context="interview_subquestion")
        return cls(
            text=require_str(data, "text", "subquestion"),
            id=get_str(data, "subquestion_id", "subquestionId", "id"),
            order_index=get_int(data, "order_index", "orderIndex"),
            disabled=get_bool(data, "disabled", default=False) or False,
        )


@dataclass(frozen=True, slots=True)
class ScoringGuide:
    score_range: str | None
    description: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> ScoringGuide:
        data = expect_mapping(payload, context="scoring_guide")
        return cls(
            score_range=get_str(data, "score_range", "scoreRange"),
            description=get_str(data, "description"),
        )


@dataclass(frozen=True, slots=True)
class EvaluationCriterion:
    title: str
    id: str | None = None
    description: str | None = None
    order_index: int | None = None
    scoring_guides: list[ScoringGuide] = field(default_factory=list)
    disabled: bool = False

    @classmethod
    def from_payload(cls, payload: Any) -> EvaluationCriterion:
        data = expect_mapping(payload, context="evaluation_criterion")
        scoring_guides = parse_model_list(
            data.get("scoring_guides", data.get("scoringGuides", [])),
            ScoringGuide.from_payload,
            context="evaluation_criterion.scoring_guides",
        )
        return cls(
            title=require_str(data, "criteria_title", "criteriaTitle", "title"),
            id=get_str(data, "criteria_id", "criteriaId", "id"),
            description=get_str(data, "description"),
            order_index=get_int(data, "order_index", "orderIndex"),
            scoring_guides=scoring_guides,
            disabled=get_bool(data, "disabled", default=False) or False,
        )


@dataclass(frozen=True, slots=True)
class PerformanceLevel:
    min_score: float | None
    max_score: float | None
    label: str | None
    color_class: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> PerformanceLevel:
        data = expect_mapping(payload, context="performance_level")
        return cls(
            min_score=get_float(data, "min_score", "minScore"),
            max_score=get_float(data, "max_score", "maxScore"),
            label=get_str(data, "label"),
            color_class=get_str(data, "color_class", "colorClass"),
        )


@dataclass(frozen=True, slots=True)
class InterviewQuestion:
    question: str
    id: str | None = None
    order_index: int | None = None
    subquestions: list[InterviewSubquestion] = field(default_factory=list)
    disabled: bool = False

    @classmethod
    def from_payload(cls, payload: Any) -> InterviewQuestion:
        data = expect_mapping(payload, context="interview_question")
        subquestions = parse_model_list(
            data.get("subquestions", []),
            InterviewSubquestion.from_payload,
            context="interview_question.subquestions",
        )
        return cls(
            question=require_str(data, "question"),
            id=get_str(data, "question_id", "questionId", "id"),
            order_index=get_int(data, "order_index", "orderIndex"),
            subquestions=subquestions,
            disabled=get_bool(data, "disabled", default=False) or False,
        )


@dataclass(frozen=True, slots=True)
class InterviewSummary:
    id: str
    role: str
    type: str
    level: str
    duration: int
    published: bool | None
    finalized: bool | None
    visibility: str | None
    max_score: int | None
    created_at: str | None
    updated_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> InterviewSummary:
        data = expect_mapping(payload, context="interview_summary")
        return cls(
            id=require_str(data, "id"),
            role=require_str(data, "role"),
            type=require_str(data, "type"),
            level=require_str(data, "level"),
            duration=require_int(data, "duration"),
            published=get_bool(data, "published"),
            finalized=get_bool(data, "finalized"),
            visibility=get_str(data, "visibility"),
            max_score=get_int(data, "max_score", "maxScore"),
            created_at=get_str(data, "created_at", "createdAt"),
            updated_at=get_str(data, "updated_at", "updatedAt"),
        )


@dataclass(frozen=True, slots=True)
class InterviewDetails:
    id: str
    role: str
    type: str
    level: str
    duration: int
    published: bool | None
    finalized: bool | None
    visibility: str | None
    max_score: int | None
    created_at: str | None
    updated_at: str | None
    techstack: list[str] = field(default_factory=list)
    questions: list[InterviewQuestion] = field(default_factory=list)
    evaluation_criteria: list[EvaluationCriterion] = field(default_factory=list)
    performance_levels: list[PerformanceLevel] = field(default_factory=list)
    user_id: str | None = None
    user_name: str | None = None
    voice_id: str | None = None
    interview_information: str | None = None
    logo: str | None = None

    @classmethod
    def from_payload(cls, payload: Any) -> InterviewDetails:
        data = expect_mapping(payload, context="interview_details")
        return cls(
            id=require_str(data, "id"),
            role=require_str(data, "role"),
            type=require_str(data, "type"),
            level=require_str(data, "level"),
            duration=require_int(data, "duration"),
            published=get_bool(data, "published"),
            finalized=get_bool(data, "finalized"),
            visibility=get_str(data, "visibility"),
            max_score=get_int(data, "max_score", "maxScore"),
            created_at=get_str(data, "created_at", "createdAt"),
            updated_at=get_str(data, "updated_at", "updatedAt"),
            techstack=parse_string_list(
                data.get("techstack", []),
                context="interview_details.techstack",
            ),
            questions=parse_model_list(
                data.get("questions", []),
                InterviewQuestion.from_payload,
                context="interview_details.questions",
            ),
            evaluation_criteria=parse_model_list(
                data.get(
                    "evaluation_criteria",
                    data.get("evaluationCriteria", data.get("evaluationCriteriaList", [])),
                ),
                EvaluationCriterion.from_payload,
                context="interview_details.evaluation_criteria",
            ),
            performance_levels=parse_model_list(
                data.get("performance_levels", data.get("performanceLevels", [])),
                PerformanceLevel.from_payload,
                context="interview_details.performance_levels",
            ),
            user_id=get_str(data, "user_id", "userId"),
            user_name=get_str(data, "user_name", "userName"),
            voice_id=get_str(data, "voice_id", "voiceId"),
            interview_information=get_str(data, "interview_information", "interviewInformation"),
            logo=get_str(data, "logo"),
        )


__all__ = [
    "EvaluationCriterion",
    "InterviewDetails",
    "InterviewQuestion",
    "InterviewSubquestion",
    "InterviewSummary",
    "PerformanceLevel",
    "ScoringGuide",
]
