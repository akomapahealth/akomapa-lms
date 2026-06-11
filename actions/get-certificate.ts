import { db } from "@/lib/db";

export interface CertificateData {
  id: string;
  certificateNumber: string;
  pdfUrl: string | null;
  issuedAt: Date;
  courseTitle: string;
}

export const getCertificate = async (
  userId: string,
  courseId: string
): Promise<CertificateData | null> => {
  try {
    const certificate = await db.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        course: { select: { title: true } },
      },
    });

    if (!certificate) return null;

    return {
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      pdfUrl: certificate.pdfUrl,
      issuedAt: certificate.issuedAt,
      courseTitle: certificate.course.title,
    };
  } catch (error) {
    console.log("[GET_CERTIFICATE]", error);
    return null;
  }
};
