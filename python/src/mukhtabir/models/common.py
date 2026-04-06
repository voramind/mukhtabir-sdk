from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, Literal, TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class ErrorDetail:
    field: str
    issue: str


@dataclass(frozen=True, slots=True)
class ResponseMeta:
    request_id: str | None
    timestamp: str | None


@dataclass(frozen=True, slots=True)
class PaginationInfo:
    page: int
    page_size: int
    total: int
    total_pages: int
    has_more: bool


@dataclass(frozen=True, slots=True)
class ApiResponse(Generic[T]):
    success: Literal[True]
    data: T
    meta: ResponseMeta

    @property
    def request_id(self) -> str | None:
        return self.meta.request_id


@dataclass(frozen=True, slots=True)
class PaginatedResponse(Generic[T]):
    success: Literal[True]
    data: list[T]
    pagination: PaginationInfo
    meta: ResponseMeta

    @property
    def request_id(self) -> str | None:
        return self.meta.request_id


@dataclass(frozen=True, slots=True)
class DeleteResult:
    deleted: bool
