export interface CreateCandidateRequest {
  email: string;
  name: string;
  interview_id?: string;
}

export interface CandidateRegistration {
  email: string;
  name: string;
  access_token: string;
  interview_url: string;
  expires_at: string;
  interview_id: string | null;
}

export interface CandidateSummary {
  email: string;
  name: string;
  total_tokens: number;
  completed_interviews: number;
  first_invited_at: string;
  last_invited_at: string;
}

export interface CandidateInterview {
  interview_id: string | null;
  interview_role: string | null;
  interview_type: string | null;
  status: "pending" | "completed";
  invited_at: string;
  completed_at: string | null;
  expires_at: string;
}

export interface CandidateFeedbackSummary {
  feedback_id: string;
  interview_id: string;
  interview_role: string;
  total_score: number;
  interview_duration: number;
  created_at: string;
}

export interface CandidateDetail {
  email: string;
  name: string;
  interviews: CandidateInterview[];
  feedback: CandidateFeedbackSummary[];
}
