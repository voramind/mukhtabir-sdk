import { Mukhtabir } from "../../../typescript/src";

import {
  loadMukhtabirMcpConfig,
  type MukhtabirMcpConfigInput,
} from "../config";

export class MukhtabirApiAdapter {
  constructor(private readonly client: Mukhtabir) {}

  static fromConfig(configInput: MukhtabirMcpConfigInput = {}) {
    const config = loadMukhtabirMcpConfig(configInput);

    return new MukhtabirApiAdapter(
      new Mukhtabir({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      }),
    );
  }

  createInterview(input: Parameters<Mukhtabir["interviews"]["create"]>[0]) {
    return this.client.interviews.create(input);
  }

  listInterviews(query: Parameters<Mukhtabir["interviews"]["list"]>[0] = {}) {
    return this.client.interviews.list(query);
  }

  getInterview(id: string) {
    return this.client.interviews.get(id);
  }

  updateInterview(
    id: string,
    input: Parameters<Mukhtabir["interviews"]["update"]>[1],
  ) {
    return this.client.interviews.update(id, input);
  }

  publishInterview(id: string) {
    return this.client.interviews.publish(id);
  }

  deleteInterview(id: string) {
    return this.client.interviews.delete(id);
  }

  inviteCandidateToInterview(
    id: string,
    input: Parameters<Mukhtabir["interviews"]["invite"]>[1],
  ) {
    return this.client.interviews.invite(id, input);
  }

  addInterviewQuestion(
    id: string,
    input: Parameters<Mukhtabir["interviews"]["addQuestion"]>[1],
  ) {
    return this.client.interviews.addQuestion(id, input);
  }

  updateInterviewQuestion(
    id: string,
    questionId: string,
    input: Parameters<Mukhtabir["interviews"]["updateQuestion"]>[2],
  ) {
    return this.client.interviews.updateQuestion(id, questionId, input);
  }

  deleteInterviewQuestion(id: string, questionId: string) {
    return this.client.interviews.deleteQuestion(id, questionId);
  }

  addInterviewSubquestion(
    id: string,
    questionId: string,
    input: Parameters<Mukhtabir["interviews"]["addSubquestion"]>[2],
  ) {
    return this.client.interviews.addSubquestion(id, questionId, input);
  }

  updateInterviewSubquestion(
    id: string,
    questionId: string,
    subquestionId: string,
    input: Parameters<Mukhtabir["interviews"]["updateSubquestion"]>[3],
  ) {
    return this.client.interviews.updateSubquestion(
      id,
      questionId,
      subquestionId,
      input,
    );
  }

  deleteInterviewSubquestion(
    id: string,
    questionId: string,
    subquestionId: string,
  ) {
    return this.client.interviews.deleteSubquestion(
      id,
      questionId,
      subquestionId,
    );
  }

  addInterviewCriteria(
    id: string,
    input: Parameters<Mukhtabir["interviews"]["addCriteria"]>[1],
  ) {
    return this.client.interviews.addCriteria(id, input);
  }

  updateInterviewCriteria(
    id: string,
    criteriaId: string,
    input: Parameters<Mukhtabir["interviews"]["updateCriteria"]>[2],
  ) {
    return this.client.interviews.updateCriteria(id, criteriaId, input);
  }

  deleteInterviewCriteria(id: string, criteriaId: string) {
    return this.client.interviews.deleteCriteria(id, criteriaId);
  }

  listInterviewResults(
    id: string,
    query: Parameters<Mukhtabir["interviews"]["results"]>[1] = {},
  ) {
    return this.client.interviews.results(id, query);
  }

  getInterviewAnalytics(id: string) {
    return this.client.interviews.analytics(id);
  }

  registerCandidate(input: Parameters<Mukhtabir["candidates"]["create"]>[0]) {
    return this.client.candidates.create(input);
  }

  listCandidates(query: Parameters<Mukhtabir["candidates"]["list"]>[0] = {}) {
    return this.client.candidates.list(query);
  }

  getCandidate(email: string) {
    return this.client.candidates.get(email);
  }

  getFeedback(id: string) {
    return this.client.feedback.get(id);
  }

  getFeedbackTranscript(id: string) {
    return this.client.feedback.transcript(id);
  }

  getFeedbackRecordingUrl(id: string) {
    return this.client.feedback.recordingUrl(id);
  }

  createWebhook(input: Parameters<Mukhtabir["webhooks"]["create"]>[0]) {
    return this.client.webhooks.create(input);
  }

  listWebhooks(query: Parameters<Mukhtabir["webhooks"]["list"]>[0] = {}) {
    return this.client.webhooks.list(query);
  }

  getWebhook(id: string) {
    return this.client.webhooks.get(id);
  }

  updateWebhook(
    id: string,
    input: Parameters<Mukhtabir["webhooks"]["update"]>[1],
  ) {
    return this.client.webhooks.update(id, input);
  }

  deleteWebhook(id: string) {
    return this.client.webhooks.delete(id);
  }

  testWebhook(id: string) {
    return this.client.webhooks.test(id);
  }

  listWebhookDeliveries(
    id: string,
    query: Parameters<Mukhtabir["webhooks"]["deliveries"]>[1] = {},
  ) {
    return this.client.webhooks.deliveries(id, query);
  }
}
