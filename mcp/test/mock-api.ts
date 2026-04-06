import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const CREATED_INTERVIEW_ID = "int_created";
const INTERVIEW_RESULTS_ID = "int_123";
const CREATED_WEBHOOK_ID = "wh_created";
const WEBHOOK_DELIVERIES_ID = "wh_123";
const RATE_LIMITED_WEBHOOK_ID = "wh_retry";
const CANDIDATE_EMAIL = "candidate@example.com";
const CREATED_QUESTION_ID = "q_created";
const CREATED_SUBQUESTION_ID = "sq_created";
const CREATED_CRITERIA_ID = "crit_created";

export const transcriptText = [
  "Interviewer: Tell me about a backend system you designed.",
  "Candidate: I designed a high-volume job ingestion pipeline with queue-based fan-out.",
  "Interviewer: What tradeoffs did you make around retries and backpressure?",
  "Candidate: I used bounded queues and idempotent workers to avoid duplicate writes.",
].join("\n");

const interviewDetail = {
  id: INTERVIEW_RESULTS_ID,
  role: "Backend Engineer",
  level: "senior",
  type: "technical",
  userId: "usr_123",
  userName: "Hiring Manager",
  duration: 45,
  finalized: true,
  published: true,
  visibility: "private",
  maxScore: 100,
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-03-01T01:00:00Z",
  techstack: ["typescript", "postgres", "redis"],
  questions: [
    {
      id: "q_123",
      question: "How would you scale an event-driven system?",
      disabled: false,
      orderIndex: 0,
      subquestions: [
        {
          id: "sq_123",
          text: "How do you handle retries?",
          disabled: false,
          orderIndex: 0,
        },
        {
          id: "sq_124",
          text: "How do you handle idempotency?",
          disabled: true,
          orderIndex: 1,
        },
      ],
    },
  ],
  evaluationCriteriaList: [
    {
      id: "crit_123",
      criteriaTitle: "System design",
      description: "Evaluate architecture tradeoffs and scalability reasoning.",
      disabled: false,
      orderIndex: 0,
      scoringGuides: [
        {
          scoreRange: "90-100",
          description: "Demonstrates strong architectural judgment.",
        },
      ],
    },
  ],
  performanceLevels: [
    {
      minScore: 90,
      maxScore: 100,
      label: "Strong hire",
      colorClass: "green",
    },
  ],
  collaborators: [],
  interviewees: [
    {
      userId: null,
      email: CANDIDATE_EMAIL,
      status: "completed",
      invitedAt: "2026-03-01T02:00:00Z",
      completedAt: "2026-03-01T02:45:00Z",
    },
  ],
  attachmentRequirements: [],
};

const interviewAnalytics = {
  interview_id: INTERVIEW_RESULTS_ID,
  max_possible_score: 100,
  total_candidates: 6,
  evaluated_count: 5,
  average_score: 91,
  min_score: 84,
  max_score: 97,
  average_duration_seconds: 2_340,
  category_averages: [
    {
      name: "system_design",
      average_score: 90.6,
      sample_count: 5,
    },
  ],
  completion: {
    pending: 1,
    completed: 5,
  },
};

const interviewResults = Array.from({ length: 6 }, (_, index) => ({
  id: `result_${index + 1}`,
  interview_id: INTERVIEW_RESULTS_ID,
  total_score: 96 - index,
  interviewee_email: `candidate${index + 1}@example.com`,
  interviewee_name: `Candidate ${index + 1}`,
  interview_duration: 2_400,
  evaluation_model: "gpt-4.1-mini",
  category_scores: [
    {
      name: "system_design",
      score: 92 - index,
      comment: "Solid reasoning under load.",
    },
  ],
  created_at: `2026-03-0${(index % 9) + 1}T00:00:00Z`,
  evaluated_at: `2026-03-0${(index % 9) + 1}T00:10:00Z`,
}));

const webhookDeliveries = Array.from({ length: 6 }, (_, index) => ({
  id: `wd_${index + 1}`,
  event_type: index % 2 === 0 ? "evaluation.generated" : "candidate.invited",
  status: index === 0 ? "failed" : "delivered",
  response_status: index === 0 ? 500 : 202,
  attempt_number: index + 1,
  error_message: index === 0 ? "Upstream endpoint returned 500." : null,
  delivered_at: index === 0 ? null : `2026-03-0${(index % 9) + 1}T01:00:00Z`,
  next_retry_at: index === 0 ? "2026-03-14T12:00:00Z" : null,
  created_at: `2026-03-0${(index % 9) + 1}T00:55:00Z`,
}));

const candidateSummary = {
  email: CANDIDATE_EMAIL,
  name: "Candidate Example",
  total_tokens: 1,
  completed_interviews: 1,
  first_invited_at: "2026-03-01T02:00:00Z",
  last_invited_at: "2026-03-01T02:00:00Z",
};

