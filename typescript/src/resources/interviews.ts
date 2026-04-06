import { paginate } from "../core/pagination";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PaginatedQueryParams,
  RequestOptions,
} from "../core/types";
import { MukhtabirTransport } from "../core/transport";
import type {
  AddInterviewCriteriaRequest,
  AddInterviewCriteriaResponse,
  AddInterviewQuestionRequest,
  AddInterviewQuestionResponse,
  AddInterviewSubquestionRequest,
  AddInterviewSubquestionResponse,
  CreateInterviewRequest,
  CreateInterviewResponse,
  DeleteInterviewCriteriaResponse,
  DeleteInterviewQuestionResponse,
  DeleteInterviewSubquestionResponse,
  InterviewAnalytics,
  InterviewDetail,
  InterviewResultSummary,
  InterviewSummary,
  InviteCandidateRequest,
  InviteCandidateResponse,
  PublishInterviewResponse,
  UpdateInterviewCriteriaRequest,
  UpdateInterviewCriteriaResponse,
  UpdateInterviewRequest,
  UpdateInterviewQuestionRequest,
  UpdateInterviewQuestionResponse,
  UpdateInterviewSubquestionRequest,
  UpdateInterviewSubquestionResponse,
} from "../types/interviews";
import type { DeleteResponse } from "../types/common";

export class InterviewsResource {
  constructor(private readonly transport: MukhtabirTransport) {}

  create(
    input: CreateInterviewRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<CreateInterviewResponse>> {
    return this.transport.request({
      method: "POST",
      path: "/interviews",
      body: input,
      ...options,
    });
  }

  list(
    query: RequestOptions["query"] = {},
    options: Omit<RequestOptions, "query"> = {},
  ): Promise<ApiPaginatedResponse<InterviewSummary>> {
    return this.transport.request({
      method: "GET",
      path: "/interviews",
      query,
      ...options,
    });
  }

  listAll(
    query: PaginatedQueryParams = {},
    options: Omit<RequestOptions, "query"> = {},
  ) {
    return paginate((page) => this.list({ ...query, ...page }, options), query);
  }

  get(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<InterviewDetail>> {
    return this.transport.request({
      method: "GET",
      path: `/interviews/${encodeURIComponent(id)}`,
      ...options,
    });
  }

  update(
    id: string,
    input: UpdateInterviewRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<InterviewDetail>> {
    return this.transport.request({
      method: "PATCH",
      path: `/interviews/${encodeURIComponent(id)}`,
      body: input,
      ...options,
    });
  }

  delete(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<DeleteResponse>> {
    return this.transport.request({
      method: "DELETE",
      path: `/interviews/${encodeURIComponent(id)}`,
      ...options,
    });
  }

  publish(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<PublishInterviewResponse>> {
    return this.transport.request({
      method: "POST",
      path: `/interviews/${encodeURIComponent(id)}/publish`,
      ...options,
    });
  }

  invite(
    id: string,
    input: InviteCandidateRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<InviteCandidateResponse>> {
    return this.transport.request({
      method: "POST",
      path: `/interviews/${encodeURIComponent(id)}/invite`,
      body: input,
      ...options,
    });
  }

  addQuestion(
    id: string,
    input: AddInterviewQuestionRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<AddInterviewQuestionResponse>> {
    return this.transport.request({
      method: "POST",
      path: `/interviews/${encodeURIComponent(id)}/questions`,
      body: input,
      ...options,
    });
  }

  updateQuestion(
    id: string,
    questionId: string,
    input: UpdateInterviewQuestionRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<UpdateInterviewQuestionResponse>> {
    return this.transport.request({
      method: "PATCH",
      path: `/interviews/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`,
      body: input,
      ...options,
    });
  }

  deleteQuestion(
    id: string,
    questionId: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<DeleteInterviewQuestionResponse>> {
    return this.transport.request({
      method: "DELETE",
      path: `/interviews/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`,
      ...options,
    });
  }

  addSubquestion(
    id: string,
    questionId: string,
    input: AddInterviewSubquestionRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<AddInterviewSubquestionResponse>> {
    return this.transport.request({
      method: "POST",
      path: `/interviews/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}/subquestions`,
      body: input,
      ...options,
    });
  }

  updateSubquestion(
    id: string,
    questionId: string,
    subquestionId: string,
    input: UpdateInterviewSubquestionRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<UpdateInterviewSubquestionResponse>> {
    return this.transport.request({
      method: "PATCH",
      path: `/interviews/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}/subquestions/${encodeURIComponent(subquestionId)}`,
      body: input,
      ...options,
    });
  }

  deleteSubquestion(
    id: string,
    questionId: string,
    subquestionId: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<DeleteInterviewSubquestionResponse>> {
    return this.transport.request({
      method: "DELETE",
      path: `/interviews/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}/subquestions/${encodeURIComponent(subquestionId)}`,
      ...options,
    });
  }

  addCriteria(
    id: string,
    input: AddInterviewCriteriaRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<AddInterviewCriteriaResponse>> {
    return this.transport.request({
      method: "POST",
      path: `/interviews/${encodeURIComponent(id)}/criteria`,
      body: input,
      ...options,
    });
  }

  updateCriteria(
    id: string,
    criteriaId: string,
    input: UpdateInterviewCriteriaRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<UpdateInterviewCriteriaResponse>> {
    return this.transport.request({
      method: "PATCH",
      path: `/interviews/${encodeURIComponent(id)}/criteria/${encodeURIComponent(criteriaId)}`,
      body: input,
      ...options,
    });
  }

  deleteCriteria(
    id: string,
    criteriaId: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<DeleteInterviewCriteriaResponse>> {
    return this.transport.request({
      method: "DELETE",
      path: `/interviews/${encodeURIComponent(id)}/criteria/${encodeURIComponent(criteriaId)}`,
      ...options,
    });
  }

  results(
    id: string,
    query: RequestOptions["query"] = {},
    options: Omit<RequestOptions, "query"> = {},
  ): Promise<ApiPaginatedResponse<InterviewResultSummary>> {
    return this.transport.request({
      method: "GET",
      path: `/interviews/${encodeURIComponent(id)}/results`,
      query,
      ...options,
    });
  }

  resultsAll(
    id: string,
    query: PaginatedQueryParams = {},
    options: Omit<RequestOptions, "query"> = {},
  ) {
    return paginate(
      (page) => this.results(id, { ...query, ...page }, options),
      query,
    );
  }

  analytics(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<InterviewAnalytics>> {
    return this.transport.request({
      method: "GET",
      path: `/interviews/${encodeURIComponent(id)}/analytics`,
      ...options,
    });
  }
}
