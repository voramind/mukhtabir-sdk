import { Mukhtabir } from "../src/index";

import { appLogger } from "./app-logger";

const client = new Mukhtabir({
  apiKey: process.env.MUKHTABIR_API_KEY ?? "mk_demo",
});

async function main() {
  const created = await client.interviews.create({
    role: "Backend Engineer",
    type: "technical",
    level: "mid",
    duration: 30,
    techstack: ["Node.js", "PostgreSQL"],
  });

  const interviewId = created.data.interview_id;
  await client.interviews.publish(interviewId);

  const invite = await client.interviews.invite(interviewId, {
    email: "candidate@example.com",
    name: "Candidate Example",
  });

  appLogger.info("Mukhtabir invite created", {
    interviewUrl: invite.data.interview_url,
  });
}

void main();
