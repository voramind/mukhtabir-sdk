import * as z from "zod/v4";
import { describe, expect, it } from "vitest";

import {
  addInterviewCriteriaSchema,
  addInterviewQuestionSchema,
  addInterviewSubquestionSchema,
  createInterviewShape,
  promptInterviewWorkflowShape,
  registerCandidateShape,
  updateInterviewCriteriaSchema,
  updateInterviewQuestionSchema,
  updateInterviewSubquestionSchema,
} from "../src/schemas";

describe("tool and prompt schemas", () => {
  it("accepts docs-first interview creation inputs", () => {
    const schema = z.object(createInterviewShape);

    expect(
      schema.parse({
        role: "Backend Engineer",
        type: "technical",
        level: "senior",
        duration: 45,
        techstack: ["typescript", "postgres"],
      }),
    ).toMatchObject({
      role: "Backend Engineer",
      type: "technical",
      level: "senior",
    });
  });

  it("rejects invalid candidate registration emails", () => {
    const schema = z.object(registerCandidateShape);

    expect(() =>
      schema.parse({
        email: "not-an-email",
        name: "Candidate Example",
      }),
    ).toThrow(/email/i);
  });

  it("rejects backend-only interview variants outside the docs-first contract", () => {
    const schema = z.object(promptInterviewWorkflowShape);

    expect(() =>
      schema.parse({
        role: "Principal Engineer",
        type: "architecture",
      }),
    ).toThrow(/Invalid option/i);
  });

  it("accepts nested interview-content mutation shapes", () => {
    expect(
      addInterviewQuestionSchema.parse({
        id: "int_123",
        question: "How do you design rate limits?",
        subquestions: ["How do you track quotas?"],
        order_index: 0,
      }),
    ).toMatchObject({
      id: "int_123",
      question: "How do you design rate limits?",
    });

    expect(
      addInterviewSubquestionSchema.parse({
        id: "int_123",
        question_id: "q_123",
        subquestion: "How do you avoid thundering herds?",
        order_index: 1,
      }),
    ).toMatchObject({
      question_id: "q_123",
      subquestion: "How do you avoid thundering herds?",
    });

    expect(
      addInterviewCriteriaSchema.parse({
        id: "int_123",
        criteria_title: "Operational excellence",
        description: "Evaluates incident response and ownership.",
        order_index: 2,
      }),
    ).toMatchObject({
      criteria_title: "Operational excellence",
    });
  });

  it("requires nested IDs for update mutation shapes", () => {
    expect(() =>
      updateInterviewQuestionSchema.parse({
        id: "int_123",
        question: "Updated prompt",
      }),
    ).toThrow(/question_id/i);

    expect(() =>
      updateInterviewSubquestionSchema.parse({
        id: "int_123",
        question_id: "q_123",
        subquestion: "Updated follow-up",
      }),
    ).toThrow(/subquestion_id/i);

    expect(() =>
      updateInterviewCriteriaSchema.parse({
        id: "int_123",
        description: "Updated guidance",
      }),
    ).toThrow(/criteria_id/i);
  });

  it("rejects undocumented nested mutation fields", () => {
    expect(() =>
      addInterviewQuestionSchema.parse({
        id: "int_123",
        question: "How do you design retries?",
        disabled: true,
      }),
    ).toThrow(/unrecognized/i);

    expect(() =>
      updateInterviewSubquestionSchema.parse({
        id: "int_123",
        question_id: "q_123",
        subquestion_id: "sq_123",
        criteria_title: "Wrong field",
      }),
    ).toThrow(/unrecognized/i);

    expect(() =>
      addInterviewCriteriaSchema.parse({
        id: "int_123",
        criteria_title: "Communication",
        disabled: true,
      }),
    ).toThrow(/unrecognized/i);
  });
});
