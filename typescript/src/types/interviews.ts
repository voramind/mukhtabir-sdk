import type { FeedbackCategoryScore } from "./feedback";

export const INTERVIEW_TYPES = [
  "behavioral",
  "technical",
  "low-technical",
  "very-technical",
  "scenario-based",
  "mixed",
] as const;

export const INTERVIEW_LEVELS = [
  "junior",
  "mid",
  "senior",
  "lead",
  "executive",
  "intermediate",
] as const;

export const INTERVIEW_VISIBILITIES = [
  "private",
  "restricted",
  "public",
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export type InterviewLevel = (typeof INTERVIEW_LEVELS)[number];
export type InterviewVisibility = (typeof INTERVIEW_VISIBILITIES)[number];

export interface InterviewSubquestion {
  id: string;
  text: string;
  disabled: boolean;
  orderIndex: number;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  disabled: boolean;
  orderIndex: number;
  subquestions: InterviewSubquestion[];
}

export interface ScoringGuide {
  scoreRange: string;
  description: string;
}

export interface PerformanceLevel {
  minScore: number;
  maxScore: number;
  label: string;
  colorClass: string;
}

export interface InterviewEvaluationCriterion {
  id: string;
  criteriaTitle: string;
  description: string;
  scoringGuides: ScoringGuide[];
  disabled: boolean;
  orderIndex: number;
}

export interface Collaborator {
  userId: string;
  email: string;
  role: "viewer" | "editor";
  status: "pending" | "accepted" | "rejected";
  invitedAt: string;
}

export interface Interviewee {
  userId: string | null;
  email: string;
  status: "pending" | "completed";
  invitedAt: string;
  completedAt?: string;
}

export interface AttachmentRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enableAIEvaluation?: boolean;
}

export interface InterviewSummary {
  id: string;
  role: string;
  level: string;
  type: string;
  duration: number;
  finalized: boolean;
  published: boolean;
  visibility: string;
  max_score: number;
  created_at: string;
  updated_at: string;
}

export interface InterviewDetail {
  id: string;
  role: string;
  level: string;
  type: string;
  userId: string;
  userName: string;
  duration: number;
  finalized: boolean;
  published: boolean;
  visibility: string;
  voiceId?: string;
  logo?: string;
  interviewInformation?: string;
  maxScore: number;
  createdAt: string;
  updatedAt?: string;
  techstack: string[];
  questions: InterviewQuestion[];
  evaluationCriteriaList: InterviewEvaluationCriterion[];
  performanceLevels: PerformanceLevel[];
  collaborators: Collaborator[];
  interviewees: Interviewee[];
  attachmentRequirements: AttachmentRequirement[];
}

export interface CreateInterviewRequest {
  role: string;
  type?: InterviewType;
  level?: InterviewLevel;
  duration?: number;
  techstack?: string[];
  max_score?: number;
  visibility?: InterviewVisibility;
}

export interface UpdateInterviewRequest {
  role?: string;
  duration?: number;
  visibility?: InterviewVisibility;
  published?: boolean;
}

export interface CreateInterviewResponse {
  interview_id: string;
}

export interface PublishInterviewResponse {
  published: true;
  interview_id: string;
}

export interface InviteCandidateRequest {
  email: string;
  name: string;
  expires_in_hours?: number;
}

export interface InviteCandidateResponse {
  access_token: string;
  interview_url: string;
  expires_at: string;
  candidate_email: string;
  candidate_name: string;
}

export interface AddInterviewQuestionRequest {
  question: string;
  subquestions?: string[];
  order_index?: number;
}

export interface UpdateInterviewQuestionRequest {
  question?: string;
  disabled?: boolean;
  order_index?: number;
}

export interface AddInterviewSubquestionRequest {
  subquestion: string;
  order_index?: number;
}

export interface UpdateInterviewSubquestionRequest {
  subquestion?: string;
  disabled?: boolean;
  order_index?: number;
}

export interface AddInterviewCriteriaRequest {
  criteria_title: string;
  description?: string;
  order_index?: number;
}

export interface UpdateInterviewCriteriaRequest {
  criteria_title?: string;
  description?: string;
  disabled?: boolean;
  order_index?: number;
}

export interface AddInterviewQuestionResponse {
  question_id: string;
  interview_id: string;
  order_index: number;
}

export interface UpdateInterviewQuestionResponse {
  question_id: string;
  updated: boolean;
}

export interface DeleteInterviewQuestionResponse {
  question_id: string;
  deleted: boolean;
}

export interface AddInterviewSubquestionResponse {
  subquestion_id: string;
  question_id: string;
  interview_id: string;
  order_index: number;
}

export interface UpdateInterviewSubquestionResponse {
  subquestion_id: string;
  updated: boolean;
}

export interface DeleteInterviewSubquestionResponse {
  subquestion_id: string;
  deleted: boolean;
}

export interface AddInterviewCriteriaResponse {
  criteria_id: string;
  interview_id: string;
  order_index: number;
}

export interface UpdateInterviewCriteriaResponse {
  criteria_id: string;
  updated: boolean;
}

export interface DeleteInterviewCriteriaResponse {
  criteria_id: string;
  deleted: boolean;
}

export interface InterviewResultSummary {
  id: string;
  interview_id: string;
  total_score: number;
  interviewee_email: string;
  interviewee_name: string;
  interview_duration: number;
  evaluation_model: string | null;
  category_scores: FeedbackCategoryScore[];
  created_at: string;
  evaluated_at: string | null;
}

export interface InterviewAnalytics {
  interview_id: string;
  max_possible_score: number;
  total_candidates: number;
  evaluated_count: number;
  average_score: number | null;
  min_score: number | null;
  max_score: number | null;
  average_duration_seconds: number | null;
  category_averages: Array<{
    name: string;
    average_score: number;
    sample_count: number;
  }>;
  completion: {
    pending: number;
    completed: number;
  };
}
