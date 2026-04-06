from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .._parsing import (
    expect_mapping,
    get_float,
    get_int,
    get_value,
    parse_model_list,
    require_int,
    require_str,
)


@dataclass(frozen=True, slots=True)
class CategoryAverage:
    name: str
    average_score: float | None
    sample_count: int | None

    @classmethod
    def from_payload(cls, payload: Any) -> CategoryAverage:
        data = expect_mapping(payload, context="category_average")
        return cls(
            name=require_str(data, "name"),
            average_score=get_float(data, "average_score", "averageScore"),
            sample_count=get_int(data, "sample_count", "sampleCount"),
        )


@dataclass(frozen=True, slots=True)
class CompletionCounts:
    pending: int
    completed: int

    @classmethod
    def from_payload(cls, payload: Any) -> CompletionCounts:
        data = expect_mapping(payload, context="completion_counts")
        return cls(
            pending=require_int(data, "pending"),
            completed=require_int(data, "completed"),
        )


@dataclass(frozen=True, slots=True)
class InterviewAnalytics:
    interview_id: str
    max_possible_score: float | None
    total_candidates: int
    evaluated_count: int
    average_score: float | None
    min_score: float | None
    max_score: float | None
    average_duration_seconds: int | None
    category_averages: list[CategoryAverage] = field(default_factory=list)
    completion: CompletionCounts = field(
        default_factory=lambda: CompletionCounts(pending=0, completed=0)
    )

    @classmethod
    def from_payload(cls, payload: Any) -> InterviewAnalytics:
        data = expect_mapping(payload, context="interview_analytics")
        return cls(
            interview_id=require_str(data, "interview_id", "interviewId"),
            max_possible_score=get_float(data, "max_possible_score", "maxPossibleScore"),
            total_candidates=require_int(data, "total_candidates", "totalCandidates"),
            evaluated_count=require_int(data, "evaluated_count", "evaluatedCount"),
            average_score=get_float(data, "average_score", "averageScore"),
            min_score=get_float(data, "min_score", "minScore"),
            max_score=get_float(data, "max_score", "maxScore"),
            average_duration_seconds=get_int(
                data,
                "average_duration_seconds",
                "averageDurationSeconds",
            ),
            category_averages=parse_model_list(
                data.get("category_averages", data.get("categoryAverages", [])),
                CategoryAverage.from_payload,
                context="interview_analytics.category_averages",
            ),
            completion=CompletionCounts.from_payload(get_value(data, "completion")),
        )


__all__ = [
    "CategoryAverage",
    "CompletionCounts",
    "InterviewAnalytics",
]
