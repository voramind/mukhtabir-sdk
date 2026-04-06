import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PageParams,
} from "../core/types";

export interface DeleteResponse {
  deleted: true;
}

export type ListResponse<T> = ApiPaginatedResponse<T>;
export type ItemResponse<T> = ApiSuccessResponse<T>;
export type CommonPageParams = PageParams;
