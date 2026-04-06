import { paginate } from "../core/pagination";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PaginatedQueryParams,
  RequestOptions,
} from "../core/types";
import { MukhtabirTransport } from "../core/transport";
import type {
  CandidateDetail,
  CandidateRegistration,
  CandidateSummary,
  CreateCandidateRequest,
} from "../types/candidates";

export class CandidatesResource {
  constructor(private readonly transport: MukhtabirTransport) {}

  create(
    input: CreateCandidateRequest,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<CandidateRegistration>> {
    return this.transport.request({
      method: "POST",
      path: "/candidates",
      body: input,
      ...options,
    });
  }

  list(
    query: RequestOptions["query"] = {},
    options: Omit<RequestOptions, "query"> = {},
  ): Promise<ApiPaginatedResponse<CandidateSummary>> {
    return this.transport.request({
      method: "GET",
      path: "/candidates",
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
    email: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<CandidateDetail>> {
    return this.transport.request({
      method: "GET",
      path: `/candidates/${encodeURIComponent(email)}`,
      ...options,
    });
  }
}
