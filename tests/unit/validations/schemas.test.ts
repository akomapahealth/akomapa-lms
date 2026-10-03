import { describe, expect, it } from "vitest";

import { COUNT, NUMBER } from "@/lib/http/limits";
import { attachmentCreateSchema, attachmentNameFrom } from "@/lib/validations/attachment";
import {
  caseStudyAttemptSchema,
  caseStudyCreateSchema,
  caseStudyUpdateSchema,
} from "@/lib/validations/case-study";
import {
  categoryUpdateSchema,
  commentCreateSchema,
  commentUpdateSchema,
  postCreateSchema,
  postUpdateSchema,
} from "@/lib/validations/community";
import { courseUpdateSchema } from "@/lib/validations/course";
import { clerkUserId, courseParams, resourceId } from "@/lib/validations/ids";
import { journalCreateSchema, journalUpdateSchema } from "@/lib/validations/journal";
import {
  quizCreateSchema,
  questionUpdateSchema,
  quizUpdateSchema,
  submissionSchema,
} from "@/lib/validations/quiz";
import { reorderSchema } from "@/lib/validations/reorder";
import { progressSchema, topicCreateSchema, topicUpdateSchema } from "@/lib/validations/topic";
import { checkoutMetadataSchema, clerkUserDataSchema, primaryEmailOf } from "@/lib/validations/webhooks";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("resourceId", () => {
  it("accepts a uuid and refuses anything else", () => {
    expect(resourceId.safeParse(A).success).toBe(true);
    for (const value of ["", "abc", `${A} `, `${A}x`, 1, null, "' OR 1=1--"]) {
      expect(resourceId.safeParse(value).success).toBe(false);
    }
  });
});

describe("clerkUserId", () => {
  it("accepts a Clerk subject and refuses a uuid", () => {
    // Clerk ids are not uuids; using the wrong schema would reject every webhook.
    expect(clerkUserId.safeParse("user_2abcDEF123").success).toBe(true);
    expect(clerkUserId.safeParse(A).success).toBe(false);
    expect(clerkUserId.safeParse("user_").success).toBe(false);
    expect(clerkUserId.safeParse("admin_1").success).toBe(false);
  });
});

describe("courseParams", () => {
  it("refuses an extra segment", () => {
    expect(courseParams.safeParse({ courseId: A, extra: "x" }).success).toBe(false);
  });
});

describe("progressSchema", () => {
  it("requires a real boolean", () => {
    // The value drives Enrollment status and certificate issuance, and JSON will
    // happily deliver a string or a number.
    expect(progressSchema.safeParse({ isCompleted: true }).success).toBe(true);
    for (const value of ["true", 1, "yes", null, {}]) {
      expect(progressSchema.safeParse({ isCompleted: value }).success).toBe(false);
    }
  });

  it("refuses unknown fields", () => {
    expect(progressSchema.safeParse({ isCompleted: true, userId: "someone" }).success).toBe(
      false
    );
  });
});

