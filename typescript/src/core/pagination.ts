import type { ApiPaginatedResponse, PageParams } from "./types";

export interface PaginateOptions extends PageParams {
  page_size?: number;
}

export type PageFetcher<T> = (
  params: Required<PageParams>,
) => Promise<ApiPaginatedResponse<T>>;

export async function* paginate<T>(
  fetchPage: PageFetcher<T>,
  options: PaginateOptions = {},
): AsyncGenerator<T, void, undefined> {
  let page = options.page ?? 1;
  const pageSize = options.page_size ?? 20;

  while (true) {
    const response = await fetchPage({ page, page_size: pageSize });
    for (const item of response.data) {
      yield item;
    }

    if (!response.pagination.has_more) {
      return;
    }

    page += 1;
  }
}
