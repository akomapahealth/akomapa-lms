/**
 * Grading and submission validation.
 *
 * Pure: no database, no clock. Grading determines a score that feeds
 * certificates and analytics, so the rules are worth testing directly rather
 * than inferring from a route handler.
 */

export interface GradableOption {
  id: string;
  isCorrect: boolean;
}

export interface GradableQuestion {
  id: string;
  points: number;
  options: GradableOption[];
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOptionId: string;
}

export type ValidationFailure =
  | { reason: "duplicate_question"; questionId: string }
  | { reason: "unknown_question"; questionId: string }
  | { reason: "option_not_in_question"; questionId: string };

/**
 * Rejects a submission whose shape does not match the Quiz being graded.
 *
 * Answers arrived unvalidated: nothing checked that a `questionId` belonged to
 * this Quiz, that a `selectedOptionId` belonged to that Question, or that a
 * Question was answered only once. Foreign-but-real ids satisfy the database's
 * foreign keys, so they were written and graded without complaint.
 */
export function validateSubmission(
  questions: GradableQuestion[],
  answers: SubmittedAnswer[]
): ValidationFailure | null {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();

  for (const answer of answers) {
    if (seen.has(answer.questionId)) {
      return { reason: "duplicate_question", questionId: answer.questionId };
    }
    seen.add(answer.questionId);

    const question = byId.get(answer.questionId);
    if (!question) {
      return { reason: "unknown_question", questionId: answer.questionId };
    }

    if (!question.options.some((option) => option.id === answer.selectedOptionId)) {
      return { reason: "option_not_in_question", questionId: answer.questionId };
    }
  }

  return null;
}

export interface GradedAnswer {
  questionId: string;
  correct: boolean;
  selectedOptionId: string | null;
  correctOptionId: string;
}

export interface Grade {
  totalScore: number;
  totalPoints: number;
  percentage: number;
  results: GradedAnswer[];
}

/**
 * Grades a validated submission against the Quiz's own questions.
 *
 * Every question in the Quiz contributes to `totalPoints`, answered or not, so
 * skipping a question cannot raise the percentage.
 */
export function gradeSubmission(
  questions: GradableQuestion[],
  answers: SubmittedAnswer[]
): Grade {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

  let totalScore = 0;
  let totalPoints = 0;
  const results: GradedAnswer[] = [];

  for (const question of questions) {
    const correctOption = question.options.find((option) => option.isCorrect);
    const submitted = byQuestion.get(question.id);

    totalPoints += question.points;

    // A Question with no correct option cannot be answered correctly. Comparing
    // `undefined === undefined` would otherwise mark an unanswered Question on a
    // misconfigured Quiz as correct. #65 stops such a Quiz being published.
    const correct =
      correctOption !== undefined &&
      submitted !== undefined &&
      submitted.selectedOptionId === correctOption.id;

    if (correct) totalScore += question.points;

    results.push({
      questionId: question.id,
      correct,
      selectedOptionId: submitted?.selectedOptionId ?? null,
      correctOptionId: correctOption?.id ?? "",
    });
  }

  return {
    totalScore,
    totalPoints,
    percentage: totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0,
    results,
  };
}
