import { CheckCircle2, XCircle } from "lucide-react";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

const VerifyCertificatePage = async ({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) => {
  const { certificateNumber } = await params;

  const certificate = await db.certificate.findUnique({
    where: { certificateNumber: decodeURIComponent(certificateNumber) },
    select: {
      certificateNumber: true,
      issuedAt: true,
      pdfUrl: true,
      user: { select: { firstName: true, lastName: true } },
      course: { select: { title: true } },
    },
  });

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h1 className="text-lg font-bold text-foreground">
              Akomapa Academy
            </h1>
            <p className="text-sm text-muted-foreground">Certificate Verification</p>

            {certificate ? (
              <div className="space-y-4 pt-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-success" />
                </div>
                <h2 className="text-xl font-semibold text-success">
                  Valid Certificate
                </h2>

                <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3 border">
                  <div>
                    <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                      Certificate Number
                    </p>
                    <p className="font-mono text-sm text-foreground">
                      {certificate.certificateNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                      Recipient
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {[certificate.user.firstName, certificate.user.lastName]
                        .filter(Boolean)
                        .join(" ") || "Student"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                      Course
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {certificate.course.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                      Date Issued
                    </p>
                    <p className="text-sm text-foreground">
                      {certificate.issuedAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="flex justify-center">
                  <XCircle className="h-16 w-16 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-red-600">
                  Certificate Not Found
                </h2>
                <p className="text-sm text-muted-foreground">
                  No certificate matching &ldquo;
                  {decodeURIComponent(certificateNumber)}&rdquo; was found.
                  Please check the certificate number and try again.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyCertificatePage;
