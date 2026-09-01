import { beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import { aCaseStudyRow, aCourseWithTopic, aUserRow } from "./support/fixtures";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth }));
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const { POST } = await import("@/app/api/courses/[courseId]/case-studies/route");
const { PATCH } = await import(
  "@/app/api/courses/[courseId]/case-studies/[caseStudyId]/route"
);

/**
 * Case study rich text is sanitized before it is stored.
 *
 * Sanitizing on read is what protects learners from rows written before the
 * fix; sanitizing on write is what stops the database accumulating more of
 * them. This proves the write half against a real database, through the real
 * route handler.
 */
const hostileScenario = (topicId?: string) => ({
  introduction: '<p>Welcome</p><script>alert(1)</script>',
  conclusion: '<img src=x onerror="alert(1)">Done',
  steps: [
    {
      id: "step_1",
      narrative: '<p>Story</p><iframe src="https://evil.test"></iframe>',
      question: "Is n < 30 acceptable?",
      choices: [
        { id: "c1", text: "A", consequence: "X", ethicalScore: 80, feedback: "good" },
        { id: "c2", text: "B", consequence: "Y", ethicalScore: 20, feedback: "bad" },
      ],
    },
  ],
  ...(topicId ? { topicId } : {}),
});

describe("case study authoring sanitizes on write", () => {
  let author: { id: string };
  let course: Awaited<ReturnType<typeof aCourseWithTopic>>;

  beforeEach(async () => {
    author = await aUserRow({ role: "FACULTY" });
    course = await aCourseWithTopic(author.id);
    clerkAuth.mockResolvedValue({ userId: author.id });
  });

  it("stores no script, handler, or iframe from a hostile scenario", async () => {
    const scenario = hostileScenario();

    const response = await POST(
      new Request("http://localhost/case-studies", {
        method: "POST",
        body: JSON.stringify({
          topicId: course.topic.id,
          title: "Consent",
          description: "d",
          scenario,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ courseId: course.course.id }) }
    );

    expect(response.status).toBe(200);

    const stored = await testDb().caseStudy.findFirst();
    const json = JSON.stringify(stored?.scenario);

    expect(json).not.toMatch(/<script/i);
    expect(json).not.toMatch(/onerror/i);
    expect(json).not.toMatch(/<iframe/i);
    // The legitimate formatting survives.
    expect(json).toContain("Welcome");
  });

  it("leaves text fields with angle brackets alone", async () => {
    await POST(
      new Request("http://localhost/case-studies", {
        method: "POST",
        body: JSON.stringify({
          topicId: course.topic.id,
          title: "Consent",
          description: "d",
          scenario: hostileScenario(),
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ courseId: course.course.id }) }
    );

    const stored = await testDb().caseStudy.findFirst();
    const scenario = stored?.scenario as { steps: { question: string }[] };

    // Rendered as a JSX text node, so React escapes it. Sanitizing here would
    // silently rewrite a legitimate statistical expression.
    expect(scenario.steps[0].question).toBe("Is n < 30 acceptable?");
  });

  it("sanitizes an update as well as a creation", async () => {
    const existing = await aCaseStudyRow(course.topic.id, {
      introduction: "<p>clean</p>",
      conclusion: "<p>clean</p>",
      steps: hostileScenario().steps.map((s) => ({ ...s, narrative: "<p>clean</p>" })),
    });

    const response = await PATCH(
      new Request("http://localhost/case-studies/x", {
        method: "PATCH",
        body: JSON.stringify({ scenario: hostileScenario() }),
        headers: { "content-type": "application/json" },
      }),
      {
        params: Promise.resolve({
          courseId: course.course.id,
          caseStudyId: existing.id,
        }),
      }
    );

    expect(response.status).toBe(200);

    const stored = await testDb().caseStudy.findUnique({ where: { id: existing.id } });
    expect(JSON.stringify(stored?.scenario)).not.toMatch(/<script|onerror|<iframe/i);
  });

  it("still refuses an author who does not own the Course", async () => {
    const stranger = await aUserRow({ role: "FACULTY" });
    clerkAuth.mockResolvedValue({ userId: stranger.id });

    const response = await POST(
      new Request("http://localhost/case-studies", {
        method: "POST",
        body: JSON.stringify({
          topicId: course.topic.id,
          title: "Consent",
          description: "d",
          scenario: hostileScenario(),
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ courseId: course.course.id }) }
    );

    expect(response.status).toBe(404);
    expect(await testDb().caseStudy.count()).toBe(0);
  });
});