const candidateDetail = {
  email: CANDIDATE_EMAIL,
  name: "Candidate Example",
  interviews: [
    {
      interview_id: INTERVIEW_RESULTS_ID,
      interview_role: "Backend Engineer",
      interview_type: "technical",
      status: "completed",
      invited_at: "2026-03-01T02:00:00Z",
      completed_at: "2026-03-01T02:45:00Z",
      expires_at: "2026-03-20T00:00:00Z",
    },
  ],
  feedback: [
    {
      feedback_id: "fb_123",
      interview_id: INTERVIEW_RESULTS_ID,
      interview_role: "Backend Engineer",
      total_score: 94,
      interview_duration: 2_400,
      created_at: "2026-03-02T00:00:00Z",
    },
  ],
};

const feedbackRecording = {
  feedback_id: "fb_123",
  recording_url: "https://cdn.example.test/recordings/fb_123.mp4",
  source: "external",
};

const webhookRecord = {
  id: WEBHOOK_DELIVERIES_ID,
  url: "https://hooks.example.test/mukhtabir",
  events: ["evaluation.generated", "candidate.invited"],
  description: "Primary delivery target",
  is_active: true,
  failure_count: 1,
  last_triggered_at: "2026-03-14T00:55:00Z",
  created_at: "2026-03-10T00:00:00Z",
  updated_at: "2026-03-14T00:55:00Z",
};

function apiMeta() {
  return {
    request_id: "req_test_123",
    timestamp: "2026-03-14T00:00:00Z",
  };
}

function respondJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");

  return text ? JSON.parse(text) : {};
}

function parsePage(url: URL) {
  return Number(url.searchParams.get("page") ?? "1");
}

function parsePageSize(url: URL) {
  return Number(url.searchParams.get("page_size") ?? "20");
}

function paginate<T>(items: T[], url: URL) {
  const page = parsePage(url);
  const pageSize = parsePageSize(url);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_more: page < totalPages,
    },
  };
}

