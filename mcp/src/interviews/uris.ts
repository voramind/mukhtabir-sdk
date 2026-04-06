import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "../shared/pagination";

export const INTERVIEW_RESOURCE_TEMPLATES = {
  interview: "mukhtabir://interviews/{id}",
  interviewAnalytics: "mukhtabir://interviews/{id}/analytics",
  interviewResults: "mukhtabir://interviews/{id}/results{?page,page_size}",
} as const;

export const interviewResourceUri = {
  interview: (id: string) => `mukhtabir://interviews/${encodeURIComponent(id)}`,
  interviewAnalytics: (id: string) =>
    `mukhtabir://interviews/${encodeURIComponent(id)}/analytics`,
  interviewResults: (
    id: string,
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
  ) =>
    `mukhtabir://interviews/${encodeURIComponent(id)}/results?page=${page}&page_size=${pageSize}`,
};
