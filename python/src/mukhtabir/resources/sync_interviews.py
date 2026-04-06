from __future__ import annotations

from collections.abc import Iterator

from .._pagination import iter_auto_paging
from .._transport import SyncTransport
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
    execute_sync,
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


class SyncInterviewsResource:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, request: CreateInterviewRequest) -> ApiResponse[CreateInterviewResult]:
        return execute_sync(self._transport, interview_create_spec(request))

    def list(self, *, page: int = 1, page_size: int = 20) -> PaginatedResponse[InterviewSummary]:
        return execute_sync(
            self._transport,
            interview_list_spec(page=page, page_size=page_size),
        )

    def iter_all(self, *, page_size: int = 20, start_page: int = 1) -> Iterator[InterviewSummary]:
        return iter_auto_paging(
            lambda page, size: self.list(page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    def get(self, interview_id: str) -> ApiResponse[InterviewDetails]:
        return execute_sync(self._transport, interview_get_spec(interview_id))

    def update(
        self,
        interview_id: str,
        request: UpdateInterviewRequest,
    ) -> ApiResponse[InterviewDetails]:
        return execute_sync(self._transport, interview_update_spec(interview_id, request))

    def delete(self, interview_id: str) -> ApiResponse[DeleteResult]:
        return execute_sync(self._transport, interview_delete_spec(interview_id))

    def add_question(
        self,
        interview_id: str,
        request: AddQuestionRequest,
    ) -> ApiResponse[QuestionCreateResult]:
        return execute_sync(self._transport, interview_add_question_spec(interview_id, request))

    def update_question(
        self,
        interview_id: str,
        question_id: str,
        request: UpdateQuestionRequest,
    ) -> ApiResponse[QuestionUpdateResult]:
        return execute_sync(
            self._transport,
            interview_update_question_spec(interview_id, question_id, request),
        )

    def delete_question(
        self,
        interview_id: str,
        question_id: str,
    ) -> ApiResponse[QuestionDeleteResult]:
        return execute_sync(
            self._transport,
            interview_delete_question_spec(interview_id, question_id),
        )

    def add_subquestion(
        self,
        interview_id: str,
        question_id: str,
        request: AddSubquestionRequest,
    ) -> ApiResponse[SubquestionCreateResult]:
        return execute_sync(
            self._transport,
            interview_add_subquestion_spec(interview_id, question_id, request),
        )

    def update_subquestion(
        self,
        interview_id: str,
        question_id: str,
        subquestion_id: str,
        request: UpdateSubquestionRequest,
    ) -> ApiResponse[SubquestionUpdateResult]:
        return execute_sync(
            self._transport,
            interview_update_subquestion_spec(interview_id, question_id, subquestion_id, request),
        )

    def delete_subquestion(
        self,
        interview_id: str,
        question_id: str,
        subquestion_id: str,
    ) -> ApiResponse[SubquestionDeleteResult]:
        return execute_sync(
            self._transport,
            interview_delete_subquestion_spec(interview_id, question_id, subquestion_id),
        )

    def add_criteria(
        self,
        interview_id: str,
        request: AddCriteriaRequest,
    ) -> ApiResponse[CriteriaCreateResult]:
        return execute_sync(self._transport, interview_add_criteria_spec(interview_id, request))

    def update_criteria(
        self,
        interview_id: str,
        criteria_id: str,
        request: UpdateCriteriaRequest,
    ) -> ApiResponse[CriteriaUpdateResult]:
        return execute_sync(
            self._transport,
            interview_update_criteria_spec(interview_id, criteria_id, request),
        )

    def delete_criteria(
        self,
        interview_id: str,
        criteria_id: str,
    ) -> ApiResponse[CriteriaDeleteResult]:
        return execute_sync(
            self._transport,
            interview_delete_criteria_spec(interview_id, criteria_id),
        )

    def publish(self, interview_id: str) -> ApiResponse[PublishInterviewResult]:
        return execute_sync(self._transport, interview_publish_spec(interview_id))

    def invite(
        self,
        interview_id: str,
        request: InviteCandidateRequest,
    ) -> ApiResponse[InterviewInvite]:
        return execute_sync(self._transport, interview_invite_spec(interview_id, request))

    def list_results(
        self,
        interview_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[FeedbackSummary]:
        return execute_sync(
            self._transport,
            interview_results_spec(interview_id, page=page, page_size=page_size),
        )

    def iter_all_results(
        self,
        interview_id: str,
        *,
        page_size: int = 20,
        start_page: int = 1,
    ) -> Iterator[FeedbackSummary]:
        return iter_auto_paging(
            lambda page, size: self.list_results(interview_id, page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    def get_analytics(self, interview_id: str) -> ApiResponse[InterviewAnalytics]:
        return execute_sync(self._transport, interview_analytics_spec(interview_id))


__all__ = ["SyncInterviewsResource"]
