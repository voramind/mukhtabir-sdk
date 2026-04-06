from __future__ import annotations

from collections.abc import AsyncIterator

from .._pagination import aiter_auto_paging
from .._transport import AsyncTransport
from ..models.candidates import InterviewInvite, InviteCandidateRequest
from ..models.common import ApiResponse, DeleteResult, PaginatedResponse
from ..models.feedback import FeedbackSummary
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
from ._request_specs import (
    execute_async,
    interview_add_criteria_spec,
    interview_add_question_spec,
    interview_add_subquestion_spec,
    interview_analytics_spec,
    interview_create_spec,
    interview_delete_criteria_spec,
    interview_delete_question_spec,
    interview_delete_spec,
    interview_delete_subquestion_spec,
    interview_get_spec,
    interview_invite_spec,
    interview_list_spec,
    interview_publish_spec,
    interview_results_spec,
    interview_update_criteria_spec,
    interview_update_question_spec,
    interview_update_spec,
    interview_update_subquestion_spec,
)


class AsyncInterviewsResource:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, request: CreateInterviewRequest) -> ApiResponse[CreateInterviewResult]:
        return await execute_async(self._transport, interview_create_spec(request))

    async def list(
        self, *, page: int = 1, page_size: int = 20
    ) -> PaginatedResponse[InterviewSummary]:
        return await execute_async(
            self._transport,
            interview_list_spec(page=page, page_size=page_size),
        )

    def iter_all(
        self, *, page_size: int = 20, start_page: int = 1
    ) -> AsyncIterator[InterviewSummary]:
        return aiter_auto_paging(
            lambda page, size: self.list(page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    async def get(self, interview_id: str) -> ApiResponse[InterviewDetails]:
        return await execute_async(self._transport, interview_get_spec(interview_id))

    async def update(
        self,
        interview_id: str,
        request: UpdateInterviewRequest,
    ) -> ApiResponse[InterviewDetails]:
        return await execute_async(self._transport, interview_update_spec(interview_id, request))

    async def delete(self, interview_id: str) -> ApiResponse[DeleteResult]:
        return await execute_async(self._transport, interview_delete_spec(interview_id))

    async def add_question(
        self,
        interview_id: str,
        request: AddQuestionRequest,
    ) -> ApiResponse[QuestionCreateResult]:
        return await execute_async(
            self._transport, interview_add_question_spec(interview_id, request)
        )

    async def update_question(
        self,
        interview_id: str,
        question_id: str,
        request: UpdateQuestionRequest,
    ) -> ApiResponse[QuestionUpdateResult]:
        return await execute_async(
            self._transport,
            interview_update_question_spec(interview_id, question_id, request),
        )

    async def delete_question(
        self,
        interview_id: str,
        question_id: str,
    ) -> ApiResponse[QuestionDeleteResult]:
        return await execute_async(
            self._transport,
            interview_delete_question_spec(interview_id, question_id),
        )

    async def add_subquestion(
        self,
        interview_id: str,
        question_id: str,
        request: AddSubquestionRequest,
    ) -> ApiResponse[SubquestionCreateResult]:
        return await execute_async(
            self._transport,
            interview_add_subquestion_spec(interview_id, question_id, request),
        )

    async def update_subquestion(
        self,
        interview_id: str,
        question_id: str,
        subquestion_id: str,
        request: UpdateSubquestionRequest,
    ) -> ApiResponse[SubquestionUpdateResult]:
        return await execute_async(
            self._transport,
            interview_update_subquestion_spec(interview_id, question_id, subquestion_id, request),
        )

    async def delete_subquestion(
        self,
        interview_id: str,
        question_id: str,
        subquestion_id: str,
    ) -> ApiResponse[SubquestionDeleteResult]:
        return await execute_async(
            self._transport,
            interview_delete_subquestion_spec(interview_id, question_id, subquestion_id),
        )

    async def add_criteria(
        self,
        interview_id: str,
        request: AddCriteriaRequest,
    ) -> ApiResponse[CriteriaCreateResult]:
        return await execute_async(
            self._transport, interview_add_criteria_spec(interview_id, request)
        )

    async def update_criteria(
        self,
        interview_id: str,
        criteria_id: str,
        request: UpdateCriteriaRequest,
    ) -> ApiResponse[CriteriaUpdateResult]:
        return await execute_async(
            self._transport,
            interview_update_criteria_spec(interview_id, criteria_id, request),
        )

    async def delete_criteria(
        self,
        interview_id: str,
        criteria_id: str,
    ) -> ApiResponse[CriteriaDeleteResult]:
        return await execute_async(
            self._transport,
            interview_delete_criteria_spec(interview_id, criteria_id),
        )

    async def publish(self, interview_id: str) -> ApiResponse[PublishInterviewResult]:
        return await execute_async(self._transport, interview_publish_spec(interview_id))

    async def invite(
        self,
        interview_id: str,
        request: InviteCandidateRequest,
    ) -> ApiResponse[InterviewInvite]:
        return await execute_async(self._transport, interview_invite_spec(interview_id, request))

    async def list_results(
        self,
        interview_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[FeedbackSummary]:
        return await execute_async(
            self._transport,
            interview_results_spec(interview_id, page=page, page_size=page_size),
        )

    def iter_all_results(
        self,
        interview_id: str,
        *,
        page_size: int = 20,
        start_page: int = 1,
    ) -> AsyncIterator[FeedbackSummary]:
        return aiter_auto_paging(
            lambda page, size: self.list_results(interview_id, page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    async def get_analytics(self, interview_id: str) -> ApiResponse[InterviewAnalytics]:
        return await execute_async(self._transport, interview_analytics_spec(interview_id))


__all__ = ["AsyncInterviewsResource"]
