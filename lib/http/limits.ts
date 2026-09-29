/**
 * Explicit bounds for every untrusted size (#44).
 *
 * The point of naming them here rather than inlining numbers is that "what is
 * the largest thing a learner may post" becomes one reviewable decision instead
 * of forty accidental ones. Anything unbounded is a denial-of-service and a
 * storage-cost surface: before this, `POST /api/courses` accepted a title of any
 * length and `PUT .../chapters/reorder` accepted a list of any size, each row
 * costing a separate UPDATE.
 */

/** Maximum bytes of request body, by route shape. */
export const BODY_BYTES = {
  /**
   * Routes whose body is a handful of scalars: a title, a boolean, an id.
   * Generous enough that no legitimate form hits it.
   */
  default: 16 * 1024,
  /**
   * Reorder payloads: `COUNT.reorder` entries of `{ id: uuid, position: int }`,
   * which is about 56 bytes each.
   *
   * Sized from the count limit on purpose. With the 16KB default, a list of 500
   * was rejected as too large before the schema could report it as too long --
   * which made `COUNT.reorder` unreachable, and told the caller the wrong thing
   * about why their request failed.
   */
  reorder: 64 * 1024,
  /**
   * Routes carrying author- or learner-written rich text: posts, comments,
   * journal entries, Topic text content.
   */
  richText: 512 * 1024,
  /**
   * Case study scenarios and quiz question sets, which are structured documents
   * with many nested rich-text fields.
   */
  document: 1024 * 1024,
} as const;

/** Maximum characters per field. Enforced by schema, not by the database. */
export const TEXT = {
  /** Titles, names, category labels. */
  title: 200,
  /** Hex colours, slugs, certificate numbers. */
  token: 64,
  /** Course and Topic descriptions, quiz question text, choice text. */
  short: 2_000,
  /** Community posts, comments, journal entries, Topic text content. */
  rich: 100_000,
  /** Any URL we store and later fetch or render. */
  url: 2_048,
} as const;

/** Maximum items in any array a client may send. */
export const COUNT = {
  /** Reorder payloads: positions for a Module's Topics or a Quiz's Questions. */
  reorder: 500,
  /** Answers in one quiz submission. */
  answers: 500,
  /** Options on a single question. */
  options: 26,
  /** Steps in a case study scenario, and choices per step. */
  scenarioSteps: 100,
} as const;

/** Bounds on numeric fields that reach arithmetic or money paths. */
export const NUMBER = {
  /** Course price in whole currency units. #55 replaces this with exact money. */
  maxPrice: 100_000,
  /** Points per question. */
  maxPoints: 1_000,
  /** Position in an ordered list. */
  maxPosition: 100_000,
  /** Quiz time limit in minutes. */
  maxTimeLimitMinutes: 24 * 60,
} as const;
