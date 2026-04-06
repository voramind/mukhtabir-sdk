import { MukhtabirTransport } from "./core/transport";
import type { MukhtabirOptions } from "./core/types";
import { CandidatesResource } from "./resources/candidates";
import { FeedbackResource } from "./resources/feedback";
import { InterviewsResource } from "./resources/interviews";
import { WebhooksResource } from "./resources/webhooks";

export class Mukhtabir {
  readonly interviews: InterviewsResource;
  readonly candidates: CandidatesResource;
  readonly feedback: FeedbackResource;
  readonly webhooks: WebhooksResource;

  constructor(options: MukhtabirOptions) {
    const transport = new MukhtabirTransport(options);

    this.interviews = new InterviewsResource(transport);
    this.candidates = new CandidatesResource(transport);
    this.feedback = new FeedbackResource(transport);
    this.webhooks = new WebhooksResource(transport);
  }
}

export type MukhtabirClient = Mukhtabir;
