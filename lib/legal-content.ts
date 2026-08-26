import { siteConfig } from "@/lib/site-config";

export type LegalBlock = {
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalSection = LegalBlock & {
  id: string;
  title: string;
  subsections?: Array<LegalBlock & { title: string }>;
};

export type LegalPage = {
  slug: "privacy" | "terms";
  title: string;
  description: string;
  notice: { title: string; body: string };
  sections: LegalSection[];
};

const ghana = siteConfig.offices.ghana;
const usa = siteConfig.offices.usa;

export const privacyPage: LegalPage = {
  slug: "privacy",
  title: "Privacy Policy",
  description:
    "How Akomapa Academy collects, uses, shares, and protects personal information for the Global Health Education and Leadership Program.",
  notice: {
    title: "This is an education platform, not a clinic",
    body: "Akomapa Academy is the digital home of GHELP, an educational program of Akomapa Health Foundation. It is not a healthcare provider, electronic health record, or medical advice service. Do not submit patient records or other protected health information here. Clinical care and patient data are handled separately by Akomapa community hubs and related care systems, not by this learning platform.",
  },
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      paragraphs: [
        `Akomapa Academy ("the Academy," "we," "us") is operated by ${siteConfig.organization}, a United States 501(c)(3) nonprofit. The Academy delivers the Akomapa Global Health Education and Leadership Program (GHELP): courses, quizzes, community discussion, reflection journals, and verifiable certificates.`,
        "This policy covers this Academy website and any successor Academy domain. It does not cover akomapa.org, Community Learning and Care Hubs, or the Nkwapa digital health platform used for patient care.",
        `You can reach us through our contact form at ${siteConfig.contactUrl}, or at the offices below.`,
        `${ghana.label}: ${ghana.address}. Telephone ${ghana.phone}.`,
        `${usa.label}: ${usa.address}. Telephone ${usa.phone}.`,
      ],
    },
    {
      id: "scope",
      title: "What this policy covers",
      paragraphs: [
        "This policy describes personal information we collect when you visit the public site, create an account, sign in (including with Google), take courses, join the community, keep a journal, purchase a paid course, or verify a certificate.",
        "It applies to students, faculty, and administrators. If you are a faculty or admin user, we also process the additional profile fields you provide (such as title, bio, and specialization) so learners can identify their mentors.",
      ],
    },
    {
      id: "information-we-collect",
      title: "Information we collect",
      subsections: [
        {
          title: "Account and identity",
          paragraphs: [
            "When you register or sign in, Clerk (our authentication provider) collects your name, email address, and optional profile photo. If you choose Continue with Google, Google shares the same basic profile data (name, email, and profile photo) with Clerk so we can create or recognize your Academy account. We store a copy of your Clerk user id, email, name, and photo in our database to operate the platform.",
          ],
        },
        {
          title: "Learning records",
          paragraphs: [
            "We record course enrollments, chapter progress, quiz attempts and answers, grades, case-study attempts, badges, learning streaks, and certificates. These records exist so we can measure growth, issue credentials, and let faculty support students.",
          ],
        },
        {
          title: "Journals and community content",
          paragraphs: [
            "Reflection journals are private by default. You can change that default in Settings. Community posts, comments, and likes are visible to other signed-in Academy users. Do not include identifiable patient information, clinical records, or anyone else's sensitive health data in journals or community posts.",
          ],
        },
        {
          title: "Payments",
          paragraphs: [
            "If you enroll in a paid course, Stripe processes the payment. We receive confirmation of the purchase, the course purchased, and a Stripe customer identifier. We do not store full card numbers on our servers.",
          ],
        },
        {
          title: "Files and course media",
          paragraphs: [
            "Course videos are hosted by Mux. Uploaded course files and attachments are stored with UploadThing. Faculty and admins who upload materials are responsible for not including personal data that does not belong in instructional content.",
          ],
        },
        {
          title: "Settings and device data",
          paragraphs: [
            "We store your theme preference, journal privacy default, community profile visibility, and email-notification choices. Our hosting provider (Vercel) automatically receives standard request logs such as IP address, browser type, and pages requested, used to operate, secure, and debug the service.",
          ],
        },
      ],
    },
    {
      id: "google-sign-in",
      title: "Google sign-in",
      paragraphs: [
        "Google sign-in is optional. If you use it, we request only the information needed to authenticate you: your Google account name, email address, and profile photo. We use that information solely to create and maintain your Academy account and to display your name and photo inside the platform.",
        "We do not use Google user data for advertising, do not sell it, and do not share it with third parties except the processors listed in this policy who help us run the Academy. You can disconnect Google access from your Google account settings at any time. Doing so may prevent Google sign-in until you reconnect or use another sign-in method.",
      ],
    },
    {
      id: "how-we-use",
      title: "How we use information",
      bullets: [
        "Create and secure your account, including session cookies from Clerk.",
        "Deliver courses, track progress, score quizzes, and issue certificates.",
        "Operate the community, journals, badges, and streaks.",
        "Process course payments and keep enrollment records.",
        "Send transactional messages you opt into, such as badge, forum-reply, or faculty-comment notices. Clerk also sends authentication messages (for example, sign-in and account verification).",
        "Administer the program, including faculty supervision and nonprofit reporting in aggregated or de-identified form where possible.",
        "Protect the platform against abuse, fraud, and security incidents.",
        "Comply with law and respond to lawful requests.",
      ],
    },
    {
      id: "sharing",
      title: "When we share information",
      paragraphs: [
        "We do not sell personal information. We share it only as needed to run the Academy:",
      ],
      bullets: [
        "Service processors: Clerk (authentication, including Google sign-in), Stripe (payments), Mux (video), UploadThing (file storage), Vercel (hosting and logs), and our PostgreSQL database host.",
        "Faculty and administrators: authorized mentors and staff can see student names, progress, quiz results, and community activity needed to teach and moderate. Private journal entries remain private unless you make them visible.",
        "Public certificate verification: anyone with a certificate number can confirm that the certificate is authentic. A verification page may show the learner name, course, and issue date associated with that number.",
        "Legal and safety: if required by law, to protect rights and safety, or in connection with a reorganization of the Foundation, subject to this policy.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and similar technologies",
      paragraphs: [
        "We use strictly necessary cookies and similar storage to keep you signed in (Clerk session), remember your theme, and operate security features. These are required for the Academy to function. We do not currently use third-party advertising or cross-site marketing cookies.",
        "You can block cookies in your browser, but you will not be able to stay signed in if essential session cookies are disabled.",
      ],
    },
    {
      id: "retention",
      title: "How long we keep information",
      paragraphs: [
        "We keep account and learning records for as long as your account is active and for a reasonable period afterward so we can verify certificates, support the program, and meet nonprofit record-keeping needs.",
        "You may ask us to delete your account. We will delete or de-identify personal data we control, except records we must retain (for example, payment records required for accounting, or a certificate verification record if a credential has already been issued). Public verification of an issued certificate may continue to show the name that appeared on the credential.",
      ],
    },
    {
      id: "security",
      title: "Security",
      paragraphs: [
        "We use industry-standard safeguards appropriate to an educational platform: encrypted connections (HTTPS), managed authentication, access limited by role (student, faculty, admin), and hosted infrastructure with access controls. No online service is perfectly secure. Please use a strong unique password and do not share your account.",
      ],
    },
    {
      id: "international",
      title: "International transfers",
      paragraphs: [
        "The Foundation is based in the United States and operates programs in Ghana and other countries. Personal information may be processed in the United States and in other countries where our processors operate. Those countries may have different data-protection laws than your own.",
        "If you are in Ghana, you may have rights under the Data Protection Act, 2012 (Act 843). If you are in the European Economic Area, the United Kingdom, or another region with similar laws, you may have rights to access, correct, delete, restrict, or export your data, and to object to certain processing. Contact us to exercise those rights. You may also lodge a complaint with your local data-protection authority.",
      ],
    },
    {
      id: "children",
      title: "Children",
      paragraphs: [
        "The Academy is designed for health-professional students and adult learners. You must be at least 16 years old to create an account. We do not knowingly collect personal information from children under 16. If you believe a child has created an account, contact us and we will delete it.",
      ],
    },
    {
      id: "your-choices",
      title: "Your choices and rights",
      bullets: [
        "Update your name, photo, and sign-in methods in your Clerk account settings.",
        "Control theme, journal privacy, community profile visibility, and email notices in Settings.",
        "Edit or delete your own journal entries, posts, and comments, subject to moderation logs we may keep for safety.",
        "Request access to, correction of, or deletion of personal data we hold by contacting us. We will need to verify your identity.",
        "If you signed in with Google, manage Google's sharing of your account data in your Google account.",
      ],
    },
    {
      id: "health-data",
      title: "Health and education data",
      paragraphs: [
        "Course content discusses health topics. Your quiz scores, reflections, and community posts are educational records about your learning, not medical records about a patient, and not a diagnosis or treatment of you.",
        "Akomapa Academy is not a HIPAA covered entity or business associate for this learning platform. Do not upload protected health information, clinic charts, or identifiable patient stories. If you do so in error, tell us immediately so we can remove it.",
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      paragraphs: [
        `We will update this page when our practices change. The effective date at the top of this page is ${siteConfig.legalEffectiveDate}. Continued use of the Academy after an update means you accept the revised policy. If a change is material, we will provide additional notice (for example, an in-product message or email) where required.`,
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        `Privacy questions: use ${siteConfig.contactUrl} and mention "Akomapa Academy privacy."`,
        `${ghana.label}: ${ghana.address}. ${ghana.phone}.`,
        `${usa.label}: ${usa.address}. ${usa.phone}.`,
      ],
    },
  ],
};

export const termsPage: LegalPage = {
  slug: "terms",
  title: "Terms of Service",
  description:
    "The rules for using Akomapa Academy, the Global Health Education and Leadership Program of Akomapa Health Foundation.",
  notice: {
    title: "Educational use only. Not medical advice.",
    body: "Content on Akomapa Academy is for learning, professional development, and ethical leadership training. It is not medical advice, diagnosis, or treatment, and it does not create a clinician-patient relationship. Always seek qualified local clinical guidance for patient care. Certificates recognize completion of GHELP coursework. They are not a professional license, degree, or authorization to practice medicine or any other health profession.",
  },
  sections: [
    {
      id: "agreement",
      title: "Agreement",
      paragraphs: [
        `These Terms of Service ("Terms") are a contract between you and ${siteConfig.organization} for your use of Akomapa Academy and GHELP. By creating an account or using the site, you agree to these Terms and to our Privacy Policy.`,
        'If you use the Academy on behalf of a university, hospital, or other organization, you confirm that you have authority to bind that organization. In that case, "you" includes that organization.',
      ],
    },
    {
      id: "eligibility",
      title: "Who may use the Academy",
      paragraphs: [
        "You must be at least 16 years old. If you are under 18, you confirm that a parent or guardian consents to these Terms.",
        "You must provide accurate account information and keep your sign-in details confidential. You are responsible for activity on your account.",
        "We may suspend or close accounts that are inaccurate, unsafe, or used in violation of these Terms.",
      ],
    },
    {
      id: "the-service",
      title: "The service",
      paragraphs: [
        "The Academy provides online courses, video lessons, quizzes (including pre- and post-tests), a learning path, a community forum, a reflection journal, badges, streaks, and completion certificates that can be verified at /verify.",
        "We may change, pause, or discontinue features. Course materials may be updated as the curriculum evolves. We will try not to withdraw a credential already issued solely because a later version of a course changed.",
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      paragraphs: [
        "Use the Academy only for lawful educational purposes. You agree that you will not:",
      ],
      bullets: [
        "Share patient names, chart numbers, photos, or other information that could identify a real patient.",
        "Treat course scenarios as instructions for unsupervised clinical care.",
        "Harass, threaten, discriminate against, or dox other users.",
        "Post spam, malware, or content you do not have the right to share.",
        "Attempt to access other users' private journals, admin tools, or systems you are not authorized to use.",
        "Copy, scrape, resell, or publicly redistribute course videos, quizzes, or materials except as we expressly allow.",
        "Misrepresent a certificate, your role, or your qualifications.",
        "Interfere with the integrity or performance of the platform.",
      ],
    },
    {
      id: "user-content",
      title: "Your content",
      paragraphs: [
        "You keep ownership of journal entries, community posts, and comments you create. You grant us a non-exclusive license to host, display, and moderate that content as needed to operate the Academy (for example, showing a post to other signed-in learners, or displaying your name on a certificate you earn).",
        "You confirm that your content does not infringe others' rights and does not include confidential patient information. We may remove content that violates these Terms or that we reasonably believe is unsafe or unlawful.",
      ],
    },
    {
      id: "our-content",
      title: "Our content and trademarks",
      paragraphs: [
        "The Academy software, curriculum, videos, quizzes, design, and Akomapa name and marks belong to the Foundation or its licensors. This repository and platform are proprietary. No license is granted to copy, distribute, or reuse the platform or course materials beyond personal educational use inside the Academy.",
        '"Akomapa," "Nya Akomapa," "GHELP," and related marks are used with permission of the Foundation. You may not use them to imply endorsement of a product, clinic, or credential we did not issue.',
      ],
    },
    {
      id: "certificates",
      title: "Certificates",
      paragraphs: [
        "When you meet the published completion requirements for a course, we may issue a certificate with a unique number. Anyone can check that number on the public verification page.",
        "Certificates confirm participation and assessed learning in GHELP. They do not confer a degree, board certification, immigration status, employment, or a right to practice. Employers and regulators make their own decisions.",
      ],
    },
    {
      id: "payments",
      title: "Paid courses",
      paragraphs: [
        "Some courses may be free; others may require payment through Stripe. Prices are shown before you enroll. Payments are processed by Stripe under Stripe's terms.",
        "Unless a specific course page says otherwise, paid enrollments are non-refundable once course content has been accessed. If you believe a charge was made in error, contact us through the form listed below within 14 days and we will review it in good faith.",
      ],
    },
    {
      id: "third-parties",
      title: "Third-party services",
      paragraphs: [
        "Sign-in (including Google), video, uploads, hosting, and payments are provided by third parties named in the Privacy Policy. Their terms also apply when you use those features. We are not responsible for third-party sites linked from course materials, including akomapa.org, except as those sites state their own terms.",
      ],
    },
    {
      id: "disclaimer",
      title: "Disclaimers",
      paragraphs: [
        'The Academy is provided "as is" and "as available." To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, uninterrupted access, and error-free content.',
        "Health information in the curriculum may become outdated. Supervised community practice, where it occurs, is governed by local clinical policies and is outside these Terms except for your conduct on this website.",
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, the Foundation and its officers, employees, volunteers, and partners are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the Academy.",
        "Our total liability for any claim relating to the Academy is limited to the greater of (a) the amount you paid us for Academy access in the 12 months before the claim, or (b) fifty U.S. dollars (USD $50). Some jurisdictions do not allow certain limitations; in those places, our liability is limited to the maximum extent allowed.",
      ],
    },
    {
      id: "indemnity",
      title: "Indemnity",
      paragraphs: [
        "You will defend and indemnify the Foundation against claims arising from your content, your misuse of the Academy, your misuse of a certificate, or your violation of these Terms or of another person's rights, except to the extent a claim is caused by our willful misconduct.",
      ],
    },
    {
      id: "termination",
      title: "Suspension and termination",
      paragraphs: [
        "You may stop using the Academy at any time and may request account deletion as described in the Privacy Policy.",
        "We may suspend or terminate access if you violate these Terms, if required by law, or if we discontinue the service. Provisions that should survive (including intellectual property, certificates already issued, disclaimers, liability limits, and indemnity) will survive.",
      ],
    },
    {
      id: "governing-law",
      title: "Governing law",
      paragraphs: [
        "These Terms are governed by the laws of the State of Connecticut, United States, without regard to conflict-of-law rules, except that mandatory consumer protections in your country of residence still apply where they cannot be waived.",
        "Courts located in New Haven County, Connecticut, have exclusive jurisdiction, except that we may seek injunctive relief in any forum to protect our intellectual property or users' safety. If you are a consumer in a jurisdiction that requires local courts, that requirement controls.",
      ],
    },
    {
      id: "changes-terms",
      title: "Changes",
      paragraphs: [
        `We may update these Terms. The effective date is ${siteConfig.legalEffectiveDate}. If you continue to use the Academy after an update, you accept the new Terms. If you do not agree, you must stop using the Academy.`,
      ],
    },
    {
      id: "contact-terms",
      title: "Contact",
      paragraphs: [
        `Questions about these Terms: ${siteConfig.contactUrl} (mention "Akomapa Academy terms").`,
        `${ghana.label}: ${ghana.address}. ${ghana.phone}.`,
        `${usa.label}: ${usa.address}. ${usa.phone}.`,
      ],
    },
  ],
};
