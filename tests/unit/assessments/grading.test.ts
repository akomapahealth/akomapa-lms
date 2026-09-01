import { describe, expect, it } from "vitest";

import {
  gradeSubmission,
  validateSubmission,
  type GradableQuestion,
} from "@/lib/assessments/grading";

/**
 * Submission validation and grading (#41).
 *
 * Answers arrived entirely unvalidated: nothing checked that a `questionId`
 * belonged to the Quiz being graded, that a `selectedOptionId` belonged to that
 * Question, or that a Question was answered only once. Foreign-but-real ids
 * satisfy the database's foreign keys, so they were written and graded without
 * complaint.
 */
const question = (
  id: string,
  correctId: string,
  points = 1
): GradableQuestion => ({
  id,
  points,
  options: [
    { id: `${id}_a`, isCorrect: `${id}_a` === correctId },
    { id: `${id}_b`, isCorrect: `${id}_b` === correctId },
  ],
});

const QUIZ = [question("q1", "q1_a"), question("q2", "q2_b", 3)];

describe("validateSubmission", () => {
  it("accepts a well-formed submission", () => {
    expect(
      validateSubmission(QUIZ, [
        { questionId: "q1", selectedOptionId: "q1_a" },
        { questionId: "q2", selectedOptionId: "q2_b" },
      ])
    ).toBeNull();
  });

  it("accepts an empty submission, which scores zero rather than failing", () => {
    expect(validateSubmission(QUIZ, [])).toBeNull();
  });

  it("rejects a Question that is not in this Quiz", () => {
    // The id may well exist -- in another Quiz. Foreign keys do not care.
    expect(
      validateSubmission(QUIZ, [{ questionId: "q_from_other_quiz", selectedOptionId: "q1_a" }])
    ).toEqual({ reason: "unknown_question", questionId: "q_from_other_quiz" });
  });

  it("rejects an option that belongs to a different Question", () => {
    expect(
      validateSubmission(QUIZ, [{ questionId: "q1", selectedOptionId: "q2_a" }])
    ).toEqual({ reason: "option_not_in_question", questionId: "q1" });
  });

  it("rejects an option that does not exist", () => {
    expect(
      validateSubmission(QUIZ, [{ questionId: "q1", selectedOptionId: "made_up" }])
    ).toEqual({ reason: "option_not_in_question", questionId: "q1" });
  });

  it("rejects the same Question answered twice", () => {
    // Two answers for one Question would both be written, and the grader would
    // silently use whichever it found first.
    expect(
      validateSubmission(QUIZ, [
        { questionId: "q1", selectedOptionId: "q1_a" },
        { questionId: "q1", selectedOptionId: "q1_b" },
      ])
    ).toEqual({ reason: "duplicate_question", questionId: "q1" });
  });
});

describe("gradeSubmission", () => {
  it("awards a question's points only for the correct option", () => {
    const grade = gradeSubmission(QUIZ, [
      { questionId: "q1", selectedOptionId: "q1_a" },
      { questionId: "q2", selectedOptionId: "q2_a" },
    ]);

    expect(grade.totalScore).toBe(1);
    expect(grade.totalPoints).toBe(4);
    expect(grade.percentage).toBe(25);
  });

  it("counts every Question toward the total, answered or not", () => {
    // Skipping a Question must not raise the percentage by shrinking the
    // denominator.
    const grade = gradeSubmission(QUIZ, [{ questionId: "q1", selectedOptionId: "q1_a" }]);

    expect(grade.totalPoints).toBe(4);
    expect(grade.percentage).toBe(25);
  });

  it("scores an empty submission as zero, not as complete", () => {
    const grade = gradeSubmission(QUIZ, []);

    expect(grade).toMatchObject({ totalScore: 0, totalPoints: 4, percentage: 0 });
  });

  it("reports which option was correct alongside what was chosen", () => {
    const grade = gradeSubmission(QUIZ, [{ questionId: "q1", selectedOptionId: "q1_b" }]);

    expect(grade.results[0]).toEqual({
      questionId: "q1",
      correct: false,
      selectedOptionId: "q1_b",
      correctOptionId: "q1_a",
    });
    expect(grade.results[1].selectedOptionId).toBeNull();
  });

  it("does not mark an unanswered Question correct when it has no correct option", () => {
    // The original comparison was `userAnswer?.selectedOptionId === correctOption?.id`,
    // which is `undefined === undefined` -- true -- for an unanswered Question on
    // a Quiz where nobody marked an option correct. That awarded free points.
    // #65 stops such a Quiz being published; grading must not reward it either.
    const broken: GradableQuestion[] = [
      { id: "q1", points: 5, options: [{ id: "q1_a", isCorrect: false }] },
    ];

    const grade = gradeSubmission(broken, []);

    expect(grade.results[0].correct).toBe(false);
    expect(grade.totalScore).toBe(0);
  });

  it("rounds the percentage to a whole number", () => {
    const thirds = [question("a", "a_a"), question("b", "b_a"), question("c", "c_a")];

    const grade = gradeSubmission(thirds, [{ questionId: "a", selectedOptionId: "a_a" }]);

    expect(grade.percentage).toBe(33);
  });

  it("reports zero rather than dividing by zero for a Quiz with no Questions", () => {
    expect(gradeSubmission([], [])).toMatchObject({ totalPoints: 0, percentage: 0 });
  });
});
