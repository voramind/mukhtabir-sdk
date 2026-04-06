from __future__ import annotations

from collections.abc import Iterator

from .._pagination import iter_auto_paging
from .._transport import SyncTransport
from ..models.candidates import (
    CandidateDetails,
    CandidateRegistration,
    CandidateSummary,
    CreateCandidateRequest,
)
from ..models.common import ApiResponse, PaginatedResponse
from ._request_specs import (
    candidate_create_spec,
    candidate_get_spec,
    candidate_list_spec,
    execute_sync,
)


class SyncCandidatesResource:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, request: CreateCandidateRequest) -> ApiResponse[CandidateRegistration]:
        return execute_sync(self._transport, candidate_create_spec(request))

    def list(self, *, page: int = 1, page_size: int = 20) -> PaginatedResponse[CandidateSummary]:
        return execute_sync(
            self._transport,
            candidate_list_spec(page=page, page_size=page_size),
        )

    def iter_all(self, *, page_size: int = 20, start_page: int = 1) -> Iterator[CandidateSummary]:
        return iter_auto_paging(
            lambda page, size: self.list(page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    def get(self, email: str) -> ApiResponse[CandidateDetails]:
        return execute_sync(self._transport, candidate_get_spec(email))


__all__ = ["SyncCandidatesResource"]