describe("courseUpdateSchema", () => {
  it("refuses a non-finite price", () => {
    // `Infinity` passed the previous `z.number().min(0)` and reached
    // `Math.round(price * 100)` in the checkout route.
    for (const price of [Infinity, -Infinity, NaN]) {
      expect(courseUpdateSchema.safeParse({ price }).success).toBe(false);
    }
  });

  it("bounds the price and refuses a negative one", () => {
    expect(courseUpdateSchema.safeParse({ price: NUMBER.maxPrice }).success).toBe(true);
    expect(courseUpdateSchema.safeParse({ price: NUMBER.maxPrice + 1 }).success).toBe(false);
    expect(courseUpdateSchema.safeParse({ price: -1 }).success).toBe(false);
  });

  it("allows clearing nullable fields", () => {
    expect(courseUpdateSchema.safeParse({ price: null, imageUrl: null }).success).toBe(true);
  });

  it("refuses an empty update", () => {
    // Otherwise a no-op write reports success.
    expect(courseUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("refuses a javascript: image URL", () => {
    expect(
      courseUpdateSchema.safeParse({ imageUrl: "javascript:alert(1)" }).success
    ).toBe(false);
  });
});

describe("quizCreateSchema", () => {
  it("requires a known type", () => {
    // `type` decides whether the post-test lock applies, so an unrecognised
    // value silently bypassed it.
    expect(quizCreateSchema.safeParse({ title: "Q", type: "POST_TEST" }).success).toBe(true);
    expect(quizCreateSchema.safeParse({ title: "Q", type: "ANYTHING" }).success).toBe(false);
    expect(quizCreateSchema.safeParse({ title: "Q" }).success).toBe(false);
  });
});

describe("questionUpdateSchema", () => {
  it("bounds the option count", () => {
    const option = { text: "x", isCorrect: false, position: 0 };
    const options = Array.from({ length: COUNT.options + 1 }, () => option);

    expect(questionUpdateSchema.safeParse({ options }).success).toBe(false);
  });

  it("refuses two options at one position (#51)", () => {
    const options = [
      { id: A, text: "a", isCorrect: true, position: 1 },
      { text: "b", isCorrect: false, position: 1 },
    ];

    const result = questionUpdateSchema.safeParse({ options });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("duplicate_option_position");
  });

  it("refuses the same option id twice", () => {
    const options = [
      { id: A, text: "a", isCorrect: true, position: 0 },
      { id: A, text: "b", isCorrect: false, position: 1 },
    ];

    expect(questionUpdateSchema.safeParse({ options }).success).toBe(false);
  });

  it("allows a mix of new and existing options", () => {
    const options = [
      { id: A, text: "a", isCorrect: true, position: 0 },
      { text: "b", isCorrect: false, position: 1 },
    ];

    expect(questionUpdateSchema.safeParse({ options }).success).toBe(true);
  });

  it("requires isCorrect to be a boolean", () => {
    // It decides grading.
    const options = [{ text: "a", isCorrect: "true", position: 0 }];
    expect(questionUpdateSchema.safeParse({ options }).success).toBe(false);
  });
});

describe("submissionSchema", () => {
  const answer = { questionId: A, selectedOptionId: B };

  it("accepts a well-formed submission", () => {
    expect(submissionSchema.safeParse({ attemptId: A, answers: [answer] }).success).toBe(true);
  });

  it("refuses two answers to the same question", () => {
    // Duplicates would create two QuizAnswer rows for one question and
    // double-count its score.
    const answers = [answer, { questionId: A, selectedOptionId: A }];

    expect(submissionSchema.safeParse({ attemptId: A, answers }).success).toBe(false);
  });

  it("bounds the answer count", () => {
    const answers = Array.from({ length: COUNT.answers + 1 }, (_, i) => ({
      questionId: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      selectedOptionId: B,
    }));

    expect(submissionSchema.safeParse({ attemptId: A, answers }).success).toBe(false);
  });

  it("requires uuids, not any non-empty string", () => {
    expect(
      submissionSchema.safeParse({ attemptId: "abc", answers: [answer] }).success
    ).toBe(false);
  });

  it("refuses unknown fields on an answer", () => {
    const answers = [{ ...answer, score: 100 }];
    expect(submissionSchema.safeParse({ attemptId: A, answers }).success).toBe(false);
  });
});

describe("reorderSchema", () => {
  it("accepts a bounded list with 0-based positions", () => {
    // The admin UI computes positions with findIndex, so 0 is legitimate.
    expect(reorderSchema.safeParse({ list: [{ id: A, position: 0 }] }).success).toBe(true);
  });

  it("refuses an empty list", () => {
    expect(reorderSchema.safeParse({ list: [] }).success).toBe(false);
  });

  it("refuses a list past the limit", () => {
    const list = Array.from({ length: COUNT.reorder + 1 }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      position: i,
    }));

    expect(reorderSchema.safeParse({ list }).success).toBe(false);
  });

  it("refuses a repeated id, where the last write would silently win", () => {
    const list = [
      { id: A, position: 0 },
      { id: A, position: 1 },
    ];

    expect(reorderSchema.safeParse({ list }).success).toBe(false);
  });

  it("refuses two rows at one position, which the unique index would refuse (#51)", () => {
    const result = reorderSchema.safeParse({
      list: [
        { id: A, position: 1 },
        { id: B, position: 1 },
      ],
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("duplicate_position");
  });

  it("accepts a swap", () => {
    expect(
      reorderSchema.safeParse({
        list: [
          { id: A, position: 2 },
          { id: B, position: 1 },
        ],
      }).success
    ).toBe(true);
  });

  it("refuses a non-integer or negative position", () => {
    expect(reorderSchema.safeParse({ list: [{ id: A, position: 1.5 }] }).success).toBe(false);
    expect(reorderSchema.safeParse({ list: [{ id: A, position: -1 }] }).success).toBe(false);
  });
});

describe("community schemas", () => {
  it("requires a uuid categoryId on create", () => {
    // It used to be any non-empty string, which then failed as a 500 on the
    // foreign key.
    const base = { title: "t", content: "<p>c</p>" };
    expect(postCreateSchema.safeParse({ ...base, categoryId: A }).success).toBe(true);
    expect(postCreateSchema.safeParse({ ...base, categoryId: "general" }).success).toBe(false);
  });

  it("refuses moderation fields on a post update", () => {
    // A learner must not pin or lock their own post through the update route.
    expect(postUpdateSchema.safeParse({ title: "t", isPinned: true }).success).toBe(false);
    expect(postUpdateSchema.safeParse({ title: "t", isLocked: true }).success).toBe(false);
    expect(postUpdateSchema.safeParse({ title: "t", userId: "someone" }).success).toBe(false);
  });

  it("treats a null parentId as a top-level comment", () => {
    expect(commentCreateSchema.safeParse({ content: "c", parentId: null }).success).toBe(true);
    expect(commentCreateSchema.safeParse({ content: "c" }).success).toBe(true);
  });
});

describe("journalCreateSchema", () => {
  it("requires isPrivate to be a boolean when present", () => {
    // `isPrivate ?? true` treated the string "false" as a value and stored a
    // public entry the learner believed was private.
    expect(journalCreateSchema.safeParse({ title: "t", content: "c", isPrivate: "false" }).success).toBe(
      false
    );
    expect(journalCreateSchema.safeParse({ title: "t", content: "c", isPrivate: false }).success).toBe(
      true
    );
  });

  it("refuses a userId supplied by the caller", () => {
    // Ownership comes from the principal.
    expect(
      journalCreateSchema.safeParse({ title: "t", content: "c", userId: "someone" }).success
    ).toBe(false);
  });
});

describe("attachment", () => {
  it("requires an http(s) URL", () => {
    expect(attachmentCreateSchema.safeParse({ url: "https://e.com/a.pdf" }).success).toBe(true);
    expect(attachmentCreateSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("derives a name, and never an empty one", () => {
    // `url.split("/").pop()` is `undefined` for a URL ending in a slash, and it
    // was written to a non-null column.
    expect(attachmentNameFrom("https://e.com/dir/notes.pdf")).toBe("notes.pdf");
    expect(attachmentNameFrom("https://e.com/dir/")).toBe("dir");
    expect(attachmentNameFrom("https://e.com/")).toBe("e.com");
    expect(attachmentNameFrom("https://e.com")).toBe("e.com");
  });

  it("decodes a percent-encoded name", () => {
    expect(attachmentNameFrom("https://e.com/my%20notes.pdf")).toBe("my notes.pdf");
  });
});

describe("caseStudyAttemptSchema", () => {
  it("accepts the flat array of choice ids the player posts", () => {
    expect(caseStudyAttemptSchema.safeParse({ choices: ["a", "b"], completed: true }).success).toBe(
      true
    );
  });

  it("refuses an unbounded or wrongly shaped blob", () => {
    expect(caseStudyAttemptSchema.safeParse({ choices: [{ stepId: "a" }] }).success).toBe(false);
    expect(
      caseStudyAttemptSchema.safeParse({
        choices: Array.from({ length: COUNT.scenarioSteps + 1 }, () => "a"),
      }).success
    ).toBe(false);
  });
});

describe("webhook envelopes", () => {
  it("requires both ids in Stripe checkout metadata", () => {
    // They are written to a Purchase row.
    expect(checkoutMetadataSchema.safeParse({ userId: "user_1", courseId: A }).success).toBe(true);
    expect(checkoutMetadataSchema.safeParse({ userId: "user_1" }).success).toBe(false);
    expect(checkoutMetadataSchema.safeParse({}).success).toBe(false);
    expect(checkoutMetadataSchema.safeParse({ userId: "user_1", courseId: "x" }).success).toBe(
      false
    );
  });

  it("tolerates extra Stripe metadata keys", () => {
    // Stripe may add its own, and a future feature may attach more.
    expect(
      checkoutMetadataSchema.safeParse({ userId: "user_1", courseId: A, campaign: "x" }).success
    ).toBe(true);
  });

  it("prefers Clerk's primary email, falling back to the first", () => {
    const data = clerkUserDataSchema.parse({
      id: "user_1",
      primary_email_address_id: "e2",
      email_addresses: [
        { id: "e1", email_address: "first@example.com" },
        { id: "e2", email_address: "primary@example.com" },
      ],
    });
    expect(primaryEmailOf(data)).toBe("primary@example.com");

    const noPrimary = clerkUserDataSchema.parse({
      id: "user_1",
      email_addresses: [{ id: "e1", email_address: "first@example.com" }],
    });
    expect(primaryEmailOf(noPrimary)).toBe("first@example.com");
  });

  it("returns undefined when Clerk sends no addresses", () => {
    // Genuinely possible, and the previous `?.` chain wrote `undefined` to a
    // non-null column.
    expect(primaryEmailOf(clerkUserDataSchema.parse({ id: "user_1" }))).toBeUndefined();
    expect(
      primaryEmailOf(clerkUserDataSchema.parse({ id: "user_1", email_addresses: [] }))
    ).toBeUndefined();
  });

  it("refuses a Clerk payload with no id", () => {
    expect(clerkUserDataSchema.safeParse({ email_addresses: [] }).success).toBe(false);
  });
});

/**
 * Every PATCH schema refuses an empty body.
 *
 * Without it the handler performs a write with no data and reports success, so a
 * client bug looks like a working save.
 */
describe("empty PATCH bodies", () => {
  const scenario = {
    introduction: "<p>i</p>",
    conclusion: "<p>c</p>",
    steps: [
      {
        id: "s1",
        narrative: "<p>n</p>",
        question: "Which?",
        // At least two choices: `caseStudyStepSchema` requires it, because a
        // step with one option is not a decision.
        choices: [
          { id: "c1", text: "a", consequence: "x", ethicalScore: 50, feedback: "f" },
          { id: "c2", text: "b", consequence: "y", ethicalScore: 20, feedback: "g" },
        ],
      },
    ],
  };

  it.each([
    ["courseUpdateSchema", courseUpdateSchema, { title: "t" }],
    ["topicUpdateSchema", topicUpdateSchema, { title: "t" }],
    ["quizUpdateSchema", quizUpdateSchema, { passingScore: 70 }],
    ["questionUpdateSchema", questionUpdateSchema, { text: "t" }],
    ["postUpdateSchema", postUpdateSchema, { title: "t" }],
    ["categoryUpdateSchema", categoryUpdateSchema, { name: "n" }],
    ["journalUpdateSchema", journalUpdateSchema, { title: "t" }],
    ["caseStudyUpdateSchema", caseStudyUpdateSchema, { title: "t" }],
  ])("%s refuses {} and accepts one field", (_label, schema, valid) => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("commentUpdateSchema requires content, so {} is already refused", () => {
    expect(commentUpdateSchema.safeParse({}).success).toBe(false);
    expect(commentUpdateSchema.safeParse({ content: "<p>c</p>" }).success).toBe(true);
  });

  it("create schemas require their fields rather than refusing emptiness", () => {
    expect(topicCreateSchema.safeParse({}).success).toBe(false);
    expect(topicCreateSchema.safeParse({ title: "Consent" }).success).toBe(true);
  });

  it("caseStudyCreateSchema validates the envelope as well as the scenario", () => {
    // `topicId`, `title`, and `description` used to be read straight off the body
    // while only `scenario` was checked.
    expect(
      caseStudyCreateSchema.safeParse({ topicId: A, title: "T", scenario }).success
    ).toBe(true);
    expect(
      caseStudyCreateSchema.safeParse({ topicId: "not-uuid", title: "T", scenario }).success
    ).toBe(false);
    expect(caseStudyCreateSchema.safeParse({ topicId: A, title: "T" }).success).toBe(false);
  });

  it("topicUpdateSchema requires a known contentType and an http videoUrl", () => {
    expect(topicUpdateSchema.safeParse({ contentType: "SLIDES" }).success).toBe(false);
    expect(topicUpdateSchema.safeParse({ contentType: "VIDEO" }).success).toBe(true);
    // Handed to Mux as an asset input.
    expect(topicUpdateSchema.safeParse({ videoUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("quizUpdateSchema bounds the time limit and the passing score", () => {
    expect(quizUpdateSchema.safeParse({ timeLimitMinutes: 0 }).success).toBe(false);
    expect(quizUpdateSchema.safeParse({ timeLimitMinutes: 1441 }).success).toBe(false);
    expect(quizUpdateSchema.safeParse({ passingScore: 101 }).success).toBe(false);
    expect(quizUpdateSchema.safeParse({ passingScore: -1 }).success).toBe(false);
    // Null clears the limit, which means "untimed".
    expect(quizUpdateSchema.safeParse({ timeLimitMinutes: null }).success).toBe(true);
  });
});
