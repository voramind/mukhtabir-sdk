import type { ApiSuccessResponse, RequestOptions } from "../core/types";
import { MukhtabirTransport } from "../core/transport";
import type {
  FeedbackDetail,
  FeedbackRecordingUrl,
  FeedbackTranscript,
} from "../types/feedback";

export class FeedbackResource {
  constructor(private readonly transport: MukhtabirTransport) {}

  get(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<FeedbackDetail>> {
    return this.transport.request({
      method: "GET",
      path: `/feedback/${encodeURIComponent(id)}`,
      ...options,
    });
  }

  transcript(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<FeedbackTranscript>> {
    return this.transport.request({
      method: "GET",
      path: `/feedback/${encodeURIComponent(id)}/transcript`,
      ...options,
    });
  }

  recordingUrl(
    id: string,
    options: RequestOptions = {},
  ): Promise<ApiSuccessResponse<FeedbackRecordingUrl>> {
    return this.transport.request({
      method: "GET",
      path: `/feedback/${encodeURIComponent(id)}/recording-url`,
      ...options,
    });
  }
}
