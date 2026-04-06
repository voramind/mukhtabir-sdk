from __future__ import annotations

from collections.abc import AsyncIterator

from .._pagination import aiter_auto_paging
from .._transport import AsyncTransport
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
    execute_async,
)


class AsyncCandidatesResource:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, request: CreateCandidateRequest) -> ApiResponse[CandidateRegistration]:
        return await execute_async(self._transport, candidate_create_spec(request))

    async def list(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[CandidateSummary]:
        return await execute_async(
            self._transport,
            candidate_list_spec(page=page, page_size=page_size),
        )

    def iter_all(
        self,
        *,
        page_size: int = 20,
        start_page: int = 1,
    ) -> AsyncIterator[CandidateSummary]:
        return aiter_auto_paging(
            lambda page, size: self.list(page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    async def get(self, email: str) -> ApiResponse[CandidateDetails]:
        return await execute_async(self._transport, candidate_get_spec(email))


__all__ = ["AsyncCandidatesResource"]
