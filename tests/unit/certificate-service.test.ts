import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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

const { generateCertificate, issueCertificate } = await import("@/lib/certificate-service");

/** The raw statements (allocation, insert), typed as the plain mock they are. */
const queryRaw = () => dbMock.$queryRaw as unknown as Mock;

/** The sequence allocation answers `lastValue`; the insert answers `inserted`. */
function answerRaw({ lastValue, inserted = true }: { lastValue: number; inserted?: boolean }) {
  queryRaw().mockImplementation(async (strings: TemplateStringsArray) =>
    strings.join("").includes("CertificateNumberSequence")
      ? [{ lastValue }]
      : inserted
        ? [{ id: "cert-new" }]
        : []
  );
}

/** The INSERT INTO "Certificate" call's interpolated values, if it ran. */
function insertedValues(): unknown[] | undefined {
  const call = queryRaw().mock.calls.find((c) => (c[0] as TemplateStringsArray).join("").includes('INSERT INTO "Certificate"'));
  return call?.slice(1);
}

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
  dbMock.certificate.update.mockResolvedValue(aCertificate());
  answerRaw({ lastValue: 1 });
  dbMock.course.findUnique.mockResolvedValue({ title: "Research Ethics", quizzes: [] });
});

describe("eligibility", () => {
  it("refuses to issue without a COMPLETED Enrollment", async () => {
    dbMock.enrollment.findUnique.mockResolvedValue(null);

    await expect(generateCertificate("user_1", "course_1")).resolves.toBeNull();
    expect(renderToBuffer).not.toHaveBeenCalled();
    expect(queryRaw()).not.toHaveBeenCalled();
  });

  it("checks completion for the exact learner and Course pair", async () => {
    dbMock.enrollment.findUnique.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));

    await generateCertificate("user_9", "course_9");

    // Eligibility now goes through `enrollmentStatusFor` in @/lib/entitlement,
    // which reads the composite key and normalizes the status, rather than
    // comparing a raw column here (ADR 0002 point 1).
    expect(dbMock.enrollment.findUnique).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_9", courseId: "course_9" } },
      select: { status: true },
    });
  });

  it("refuses when the Course no longer exists", async () => {
    dbMock.enrollment.findUnique.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
    dbMock.course.findUnique.mockResolvedValue(null);

    await expect(generateCertificate("user_1", "course_1")).resolves.toBeNull();
    expect(insertedValues()).toBeUndefined();
  });

  it("refuses to regenerate a half-written certificate without completion", async () => {
    // A row exists but its PDF never persisted. Recovery must still re-check
    // entitlement rather than trusting the orphaned row as proof of completion.
    dbMock.certificate.findUnique.mockResolvedValue(aCertificate({ pdfUrl: null }));
    dbMock.enrollment.findUnique.mockResolvedValue(null);

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
    expect(dbMock.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it("reuses the original number when repairing a certificate with no PDF", async () => {
    dbMock.certificate.findUnique.mockResolvedValue(
      aCertificate({ certificateNumber: "GHELP-2026-00042", pdfUrl: null })
    );
    dbMock.enrollment.findUnique.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));

    const result = await generateCertificate("user_1", "course_1");

    // Allocating a fresh number here would leave the learner holding two
    // identifiers for one achievement.
    expect(result?.certificateNumber).toBe("GHELP-2026-00042");
    expect(queryRaw()).not.toHaveBeenCalled();
  });
});

describe("certificate numbering (#51)", () => {
  beforeEach(() => {
    dbMock.enrollment.findUnique.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
  });


  it.each([
    [1, "GHELP-2026-00001"],
    [8, "GHELP-2026-00008"],
    [1000, "GHELP-2026-01000"],
    [123456, "GHELP-2026-123456"],
  ])("formats allocated value %i as %s", async (lastValue, number) => {
    answerRaw({ lastValue });

    await expect(generateCertificate("user_1", "course_1")).resolves.toMatchObject({
      certificateNumber: number,
    });
  });

  it("allocates from the current UTC year's sequence", async () => {
    freezeTimeAt("2027-01-01T00:00:00.000Z");

    const result = await generateCertificate("user_1", "course_1");

    expect(result?.certificateNumber).toBe("GHELP-2027-00001");
    // The tagged template's first interpolated value is the year.
    expect(queryRaw().mock.calls[0][1]).toBe(2027);
  });

  it("reserves the row with its number before rendering the PDF, then stores the PDF", async () => {
    await generateCertificate("user_1", "course_1");

    expect(insertedValues()).toEqual([expect.any(String), "user_1", "course_1", "GHELP-2026-00001"]);
    const insertOrder = queryRaw().mock.invocationCallOrder.at(-1)!;
    expect(insertOrder).toBeLessThan(renderToBuffer.mock.invocationCallOrder[0]);
    expect(dbMock.certificate.update).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
      data: { pdfUrl: EXPECTED_PDF_URL },
    });
    expect(renderedProps()).toMatchObject({ certificateNumber: "GHELP-2026-00001" });
  });

  it("adopts the winner's number when a concurrent request issued it first", async () => {
    // A double click: both allocate, one insert wins and the other inserts
    // nothing (ON CONFLICT DO NOTHING). The PDF must carry the stored number.
    answerRaw({ lastValue: 9, inserted: false });
    dbMock.certificate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "c", certificateNumber: "GHELP-2026-00008" });

    const result = await generateCertificate("user_1", "course_1");

    expect(result?.certificateNumber).toBe("GHELP-2026-00008");
    expect(renderedProps()).toMatchObject({ certificateNumber: "GHELP-2026-00008" });
  });

  it("refuses to invent a number when the conflict has no winner", async () => {
    answerRaw({ lastValue: 2, inserted: false });

    await expect(generateCertificate("user_1", "course_1")).rejects.toThrow(
      "certificate conflict without a certificate"
    );
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it("does not swallow a failure", async () => {
    queryRaw().mockRejectedValue(new Error("connection lost"));

    await expect(generateCertificate("user_1", "course_1")).rejects.toThrow("connection lost");
    expect(renderToBuffer).not.toHaveBeenCalled();
  });
});

describe("issueCertificate (#49)", () => {
  it("returns the existing Certificate without allocating a number", async () => {
    const tx = {
      certificate: { findUnique: vi.fn().mockResolvedValue({ id: "c1", certificateNumber: "GHELP-2026-00003" }) },
      $queryRaw: vi.fn(),
    };

    await expect(issueCertificate(tx as never, "u", "c")).resolves.toEqual({
      certificateId: "c1",
      certificateNumber: "GHELP-2026-00003",
      created: false,
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("creates through the client it is given -- the completion's transaction", async () => {
    const tx = {
      certificate: { findUnique: vi.fn().mockResolvedValue(null) },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ lastValue: 4 }])
        .mockResolvedValueOnce([{ id: "ignored" }]),
    };

    const issued = await issueCertificate(tx as never, "u", "c", new Date("2026-05-01T00:00:00Z"));

    expect(issued).toMatchObject({ certificateNumber: "GHELP-2026-00004", created: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw()).not.toHaveBeenCalled();
  });
});

describe("pre-test and post-test scores", () => {
  beforeEach(() => {
    dbMock.enrollment.findUnique.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
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
    dbMock.enrollment.findUnique.mockResolvedValue(anEnrollment({ status: "COMPLETED" }));
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

    expect(insertedValues()).toEqual([expect.any(String), "user_1", "course_1", "GHELP-2026-00001"]);
    expect(dbMock.certificate.update).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
      data: { pdfUrl: EXPECTED_PDF_URL },
    });
  });
});
