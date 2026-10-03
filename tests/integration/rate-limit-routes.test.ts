import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS, TEST_ORIGIN } from "../support/origin";

import { testDb } from "./support/db";
import { aCourseWithTopic, aPaidEnrollment, aQuizWithQuestion, aUserRow } from "./support/fixtures";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth, currentUser: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});
vi.mock("@/lib/badge-service", () => ({ evaluateBadges: vi.fn().mockResolvedValue([]) }));

const { POST: createPost } = await import("@/app/api/community/posts/route");
const { POST: startQuiz } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/start/route"
);
const { POST: createJournal } = await import("@/app/api/journal/route");
const { POST: stripeWebhook } = await import("@/app/api/webhook/route");

/**
 * Rate limits on real route handlers, against a real database (#46).
 *
 * Only the Clerk session is mocked. The limiter, its PostgreSQL store, and the
 * handler behind it all run for real, so a refusal is checked three ways: the
 * status and Retry-After, the error body, and the absence of the write the
 * handler would have made.
 */

/** Requests as a browser on Vercel sends them: same origin, verified address. */
function headers(ip = "203.0.113.7"): Record<string, string> {
  return {
    ...SAME_ORIGIN_HEADERS,
    "content-type": "application/json",
    "x-vercel-forwarded-for": ip,
  };
}

async function codeOf(response: Response): Promise<string> {
  return (await response.json()).error.code;
}

beforeEach(() => {
  // On Vercel, so the verified address is believed and both dimensions apply.
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_integration");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("community.post", () => {
  let author: { id: string };
  let categoryId: string;

  beforeEach(async () => {
    author = await aUserRow();
    clerkAuth.mockResolvedValue({ userId: author.id });
    categoryId = (await testDb().forumCategory.create({ data: { name: `General ${Math.random()}` } })).id;
  });

  const post = (ip?: string) =>
    createPost(
      new Request(`${TEST_ORIGIN}/api/community/posts`, {
        method: "POST",
        body: JSON.stringify({ title: "Hello", content: "<p>Hi</p>", categoryId }),
        headers: headers(ip),
      })
    );

  it("allows the burst, then answers 429 with Retry-After and writes nothing more", async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await post()).status).toBe(200);
    }

    const refused = await post();

    expect(refused.status).toBe(429);
    // community.post sustains 20/hour: one every 180s.
    expect(refused.headers.get("retry-after")).toBe("180");
    expect(await codeOf(refused)).toBe("rate_limited");
    expect(await testDb().forumPost.count({ where: { userId: author.id } })).toBe(3);
  });

  it("follows the user across addresses", async () => {
    for (let i = 0; i < 3; i += 1) await post(`198.51.100.${i}`);

    expect((await post("198.51.100.200")).status).toBe(429);
  });

  it("does not limit another learner on the same campus address", async () => {
    for (let i = 0; i < 3; i += 1) await post();
    const classmate = await aUserRow();
    clerkAuth.mockResolvedValue({ userId: classmate.id });

    expect((await post()).status).toBe(200);
  });
});

describe("quiz.start", () => {
  let learner: { id: string };
  let courseId: string;
  let quizId: string;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);
    courseId = course.id;
    quizId = (await aQuizWithQuestion(course.id)).quiz.id;
    await aPaidEnrollment(learner.id, course.id);
    clerkAuth.mockResolvedValue({ userId: learner.id });
  });

  const start = (course = courseId, quiz = quizId) =>
    startQuiz(
      new Request(`${TEST_ORIGIN}/api/courses/${course}/quizzes/${quiz}/start`, {
        method: "POST",
        headers: headers(),
      }),
      { params: Promise.resolve({ courseId: course, quizId: quiz }) }
    );

  it("refuses the sixth start in an instant, without creating an attempt", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await start()).status).toBeLessThan(400);
    }
    const attempts = await testDb().quizAttempt.count({ where: { userId: learner.id } });

    const refused = await start();

    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("120");
    expect(await testDb().quizAttempt.count({ where: { userId: learner.id } })).toBe(attempts);
  });

  it("answers a limited caller identically whether or not the Quiz exists", async () => {
    for (let i = 0; i < 5; i += 1) await start();
    const missing = "00000000-0000-4000-8000-000000000000";

    const forReal = await start();
    const forNothing = await start(courseId, missing);
    const forNoCourse = await start(missing, missing);

    for (const response of [forReal, forNothing, forNoCourse]) {
      expect(response.status).toBe(429);
      expect(await codeOf(response)).toBe("rate_limited");
    }
    expect(forNothing.headers.get("retry-after")).toBe(forReal.headers.get("retry-after"));
  });
});

describe("refusals that come first do not spend the budget", () => {
  it("does not count an unauthenticated request", async () => {
    clerkAuth.mockResolvedValue({ userId: null });

    const response = await createJournal(
      new Request(`${TEST_ORIGIN}/api/journal`, {
        method: "POST",
        body: JSON.stringify({ title: "t", content: "<p>c</p>" }),
        headers: headers(),
      })
    );

    expect(response.status).toBe(401);
    expect(await testDb().rateLimitBucket.count()).toBe(0);
  });

  it("does not count a cross-site request", async () => {
    // A hostile page must not be able to exhaust a victim's allowance (#45).
    const learner = await aUserRow();
    clerkAuth.mockResolvedValue({ userId: learner.id });

    const response = await createJournal(
      new Request(`${TEST_ORIGIN}/api/journal`, {
        method: "POST",
        body: JSON.stringify({ title: "t", content: "<p>c</p>" }),
        headers: { ...headers(), origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      })
    );

    expect(response.status).toBe(403);
    expect(await testDb().rateLimitBucket.count()).toBe(0);
  });
});

describe("webhook.stripe", () => {
  it("limits forged deliveries by address before verifying a signature", async () => {
    const deliver = (ip: string) =>
      stripeWebhook(
        new Request(`${TEST_ORIGIN}/api/webhook`, {
          method: "POST",
          body: "{}",
          headers: { "x-vercel-forwarded-for": ip },
        })
      );

    // Unsigned deliveries reach signature checking until the burst is spent.
    const results = await Promise.all(Array.from({ length: 200 }, () => deliver("192.0.2.50")));
    expect(results.every((r) => r.status === 400)).toBe(true);

    const refused = await deliver("192.0.2.50");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).not.toBeNull();

    // Stripe's real senders, on other addresses, are unaffected.
    expect((await deliver("192.0.2.51")).status).toBe(400);
  });
});
