export interface FeedbackCategoryScore {
  name: string;
  score: number;
  comment?: string | null;
}

export interface FeedbackDetail {
  id: string;
  interview_id: string;
  total_score: number;
  interviewee_email: string;
  interviewee_name: string;
  interview_duration: number;
  evaluation_model: string | null;
  resume_file_name: string | null;
  category_scores: FeedbackCategoryScore[];
  strengths: string[];
  areas_for_improvement: string[];
  final_assessment: string | null;
  created_at: string;
  evaluated_at: string | null;
}

export interface FeedbackTranscript {
  feedback_id: string;
  interview_id: string;
  transcript: string | null;
}

export interface FeedbackRecordingUrl {
  feedback_id: string;
  recording_url: string;
  source: "local" | "external";
}
