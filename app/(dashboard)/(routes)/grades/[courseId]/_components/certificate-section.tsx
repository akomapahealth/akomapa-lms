"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Award, Download, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CertificateSectionProps {
  courseId: string;
  isCompleted: boolean;
  existingCertificate: {
    certificateNumber: string;
    pdfUrl: string | null;
    issuedAt: Date;
  } | null;
}

export const CertificateSection = ({
  courseId,
  isCompleted,
  existingCertificate,
}: CertificateSectionProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificate, setCertificate] = useState(existingCertificate);

  if (!isCompleted && !certificate) return null;

  const onGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await axios.post(
        `/api/courses/${courseId}/certificate`
      );
      setCertificate(response.data);
      toast.success("Certificate generated!");
    } catch {
      toast.error("Failed to generate certificate");
    } finally {
      setIsGenerating(false);
    }
  };

  const onDownload = () => {
    if (!certificate?.pdfUrl) return;

    const link = document.createElement("a");
    link.href = certificate.pdfUrl;
    link.download = `certificate-${certificate.certificateNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="h-5 w-5 text-emerald-600" />
          Certificate
        </CardTitle>
      </CardHeader>
      <CardContent>
        {certificate ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Certificate #{certificate.certificateNumber}
                </p>
                <p className="text-xs text-slate-500">
                  Issued{" "}
                  {new Date(certificate.issuedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                {certificate.pdfUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDownload}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a
                    href={`/verify/${certificate.certificateNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Verify
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              You&apos;ve completed this course! Generate your certificate of
              completion.
            </p>
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Award className="h-4 w-4 mr-2" />
                  Generate Certificate
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
