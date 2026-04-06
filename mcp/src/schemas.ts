import * as z from "zod/v4";

import {
  INTERVIEW_LEVELS,
  INTERVIEW_TYPES,
  INTERVIEW_VISIBILITIES,
  WEBHOOK_EVENTS,
} from "../../typescript/src/types";

const nonEmptyString = z.string().trim().min(1);
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().min(0);

export const idShape = {
  id: nonEmptyString.describe("Mukhtabir resource ID"),
};

export const interviewIdShape = {
  interview_id: nonEmptyString.describe("Mukhtabir interview ID"),
};

export const emailShape = {
  email: z.string().email().describe("Candidate email address"),
};

export const pageShape = {
  page: positiveInteger.optional().describe("Page number"),
  page_size: positiveInteger.optional().describe("Page size"),
};

export const createInterviewShape = {
  role: nonEmptyString.describe("Role title for the interview"),
  type: z.enum(INTERVIEW_TYPES).optional().describe("Interview type"),
  level: z
    .enum(INTERVIEW_LEVELS)
    .optional()
    .describe("Interview seniority level"),
  duration: positiveInteger
    .optional()
    .describe("Interview duration in minutes"),
  techstack: z
    .array(nonEmptyString)
    .optional()
    .describe("Relevant technologies"),
  max_score: positiveInteger.optional().describe("Maximum interview score"),
  visibility: z
    .enum(INTERVIEW_VISIBILITIES)
    .optional()
    .describe("Interview visibility"),
};

export const updateInterviewShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  role: nonEmptyString.optional().describe("Updated role title"),
  duration: positiveInteger.optional().describe("Updated duration in minutes"),
  visibility: z
    .enum(INTERVIEW_VISIBILITIES)
    .optional()
    .describe("Updated visibility"),
  published: z.boolean().optional().describe("Published status"),
};

export const inviteCandidateShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  email: z.string().email().describe("Candidate email address"),
  name: nonEmptyString.describe("Candidate full name"),
  expires_in_hours: positiveInteger
    .optional()
    .describe("Invitation lifetime in hours"),
};

export const addInterviewQuestionShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  question: nonEmptyString.describe("Question text"),
  subquestions: z
    .array(nonEmptyString)
    .optional()
    .describe("Initial subquestions"),
  order_index: nonNegativeInteger.optional().describe("Display order index"),
};
export const addInterviewQuestionSchema = z
  .object(addInterviewQuestionShape)
  .strict();

export const updateInterviewQuestionShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  question_id: nonEmptyString.describe("Question ID"),
  question: nonEmptyString.optional().describe("Updated question text"),
  disabled: z.boolean().optional().describe("Disabled status"),
  order_index: nonNegativeInteger
    .optional()
    .describe("Updated display order index"),
};
export const updateInterviewQuestionSchema = z
  .object(updateInterviewQuestionShape)
  .strict();

export const deleteInterviewQuestionShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  question_id: nonEmptyString.describe("Question ID"),
};
export const deleteInterviewQuestionSchema = z
  .object(deleteInterviewQuestionShape)
  .strict();

export const addInterviewSubquestionShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  question_id: nonEmptyString.describe("Question ID"),
  subquestion: nonEmptyString.describe("Subquestion text"),
  order_index: nonNegativeInteger.optional().describe("Display order index"),
};
export const addInterviewSubquestionSchema = z
  .object(addInterviewSubquestionShape)
  .strict();

export const updateInterviewSubquestionShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  question_id: nonEmptyString.describe("Question ID"),
  subquestion_id: nonEmptyString.describe("Subquestion ID"),
  subquestion: nonEmptyString.optional().describe("Updated subquestion text"),
  disabled: z.boolean().optional().describe("Disabled status"),
  order_index: nonNegativeInteger
    .optional()
    .describe("Updated display order index"),
};
export const updateInterviewSubquestionSchema = z
  .object(updateInterviewSubquestionShape)
  .strict();

export const deleteInterviewSubquestionShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  question_id: nonEmptyString.describe("Question ID"),
  subquestion_id: nonEmptyString.describe("Subquestion ID"),
};
export const deleteInterviewSubquestionSchema = z
  .object(deleteInterviewSubquestionShape)
  .strict();

export const addInterviewCriteriaShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  criteria_title: nonEmptyString.describe("Evaluation criteria title"),
  description: nonEmptyString.optional().describe("Criteria description"),
  order_index: nonNegativeInteger.optional().describe("Display order index"),
};
export const addInterviewCriteriaSchema = z
  .object(addInterviewCriteriaShape)
  .strict();

export const updateInterviewCriteriaShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  criteria_id: nonEmptyString.describe("Criteria ID"),
  criteria_title: nonEmptyString.optional().describe("Updated criteria title"),
  description: nonEmptyString
    .optional()
    .describe("Updated criteria description"),
  disabled: z.boolean().optional().describe("Disabled status"),
  order_index: nonNegativeInteger
    .optional()
    .describe("Updated display order index"),
};
export const updateInterviewCriteriaSchema = z
  .object(updateInterviewCriteriaShape)
  .strict();

export const deleteInterviewCriteriaShape = {
  id: nonEmptyString.describe("Mukhtabir interview ID"),
  criteria_id: nonEmptyString.describe("Criteria ID"),
};
export const deleteInterviewCriteriaSchema = z
  .object(deleteInterviewCriteriaShape)
  .strict();

export const registerCandidateShape = {
  email: z.string().email().describe("Candidate email address"),
  name: nonEmptyString.describe("Candidate full name"),
  interview_id: nonEmptyString.optional().describe("Interview ID to attach"),
};

export const createWebhookShape = {
  url: z.string().url().describe("Webhook endpoint URL"),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1)
    .describe("Webhook event subscriptions"),
  description: nonEmptyString.optional().describe("Webhook description"),
};

export const updateWebhookShape = {
  id: nonEmptyString.describe("Mukhtabir webhook ID"),
  url: z.string().url().optional().describe("Updated webhook endpoint URL"),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1)
    .optional()
    .describe("Updated event subscriptions"),
  description: nonEmptyString.optional().describe("Updated description"),
  is_active: z.boolean().optional().describe("Active status"),
};

export const promptInterviewWorkflowShape = {
  role: nonEmptyString.optional().describe("Known interview role"),
  type: z.enum(INTERVIEW_TYPES).optional().describe("Known interview type"),
  level: z.enum(INTERVIEW_LEVELS).optional().describe("Known interview level"),
  duration: positiveInteger.optional().describe("Known duration in minutes"),
  visibility: z
    .enum(INTERVIEW_VISIBILITIES)
    .optional()
    .describe("Known visibility"),
  techstack: z.array(nonEmptyString).optional().describe("Known tech stack"),
  publish_after_create: z
    .boolean()
    .optional()
    .describe("Whether the workflow should publish after creation"),
};

export const promptInviteWorkflowShape = {
  interview_id: nonEmptyString.describe("Mukhtabir interview ID"),
  candidate_name: nonEmptyString.optional().describe("Candidate full name"),
  candidate_email: z
    .string()
    .email()
    .optional()
    .describe("Candidate email address"),
};

export const promptFeedbackSummaryShape = {
  feedback_id: nonEmptyString.describe("Mukhtabir feedback ID"),
  include_transcript: z
    .boolean()
    .optional()
    .describe("Whether to include transcript evidence"),
};

export const promptInterviewAnalyticsShape = {
  interview_id: nonEmptyString.describe("Mukhtabir interview ID"),
};

export const promptWebhookTriageShape = {
  webhook_id: nonEmptyString.describe("Mukhtabir webhook ID"),
  page_size: positiveInteger
    .optional()
    .describe("How many recent deliveries to inspect"),
};
