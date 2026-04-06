export const WEBHOOK_EVENTS = [
  "interview.created",
  "interview.published",
  "interview.started",
  "interview.completed",
  "evaluation.generated",
  "candidate.invited",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEventType[];
  description?: string;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEventType[];
  description?: string;
  is_active?: boolean;
}

export interface WebhookCreateResponse {
  id: string;
  url: string;
  events: WebhookEventType[];
  description: string | null;
  secret_preview: string;
  secret: string;
  is_active: boolean;
  created_at: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEventType[];
  description: string | null;
  is_active: boolean;
  failure_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookUpdateResponse {
  id: string;
  url: string;
  events: WebhookEventType[];
  description: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface WebhookTestResponse {
  delivery_id: string;
  status: "pending" | "delivered" | "failed" | "exhausted";
  response_status: number | null;
  error_message: string | null;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: "pending" | "delivered" | "failed" | "exhausted";
  response_status: number | null;
  attempt_number: number;
  error_message: string | null;
  delivered_at: string | null;
  next_retry_at: string | null;
  created_at: string;
}

export interface EvaluationGeneratedData {
  feedback_id: string;
  total_score: number;
  category_scores: Array<{
    name: string;
    score: number;
  }>;
  [key: string]: unknown;
}

export interface InterviewCreatedData {
  interview_id: string;
  role?: string;
  type?: string;
  [key: string]: unknown;
}

export interface InterviewPublishedData {
  interview_id: string;
  [key: string]: unknown;
}

export interface InterviewStartedData {
  [key: string]: unknown;
}

export interface InterviewCompletedData {
  interview_id?: string;
  feedback_id?: string;
  candidate_email?: string | null;
  test?: boolean;
  message?: string;
  webhook_id?: string;
  [key: string]: unknown;
}

export interface CandidateInvitedData {
  interview_id: string;
  candidate_email: string;
  candidate_name: string;
  [key: string]: unknown;
}

export interface WebhookEventDataMap {
  "interview.created": InterviewCreatedData;
  "interview.published": InterviewPublishedData;
  "interview.started": InterviewStartedData;
  "interview.completed": InterviewCompletedData;
  "evaluation.generated": EvaluationGeneratedData;
  "candidate.invited": CandidateInvitedData;
}

export interface WebhookEvent<E extends WebhookEventType = WebhookEventType> {
  event: E;
  timestamp: string;
  data: WebhookEventDataMap[E];
}
