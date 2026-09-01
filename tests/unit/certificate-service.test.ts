import { beforeEach, describe, expect, it, vi } from "vitest";

import { aCertificate, anEnrollment } from "./support/builders";
import { dbMock } from "./support/db";
import { freezeTimeAt } from "./support/time";

vi.mock("@/lib/db", async () => ({
  db: (await import("./support/db")).dbMock,
}));

// The PDF renderer is slow, native, and irrelevant to the rules under test.
// `vi.hoisted` runs before the hoisted `vi.mock` factories, so the spy exists
// by the time the factory below closes over it.
const { renderToBuffer } = vi.hoisted(() => ({
  renderToBuffer: vi.fn(async (_element: { props: Record<string, unknown> }) =>
    Buffer.from("pdf-bytes")
  ),
}));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer }));
vi.mock("@/lib/certificate-template", () => ({ CertificateTemplate: () => null }));

/** The props the certificate template was rendered with, or a clear failure. */
function renderedProps(): Record<string, unknown> {
  const call = renderToBuffer.mock.calls[0];
  if (!call) throw new Error("the certificate was never rendered");
  return call[0].props;
}

const { generateCertificate } = await import("@/lib/certificate-service");

/**
 * A certificate is the product's only externally verifiable claim, so the rule
 * that matters most is the negative one: it must be impossible to obtain
 * without a COMPLETED Enrollment. Issuance must also be idempotent, because a
 * learner who refreshes the page must not mint a second certificate number.
 *
 * Related work: #84 moves storage to object storage and adds atomic issuance,
 * QR verification, and revocation; #120 adds revoked-state verification.
 */
const EXPECTED_PDF_URL = `data:application/pdf;base64,${Buffer.from("pdf-bytes").toString("base64")}`;

beforeEach(() => {
  freezeTimeAt("2026-06-15T09:00:00.000Z");
  dbMock.certificate.upsert.mockResolvedValue(aCertificate());
  dbMock.course.findUnique.mockResolvedValue({ title: "Research Ethics", quizzes: [] });
});

describe("eligibility", () => {
  it("refuses to issue without a COMPLETED Enrollment", async () => {
    dbMock.enrollment.findFirst.mockResolvedValue(null);

    await expect(generateCertificate("user_1", "course_1")).resolves.toBeNull();
    expect(renderToBuffer).not.toHaveBeenCalled();
    expect(dbMock.certificate.upsert).not.toHaveBeenCalled();
  });

  it("checks completion for the exact learner and Course pair", async () => {
    dbMock.enrollment.findFirst.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));

    await generateCertificate("user_9", "course_9");

    expect(dbMock.enrollment.findFirst).toHaveBeenCalledWith({
      where: { userId: "user_9", courseId: "course_9", status: "COMPLETED" },
    });
  });

  it("refuses when the Course no longer exists", async () => {
    dbMock.enrollment.findFirst.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
    dbMock.course.findUnique.mockResolvedValue(null);

    await expect(generateCertificate("user_1", "course_1")).resolves.toBeNull();
    expect(dbMock.certificate.upsert).not.toHaveBeenCalled();
  });

  it("refuses to regenerate a half-written certificate without completion", async () => {
    // A row exists but its PDF never persisted. Recovery must still re-check
    // entitlement rather than trusting the orphaned row as proof of completion.
    dbMock.certificate.findUnique.mockResolvedValue(aCertificate({ pdfUrl: null }));
    dbMock.enrollment.findFirst.mockResolvedValue(null);

    await expect(generateCertificate("user_1", "course_1")).resolves.toBeNull();
  });
});

describe("idempotency", () => {
  it("returns the existing certificate without re-rendering", async () => {
    dbMock.certificate.findUnique.mockResolvedValue(
      aCertificate({ certificateNumber: "GHELP-2026-00042", pdfUrl: "data:application/pdf;base64,AAAA" })
    );

    await expect(generateCertificate("user_1", "course_1")).resolves.toEqual({
      certificateNumber: "GHELP-2026-00042",
      pdfUrl: "data:application/pdf;base64,AAAA",
    });
    expect(renderToBuffer).not.toHaveBeenCalled();
    expect(dbMock.enrollment.findFirst).not.toHaveBeenCalled();
  });

  it("reuses the original number when repairing a certificate with no PDF", async () => {
    dbMock.certificate.findUnique.mockResolvedValue(
      aCertificate({ certificateNumber: "GHELP-2026-00042", pdfUrl: null })
    );
    dbMock.enrollment.findFirst.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));

    const result = await generateCertificate("user_1", "course_1");

    // Allocating a fresh number here would leave the learner holding two
    // identifiers for one achievement.
    expect(result?.certificateNumber).toBe("GHELP-2026-00042");
    expect(dbMock.certificate.findFirst).not.toHaveBeenCalled();
  });
});

