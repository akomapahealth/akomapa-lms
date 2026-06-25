import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
  },
  border: {
    border: "3pt solid #0D9488",
    padding: 30,
    height: "100%",
  },
  innerBorder: {
    border: "1pt solid #99F6E4",
    padding: 20,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
  },
  orgName: {
    fontSize: 14,
    color: "#0D9488",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 20,
  },
  divider: {
    width: 80,
    height: 2,
    backgroundColor: "#0D9488",
    marginVertical: 12,
  },
  presentedTo: {
    fontSize: 11,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 6,
  },
  studentName: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
    marginBottom: 12,
  },
  courseLabel: {
    fontSize: 10,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  courseName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0D9488",
    marginBottom: 20,
    textAlign: "center",
  },
  scoresContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    marginBottom: 16,
  },
  scoreBox: {
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 9,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
  },
  growthValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#059669",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    paddingTop: 10,
  },
  footerColumn: {
    alignItems: "center",
    width: "33%",
  },
  signatureLine: {
    width: 120,
    height: 1,
    backgroundColor: "#CBD5E1",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#94A3B8",
  },
  dateText: {
    fontSize: 10,
    color: "#64748B",
    marginBottom: 4,
  },
  certNumber: {
    fontSize: 8,
    color: "#CBD5E1",
    marginTop: 8,
  },
});

interface CertificateTemplateProps {
  studentName: string;
  courseTitle: string;
  preTestScore: number | null;
  postTestScore: number | null;
  certificateNumber: string;
  issuedDate: string;
}

export const CertificateTemplate = ({
  studentName,
  courseTitle,
  preTestScore,
  postTestScore,
  certificateNumber,
  issuedDate,
}: CertificateTemplateProps) => {
  const growth =
    preTestScore !== null && postTestScore !== null
      ? postTestScore - preTestScore
      : null;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.innerBorder}>
            <View style={styles.header}>
              <Text style={styles.orgName}>Akomapa Academy</Text>
              <Text style={styles.subtitle}>
                Ghana Health Ethics &amp; Leadership Programme
              </Text>
            </View>

            <Text style={styles.title}>Certificate of Completion</Text>

            <View style={styles.divider} />

            <Text style={styles.presentedTo}>This is presented to</Text>
            <Text style={styles.studentName}>{studentName}</Text>

            <Text style={styles.courseLabel}>
              For successfully completing the course
            </Text>
            <Text style={styles.courseName}>{courseTitle}</Text>

            {(preTestScore !== null || postTestScore !== null) && (
              <View style={styles.scoresContainer}>
                {preTestScore !== null && (
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreLabel}>Pre-Test</Text>
                    <Text style={styles.scoreValue}>{preTestScore}%</Text>
                  </View>
                )}
                {postTestScore !== null && (
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreLabel}>Post-Test</Text>
                    <Text style={styles.scoreValue}>{postTestScore}%</Text>
                  </View>
                )}
                {growth !== null && (
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreLabel}>Growth</Text>
                    <Text style={styles.growthValue}>
                      +{Math.max(0, growth)}%
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.footer}>
              <View style={styles.footerColumn}>
                <Text style={styles.dateText}>{issuedDate}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Date of Issue</Text>
              </View>
              <View style={styles.footerColumn}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Programme Director</Text>
              </View>
              <View style={styles.footerColumn}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Academic Coordinator</Text>
              </View>
            </View>

            <Text style={styles.certNumber}>{certificateNumber}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