export function createMockMukhtabirApi() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.headers.authorization !== "Bearer mk_test_123") {
      respondJson(res, 401, {
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid API key.",
        },
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/candidates") {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          email: body.email,
          name: body.name,
          access_token: "candidate_access_secret",
          interview_url:
            "https://mukhtabir.example/interviews/int_123?token=abc",
          expires_at: "2026-03-20T00:00:00Z",
          interview_id: body.interview_id ?? null,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/candidates") {
      const response = paginate([candidateSummary], url);

      respondJson(res, 200, {
        success: true,
        ...response,
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/candidates/${encodeURIComponent(CANDIDATE_EMAIL)}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: candidateDetail,
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/interviews") {
      respondJson(res, 200, {
        success: true,
        data: {
          interview_id: CREATED_INTERVIEW_ID,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: interviewDetail,
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}`
    ) {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          ...interviewDetail,
          role: body.role ?? interviewDetail.role,
          duration: body.duration ?? interviewDetail.duration,
          visibility: body.visibility ?? interviewDetail.visibility,
          published: body.published ?? interviewDetail.published,
          updatedAt: "2026-03-14T03:00:00Z",
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "DELETE" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          deleted: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === `/interviews/${CREATED_INTERVIEW_ID}/publish`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          published: true,
          interview_id: CREATED_INTERVIEW_ID,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === `/interviews/${CREATED_INTERVIEW_ID}/invite`
    ) {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          access_token: "invite_secret_token",
          interview_url: `https://mukhtabir.example/interviews/${CREATED_INTERVIEW_ID}?token=invite`,
          expires_at: "2026-03-21T00:00:00Z",
          candidate_email: body.email,
          candidate_name: body.name,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}/questions`
    ) {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          question_id: CREATED_QUESTION_ID,
          interview_id: INTERVIEW_RESULTS_ID,
          order_index: body.order_index ?? 1,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/questions/${CREATED_QUESTION_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          question_id: CREATED_QUESTION_ID,
          updated: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "DELETE" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/questions/${CREATED_QUESTION_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          question_id: CREATED_QUESTION_ID,
          deleted: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/questions/${CREATED_QUESTION_ID}/subquestions`
    ) {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          subquestion_id: CREATED_SUBQUESTION_ID,
          question_id: CREATED_QUESTION_ID,
          interview_id: INTERVIEW_RESULTS_ID,
          order_index: body.order_index ?? 1,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/questions/${CREATED_QUESTION_ID}/subquestions/${CREATED_SUBQUESTION_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          subquestion_id: CREATED_SUBQUESTION_ID,
          updated: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "DELETE" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/questions/${CREATED_QUESTION_ID}/subquestions/${CREATED_SUBQUESTION_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          subquestion_id: CREATED_SUBQUESTION_ID,
          deleted: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}/criteria`
    ) {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          criteria_id: CREATED_CRITERIA_ID,
          interview_id: INTERVIEW_RESULTS_ID,
          order_index: body.order_index ?? 1,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/criteria/${CREATED_CRITERIA_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          criteria_id: CREATED_CRITERIA_ID,
          updated: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "DELETE" &&
      url.pathname ===
        `/interviews/${INTERVIEW_RESULTS_ID}/criteria/${CREATED_CRITERIA_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          criteria_id: CREATED_CRITERIA_ID,
          deleted: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/interviews") {
      if (url.searchParams.get("page") === "429") {
        respondJson(
          res,
          429,
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests.",
            },
            meta: apiMeta(),
          },
          {
            "retry-after": "0",
          },
        );
        return;
      }

      respondJson(res, 200, {
        success: true,
        data: [
          {
            id: INTERVIEW_RESULTS_ID,
            role: "Backend Engineer",
            level: "senior",
            type: "technical",
            duration: 45,
            finalized: true,
            published: true,
            visibility: "private",
            max_score: 100,
            created_at: "2026-03-01T00:00:00Z",
            updated_at: "2026-03-01T01:00:00Z",
          },
        ],
        pagination: {
          page: parsePage(url),
          page_size: parsePageSize(url),
          total: 1,
          total_pages: 1,
          has_more: false,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}/results`
    ) {
      const response = paginate(interviewResults, url);

      respondJson(res, 200, {
        success: true,
        ...response,
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/interviews/${INTERVIEW_RESULTS_ID}/analytics`
    ) {
      respondJson(res, 200, {
        success: true,
        data: interviewAnalytics,
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/feedback/fb_123") {
      respondJson(res, 200, {
        success: true,
        data: {
          id: "fb_123",
          interview_id: INTERVIEW_RESULTS_ID,
          total_score: 94,
          interviewee_email: "candidate@example.com",
          interviewee_name: "Candidate Example",
          interview_duration: 2_400,
          evaluation_model: "gpt-4.1-mini",
          resume_file_name: null,
          category_scores: [
            {
              name: "system_design",
              score: 94,
              comment: "Clear architectural tradeoffs.",
            },
          ],
          strengths: ["Clear communication", "Strong tradeoff analysis"],
          areas_for_improvement: ["Could quantify capacity earlier"],
          final_assessment: "Strong hire.",
          created_at: "2026-03-02T00:00:00Z",
          evaluated_at: "2026-03-02T00:10:00Z",
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === "/feedback/fb_123/transcript"
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          feedback_id: "fb_123",
          interview_id: INTERVIEW_RESULTS_ID,
          transcript: transcriptText,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === "/feedback/fb_123/recording-url"
    ) {
      respondJson(res, 200, {
        success: true,
        data: feedbackRecording,
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/feedback/fb_missing") {
      respondJson(
        res,
        404,
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Feedback not found.",
          },
          meta: apiMeta(),
        },
        {
          "x-request-id": "req_feedback_404",
        },
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/webhooks") {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          id: CREATED_WEBHOOK_ID,
          url: body.url,
          events: body.events,
          description: body.description ?? null,
          secret_preview: "whsec_...redacted",
          secret: "whsec_live_created",
          is_active: true,
          created_at: "2026-03-14T01:00:00Z",
        },
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/webhooks") {
      const response = paginate([webhookRecord], url);

      respondJson(res, 200, {
        success: true,
        ...response,
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/webhooks/${WEBHOOK_DELIVERIES_ID}/deliveries`
    ) {
      const response = paginate(webhookDeliveries, url);

      respondJson(res, 200, {
        success: true,
        ...response,
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname === `/webhooks/${WEBHOOK_DELIVERIES_ID}`
    ) {
      const body = await readJsonBody(req);

      respondJson(res, 200, {
        success: true,
        data: {
          id: WEBHOOK_DELIVERIES_ID,
          url: body.url ?? webhookRecord.url,
          events: body.events ?? webhookRecord.events,
          description: body.description ?? webhookRecord.description,
          is_active: body.is_active ?? webhookRecord.is_active,
          updated_at: "2026-03-14T03:10:00Z",
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "DELETE" &&
      url.pathname === `/webhooks/${WEBHOOK_DELIVERIES_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          deleted: true,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/webhooks/${RATE_LIMITED_WEBHOOK_ID}/deliveries`
    ) {
      respondJson(
        res,
        429,
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests for webhook deliveries.",
            details: [
              {
                field: "page",
                issue: "Too many requests for deliveries.",
              },
            ],
          },
          meta: apiMeta(),
        },
        {
          "retry-after": "0",
        },
      );
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === `/webhooks/${WEBHOOK_DELIVERIES_ID}/test`
    ) {
      respondJson(res, 200, {
        success: true,
        data: {
          delivery_id: "wd_test_123",
          status: "pending",
          response_status: null,
          error_message: null,
        },
        meta: apiMeta(),
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/webhooks/${WEBHOOK_DELIVERIES_ID}`
    ) {
      respondJson(res, 200, {
        success: true,
        data: webhookRecord,
        meta: apiMeta(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/webhooks/wh_missing") {
      respondJson(
        res,
        404,
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Webhook not found.",
          },
          meta: apiMeta(),
        },
        {
          "x-request-id": "req_missing_404",
        },
      );
      return;
    }

    respondJson(res, 404, {
      success: false,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No mock route for ${req.method} ${url.pathname}.`,
      },
      meta: apiMeta(),
    });
  });
}
