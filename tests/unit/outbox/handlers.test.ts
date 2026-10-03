import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));
const generateCertificate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/certificate-service", () => ({ generateCertificate }));

const { dispatchEvent, EVENT_HANDLERS, handleCertificateIssued } = await import("@/lib/outbox/handlers");
const { DomainEventType } = await import("@/lib/outbox/events");

const payload = { userId: "u1", courseId: "c1", certificateId: "cert1" };

beforeEach(() => {
  generateCertificate.mockReset();
  generateCertificate.mockResolvedValue({ certificateNumber: "GHELP-2026-00001", pdfUrl: "data:" });
});

describe("EVENT_HANDLERS", () => {
  it("decides every event type, with a consumer or an explicit null", () => {
    expect(Object.keys(EVENT_HANDLERS).sort()).toEqual(Object.values(DomainEventType).sort());
  });
});

describe("handleCertificateIssued", () => {
  it("renders the PDF for a reserved Certificate, from the stored row", async () => {
    dbMock.certificate.findUnique.mockResolvedValue({ userId: "u1", courseId: "c1", pdfUrl: null });

    await handleCertificateIssued(payload);

    expect(generateCertificate).toHaveBeenCalledWith("u1", "c1");
  });

  it("does nothing on a second delivery, once the PDF is stored", async () => {
    dbMock.certificate.findUnique.mockResolvedValue({ userId: "u1", courseId: "c1", pdfUrl: "data:x" });

    await handleCertificateIssued(payload);

    expect(generateCertificate).not.toHaveBeenCalled();
  });

  it("skips a Certificate that no longer exists rather than failing forever", async () => {
    await expect(handleCertificateIssued(payload)).resolves.toBeUndefined();
    expect(generateCertificate).not.toHaveBeenCalled();
  });
});

describe("dispatchEvent", () => {
  it("delivers to the consumer", async () => {
    dbMock.certificate.findUnique.mockResolvedValue({ userId: "u1", courseId: "c1", pdfUrl: null });

    await dispatchEvent("CERTIFICATE_ISSUED", payload);

    expect(generateCertificate).toHaveBeenCalled();
  });

  it("treats an event with no consumer as delivered", async () => {
    await expect(dispatchEvent("COURSE_COMPLETED", { userId: "u", courseId: "c" })).resolves.toBeUndefined();
  });

  it("refuses a stored payload that no longer matches its schema", async () => {
    await expect(dispatchEvent("CERTIFICATE_ISSUED", { certificateId: "x" })).rejects.toThrow();
    expect(generateCertificate).not.toHaveBeenCalled();
  });
});
