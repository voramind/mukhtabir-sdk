export const FEEDBACK_RESOURCE_TEMPLATES = {
  feedback: "mukhtabir://feedback/{id}",
  feedbackTranscript: "mukhtabir://feedback/{id}/transcript",
  feedbackRecordingUrl: "mukhtabir://feedback/{id}/recording-url",
} as const;

export const feedbackResourceUri = {
  feedback: (id: string) => `mukhtabir://feedback/${encodeURIComponent(id)}`,
  feedbackTranscript: (id: string) =>
    `mukhtabir://feedback/${encodeURIComponent(id)}/transcript`,
  feedbackRecordingUrl: (id: string) =>
    `mukhtabir://feedback/${encodeURIComponent(id)}/recording-url`,
};
