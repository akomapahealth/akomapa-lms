import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import { aCourseWithTopic, anEnrollmentRow, aUserRow } from "./support/fixtures";
import { atMigration, type UpgradeDatabase } from "./support/upgrade";

vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

// The renderer is slow and irrelevant here; each PDF records the number it was
// rendered with, which is what must match the stored row.
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn(async (element: { props: { certificateNumber: string } }) =>
    Buffer.from(`pdf:${element.props.certificateNumber}`)
  ),
}));
vi.mock("@/lib/certificate-template", () => ({ CertificateTemplate: () => null }));

const { allocateCertificateNumber, generateCertificate } = await import("@/lib/certificate-service");

/**
 * Certificate numbers under concurrency, against real PostgreSQL (#51).
 */

function numberInPdf(pdfUrl: string): string {
  return Buffer.from(pdfUrl.split(",")[1], "base64").toString().replace("pdf:", "");
}

describe("allocateCertificateNumber", () => {
  it("never hands out the same number twice, however many ask at once", async () => {
    const numbers = await Promise.all(
      Array.from({ length: 25 }, () => allocateCertificateNumber(new Date("2026-06-01T00:00:00Z")))
    );

    expect(new Set(numbers).size).toBe(25);
    expect([...numbers].sort()).toEqual(
      Array.from({ length: 25 }, (_, i) => `GHELP-2026-${String(i + 1).padStart(5, "0")}`)
    );
  });

  it("keeps one sequence per year", async () => {
    await allocateCertificateNumber(new Date("2026-12-31T23:59:59Z"));

    expect(await allocateCertificateNumber(new Date("2027-01-01T00:00:00Z"))).toBe("GHELP-2027-00001");
    expect(await allocateCertificateNumber(new Date("2026-06-01T00:00:00Z"))).toBe("GHELP-2026-00002");
  });
});

describe("generateCertificate under concurrency", () => {
  let courseId: string;

  beforeEach(async () => {
    const author = await aUserRow({ role: "FACULTY" });
    courseId = (await aCourseWithTopic(author.id)).course.id;
  });

  it("gives learners finishing at the same moment distinct numbers", async () => {
    const learners = await Promise.all(Array.from({ length: 6 }, () => aUserRow()));
    for (const learner of learners) await anEnrollmentRow(learner.id, courseId, "COMPLETED");

    const issued = await Promise.all(learners.map((l) => generateCertificate(l.id, courseId)));

    const numbers = issued.map((c) => c!.certificateNumber);
    expect(new Set(numbers).size).toBe(6);
    expect(await testDb().certificate.count({ where: { courseId } })).toBe(6);
  });

  it("issues one Certificate for a double click, and its PDF shows the stored number", async () => {
    const learner = await aUserRow();
    await anEnrollmentRow(learner.id, courseId, "COMPLETED");

    const results = await Promise.all(
      Array.from({ length: 4 }, () => generateCertificate(learner.id, courseId))
    );

    const stored = await testDb().certificate.findMany({ where: { userId: learner.id } });
    expect(stored).toHaveLength(1);
    for (const result of results) {
      expect(result!.certificateNumber).toBe(stored[0].certificateNumber);
      expect(numberInPdf(result!.pdfUrl)).toBe(stored[0].certificateNumber);
    }
    expect(numberInPdf(stored[0].pdfUrl!)).toBe(stored[0].certificateNumber);
  });

  it("returns the existing Certificate on a later visit without allocating", async () => {
    const learner = await aUserRow();
    await anEnrollmentRow(learner.id, courseId, "COMPLETED");
    const first = await generateCertificate(learner.id, courseId);

    const again = await generateCertificate(learner.id, courseId);

    expect(again).toEqual(first);
    const { lastValue } = await testDb().certificateNumberSequence.findFirstOrThrow();
    expect(lastValue).toBe(1);
  });

  it("issues nothing, and allocates nothing, without a COMPLETED enrollment", async () => {
    const learner = await aUserRow();
    await anEnrollmentRow(learner.id, courseId, "ACTIVE");

    await expect(generateCertificate(learner.id, courseId)).resolves.toBeNull();
    expect(await testDb().certificateNumberSequence.count()).toBe(0);
  });
});

describe("the migration continues each year's existing sequence", () => {
  const TARGET = "20261003060000_certificate_number_sequence";
  let upgrade: UpgradeDatabase;

  beforeEach(async () => {
    upgrade = await atMigration(TARGET, "certnumbers");
    await upgrade.client.query(`
      INSERT INTO "User" (id, "updatedAt") VALUES ('u1', now()), ('u2', now()), ('u3', now()), ('u4', now());
      INSERT INTO "Course" (id, "userId", title, "updatedAt") VALUES ('c1', 'u1', 'C', now());
      INSERT INTO "Certificate" (id, "userId", "courseId", "certificateNumber") VALUES
        ('a', 'u1', 'c1', 'GHELP-2026-00007'),
        ('b', 'u2', 'c1', 'GHELP-2026-00003'),
        ('c', 'u3', 'c1', 'GHELP-2025-00012'),
        ('d', 'u4', 'c1', 'LEGACY-IMPORT-1');
    `);
  }, 60_000);

  afterEach(async () => {
    await upgrade.drop();
  });

  it("starts each year at its highest issued number and ignores other formats", async () => {
    await upgrade.applyMigration(TARGET);

    const { rows } = await upgrade.client.query(
      `SELECT year, "lastValue" FROM "CertificateNumberSequence" ORDER BY year`
    );
    expect(rows).toEqual([
      { year: 2025, lastValue: 12 },
      { year: 2026, lastValue: 7 },
    ]);
  });
});
