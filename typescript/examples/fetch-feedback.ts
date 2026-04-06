import { Mukhtabir } from "../src/index";

import { appLogger } from "./app-logger";

const apiKey = process.env.MUKHTABIR_API_KEY;
const feedbackId = process.env.MUKHTABIR_FEEDBACK_ID;

if (!apiKey || !feedbackId) {
  throw new Error(
    "Set MUKHTABIR_API_KEY and MUKHTABIR_FEEDBACK_ID to run this example.",
  );
}

const resolvedApiKey = apiKey;
const resolvedFeedbackId = feedbackId;
const client = new Mukhtabir({ apiKey: resolvedApiKey });

async function main() {
  const feedback = await client.feedback.get(resolvedFeedbackId);
  const transcript = await client.feedback.transcript(resolvedFeedbackId);
  const recording = await client.feedback.recordingUrl(resolvedFeedbackId);

  appLogger.info("Mukhtabir feedback loaded", {
    totalScore: feedback.data.total_score,
    transcript: transcript.data.transcript,
    recordingUrl: recording.data.recording_url,
  });
}

void main();