describe("certificate numbering", () => {
  beforeEach(() => {
    dbMock.enrollment.findFirst.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
  });

  it("starts at one for the first certificate of the year", async () => {
    dbMock.certificate.findFirst.mockResolvedValue(null);

    const result = await generateCertificate("user_1", "course_1");

    expect(result?.certificateNumber).toBe("GHELP-2026-00001");
    expect(dbMock.certificate.findFirst).toHaveBeenCalledWith({
      where: { certificateNumber: { startsWith: "GHELP-2026-" } },
      orderBy: { certificateNumber: "desc" },
      select: { certificateNumber: true },
    });
  });

  it("continues from the highest number already issued", async () => {
    dbMock.certificate.findFirst.mockResolvedValue({ certificateNumber: "GHELP-2026-00007" });

    const result = await generateCertificate("user_1", "course_1");

    expect(result?.certificateNumber).toBe("GHELP-2026-00008");
  });

  it("keeps five-digit padding as numbers grow", async () => {
    dbMock.certificate.findFirst.mockResolvedValue({ certificateNumber: "GHELP-2026-00999" });

    await expect(generateCertificate("user_1", "course_1")).resolves.toMatchObject({
      certificateNumber: "GHELP-2026-01000",
    });
  });

  it("scopes the sequence to the current year", async () => {
    freezeTimeAt("2027-01-01T00:00:00.000Z");
    dbMock.certificate.findFirst.mockResolvedValue(null);

    await expect(generateCertificate("user_1", "course_1")).resolves.toMatchObject({
      certificateNumber: "GHELP-2027-00001",
    });
  });

  it("restarts at one rather than emitting NaN when the latest number is malformed", async () => {
    dbMock.certificate.findFirst.mockResolvedValue({ certificateNumber: "GHELP-2026-legacy" });

    await expect(generateCertificate("user_1", "course_1")).resolves.toMatchObject({
      certificateNumber: "GHELP-2026-00001",
    });
  });
});

describe("pre-test and post-test scores", () => {
  beforeEach(() => {
    dbMock.enrollment.findFirst.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
    dbMock.certificate.findFirst.mockResolvedValue(null);
  });

  async function propsAfterIssuing(): Promise<Record<string, unknown>> {
    await generateCertificate("user_1", "course_1");
    return renderedProps();
  }

  it("converts raw points to a rounded percentage", async () => {
    dbMock.course.findUnique.mockResolvedValue({
      title: "Research Ethics",
      quizzes: [
        { type: "PRE_TEST", attempts: [{ score: 5, totalPoints: 20 }] },
        { type: "POST_TEST", attempts: [{ score: 17, totalPoints: 20 }] },
      ],
    });

    expect(await propsAfterIssuing()).toMatchObject({ preTestScore: 25, postTestScore: 85 });
  });

  it("rounds halves upward consistently", async () => {
    dbMock.course.findUnique.mockResolvedValue({
      title: "Research Ethics",
      quizzes: [{ type: "PRE_TEST", attempts: [{ score: 1, totalPoints: 8 }] }],
    });

    // 12.5 rounds to 13, not 12.
    expect(await propsAfterIssuing()).toMatchObject({ preTestScore: 13 });
  });

  it("reports no score when the learner never attempted the quiz", async () => {
    dbMock.course.findUnique.mockResolvedValue({
      title: "Research Ethics",
      quizzes: [
        { type: "PRE_TEST", attempts: [] },
        { type: "POST_TEST", attempts: [] },
      ],
    });

    expect(await propsAfterIssuing()).toMatchObject({ preTestScore: null, postTestScore: null });
  });

  it("reports no score rather than dividing by a zero or null total", async () => {
    dbMock.course.findUnique.mockResolvedValue({
      title: "Research Ethics",
      quizzes: [
        { type: "PRE_TEST", attempts: [{ score: 10, totalPoints: 0 }] },
        { type: "POST_TEST", attempts: [{ score: 10, totalPoints: null }] },
      ],
    });

    expect(await propsAfterIssuing()).toMatchObject({ preTestScore: null, postTestScore: null });
  });

  it("treats an ungraded attempt as zero rather than failing", async () => {
    dbMock.course.findUnique.mockResolvedValue({
      title: "Research Ethics",
      quizzes: [{ type: "PRE_TEST", attempts: [{ score: null, totalPoints: 20 }] }],
    });

    expect(await propsAfterIssuing()).toMatchObject({ preTestScore: 0 });
  });
});

describe("the rendered certificate", () => {
  beforeEach(() => {
    dbMock.enrollment.findFirst.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
    dbMock.certificate.findFirst.mockResolvedValue(null);
  });

  it("names the learner and formats the issue date unambiguously", async () => {
    dbMock.user.findUnique.mockResolvedValue({ firstName: "Ama", lastName: "Mensah" });

    await generateCertificate("user_1", "course_1");

    expect(renderedProps()).toMatchObject({
      studentName: "Ama Mensah",
      courseTitle: "Research Ethics",
      issuedDate: "15 June 2026",
    });
  });

  it("falls back to a placeholder rather than printing 'undefined' as a name", async () => {
    for (const user of [null, {}, { firstName: null, lastName: null }]) {
      renderToBuffer.mockClear();
      dbMock.user.findUnique.mockResolvedValue(user);

      await generateCertificate("user_1", "course_1");

      expect(renderedProps().studentName).toBe("Student");
    }
  });

  it("uses whichever name part exists", async () => {
    dbMock.user.findUnique.mockResolvedValue({ firstName: "Ama", lastName: null });

    await generateCertificate("user_1", "course_1");

    expect(renderedProps().studentName).toBe("Ama");
  });

  it("persists the certificate against the learner and Course pair", async () => {
    await expect(generateCertificate("user_1", "course_1")).resolves.toEqual({
      certificateNumber: "GHELP-2026-00001",
      pdfUrl: EXPECTED_PDF_URL,
    });

    expect(dbMock.certificate.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
      create: {
        userId: "user_1",
        courseId: "course_1",
        certificateNumber: "GHELP-2026-00001",
        pdfUrl: EXPECTED_PDF_URL,
      },
      update: { pdfUrl: EXPECTED_PDF_URL },
    });
  });
});
