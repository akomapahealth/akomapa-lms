# Phase 5: Gamification, Journals, Certificates & Polish

> **Goal**: Add the features that make the platform exceptional for ethical global health training, plus a comprehensive UI polish pass.
> **Prerequisites**: Phase 1-4 complete.

---

## 1. Gamification System

### 1.1 Database Models

Add to `prisma/schema.prisma`:

```prisma
model Badge {
  id          String @id @default(uuid())
  name        String @unique
  description String
  imageUrl    String? @db.Text // badge icon/image
  type        String // COMPLETION, STREAK, COMMUNITY, QUIZ_SCORE, MILESTONE
  criteria    Json   // machine-readable criteria for automatic evaluation

  userBadges UserBadge[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model UserBadge {
  id       String   @id @default(uuid())
  earnedAt DateTime @default(now())

  userId  String
  user    User   @relation(fields: [userId], references: [id])

  badgeId String
  badge   Badge  @relation(fields: [badgeId], references: [id])

  @@unique([userId, badgeId])
  @@index([userId])
}

model LearningStreak {
  id               String @id @default(uuid())
  currentStreak    Int    @default(0)
  longestStreak    Int    @default(0)
  lastActivityDate DateTime?

  userId String @unique
  user   User   @relation(fields: [userId], references: [id])

  updatedAt DateTime @updatedAt
}
```

### 1.2 Badge Definitions

Seed badges for the GHELP program:

```typescript
const badges = [
  // Completion badges
  {
    name: "First Steps",
    description: "Complete your first topic",
    type: "COMPLETION",
    criteria: { type: "topics_completed", count: 1 },
  },
  {
    name: "Module Master",
    description: "Complete an entire module",
    type: "COMPLETION",
    criteria: { type: "modules_completed", count: 1 },
  },
  {
    name: "Course Champion",
    description: "Complete an entire course",
    type: "COMPLETION",
    criteria: { type: "courses_completed", count: 1 },
  },
  {
    name: "GHELP Graduate",
    description: "Complete all 10 GHELP courses",
    type: "MILESTONE",
    criteria: { type: "courses_completed", count: 10 },
  },

  // Ethics-specific badges
  {
    name: "Ethics Explorer",
    description: "Complete all ethics-related modules",
    type: "COMPLETION",
    criteria: { type: "category_completed", category: "Ethics & Values" },
  },
  {
    name: "Leadership Lens",
    description: "Complete all leadership modules",
    type: "COMPLETION",
    criteria: { type: "category_completed", category: "Leadership & Power" },
  },

  // Quiz badges
  {
    name: "Perfect Score",
    description: "Score 100% on any quiz",
    type: "QUIZ_SCORE",
    criteria: { type: "quiz_score", score: 100 },
  },
  {
    name: "Growth Mindset",
    description: "Improve your post-test score by 20%+ over your pre-test",
    type: "QUIZ_SCORE",
    criteria: { type: "score_improvement", minImprovement: 20 },
  },
  {
    name: "Quiz Conqueror",
    description: "Pass all quizzes in a course",
    type: "QUIZ_SCORE",
    criteria: { type: "all_quizzes_passed", scope: "course" },
  },

  // Streak badges
  {
    name: "Consistent Learner",
    description: "Maintain a 7-day learning streak",
    type: "STREAK",
    criteria: { type: "streak_days", count: 7 },
  },
  {
    name: "Dedicated Scholar",
    description: "Maintain a 30-day learning streak",
    type: "STREAK",
    criteria: { type: "streak_days", count: 30 },
  },

  // Community badges
  {
    name: "Community Voice",
    description: "Write 5 forum posts",
    type: "COMMUNITY",
    criteria: { type: "posts_created", count: 5 },
  },
  {
    name: "Thought Leader",
    description: "Receive 50 likes on your posts",
    type: "COMMUNITY",
    criteria: { type: "post_likes_received", count: 50 },
  },
  {
    name: "Mentor's Heart",
    description: "Help 10 other students by commenting on their posts",
    type: "COMMUNITY",
    criteria: { type: "comments_created", count: 10 },
  },
];
```

### 1.3 Badge Evaluation Service

**File**: `lib/badge-service.ts`

```typescript
export async function evaluateBadges(userId: string, event: BadgeEvent): Promise<Badge[]> {
  // 1. Get user's current badges
  // 2. Get all badge definitions
  // 3. For each badge the user doesn't have, check criteria against event
  // 4. Award any newly earned badges
  // 5. Return list of newly awarded badges (for toast notifications)
}

type BadgeEvent =
  | { type: "topic_completed"; topicId: string }
  | { type: "module_completed"; moduleId: string }
  | { type: "course_completed"; courseId: string }
  | { type: "quiz_completed"; quizId: string; score: number; preTestScore?: number }
  | { type: "post_created"; postId: string }
  | { type: "comment_created"; commentId: string }
  | { type: "streak_updated"; currentStreak: number };
```

**Integration points** -- call `evaluateBadges()` after:
- Marking a topic as complete (`PUT /api/.../progress`)
- Submitting a quiz (`POST /api/.../submit`)
- Creating a forum post (`POST /api/community/posts`)
- Creating a comment (`POST /api/community/posts/[id]/comments`)
- Daily streak check (could be a lightweight check on any learning activity)

### 1.4 Streak Tracking

**File**: `lib/streak-service.ts`

```typescript
export async function updateStreak(userId: string): Promise<number> {
  // 1. Get or create LearningStreak record
  // 2. Check if lastActivityDate is yesterday → increment streak
  // 3. Check if lastActivityDate is today → no change
  // 4. Otherwise → reset streak to 1
  // 5. Update longestStreak if currentStreak exceeds it
  // 6. Return current streak count
}
```

Call `updateStreak()` on any learning activity (topic completion, quiz start, etc.).

### 1.5 Badge Display Components

**`components/badge-display.tsx`** -- Single badge with tooltip:
- Badge icon (image or emoji fallback)
- Badge name
- Tooltip with description and earned date
- Grayscale + locked appearance for unearned badges

**`_components/badge-grid.tsx`** -- Grid of all badges:
- Earned badges in color, unearned in grayscale
- Progress indicators for partially-met criteria
- Used on dashboard and profile pages

**`_components/streak-counter.tsx`** -- Streak display:
- Fire emoji + streak count
- "X day streak!" text
- Shown on dashboard welcome banner

### 1.6 Badge Notification

When a badge is earned:
1. Show a toast notification with badge icon and name
2. Optionally trigger confetti for milestone badges (GHELP Graduate, Perfect Score)
3. Badge appears immediately in the user's badge grid

---

## 2. Reflection Journal

### 2.1 Database Model

```prisma
model JournalEntry {
  id        String  @id @default(uuid())
  title     String
  content   String  @db.Text
  isPrivate Boolean @default(true) // private by default

  prompt String? @db.Text // optional guided prompt

  userId String
  user   User   @relation(fields: [userId], references: [id])

  moduleId String? // optional link to a module
  module   Module? @relation(fields: [moduleId], references: [id])

  courseId String? // optional link to a course
  course   Course? @relation(fields: [courseId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([moduleId])
  @@index([courseId])
}
```

Add `journalEntries JournalEntry[]` relation to `User`, `Module`, and `Course` models.

### 2.2 Journal Pages

**Journal List**: `app/(dashboard)/(routes)/journal/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  My Reflections                              [+ New Entry]  │
│                                                              │
│  Filter: [All Courses ▾]  [All Modules ▾]   [Search...]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Reflections on Ethical Leadership                        ││
│  │ Course 2: Leadership & Power · Module: Positionality    ││
│  │ Jun 5, 2026 · 🔒 Private                               ││
│  │ "Today's reading on positionality really challenged     ││
│  │ my assumptions about..."                                ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Why screening alone fails - my experience               ││
│  │ Course 4: NCDs as Systems Problems                      ││
│  │ Jun 3, 2026 · 🌐 Shared with faculty                   ││
│  │ "In my community health work back home, I've seen..."   ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Journal Entry Editor**: `app/(dashboard)/(routes)/journal/[entryId]/page.tsx`

- Title input
- Rich text editor (React Quill)
- Privacy toggle: Private / Shared with faculty
- Optional module/course association
- Auto-save with debounce (save draft every 5 seconds)
- Word count indicator

**New Journal Entry**: `app/(dashboard)/(routes)/journal/new/page.tsx`

- Same editor, empty state
- If navigated from a module completion prompt, pre-fill the module association and show the guided prompt

### 2.3 Guided Reflection Prompts

After completing a module, show a prompt:

```
┌─────────────────────────────────────────────────────────────┐
│  ✨ Module Complete: Positionality, Privilege & Perspective │
│                                                              │
│  Take a moment to reflect on what you learned.             │
│                                                              │
│  Guided prompt: "How has this module changed your           │
│  understanding of your own positionality in global          │
│  health work? What assumptions were challenged?"            │
│                                                              │
│  [Write a Reflection]           [Skip for now]              │
└─────────────────────────────────────────────────────────────┘
```

**Admin configuration**: Add a `reflectionPrompt` field to the `Module` model (nullable String). Faculty can set a custom prompt per module in the admin editor.

### 2.4 Faculty Review (Optional)

If a student sets `isPrivate: false` on a journal entry:
- Faculty assigned to that module can see the entry
- Faculty can leave a private comment (add `JournalComment` model or reuse ForumComment)
- Student is notified when faculty comments

Keep this simple -- don't over-engineer the review workflow.

---

## 3. Case Study Simulator

### 3.1 Concept

Interactive ethical dilemma scenarios where students make choices and see consequences. Implemented as a special `contentType: "INTERACTIVE"` on the Topic model.

### 3.2 Data Model

```prisma
model CaseStudy {
  id          String @id @default(uuid())
  title       String
  description String @db.Text
  scenario    Json   // structured scenario data (see below)

  topicId String @unique
  topic   Topic  @relation(fields: [topicId], references: [id], onDelete: Cascade)

  attempts CaseStudyAttempt[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model CaseStudyAttempt {
  id        String @id @default(uuid())
  choices   Json   // array of choice IDs the student made
  completed Boolean @default(false)

  userId      String
  user        User      @relation(fields: [userId], references: [id])
  caseStudyId String
  caseStudy   CaseStudy @relation(fields: [caseStudyId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([caseStudyId])
}
```

### 3.3 Scenario JSON Structure

```typescript
interface CaseStudyScenario {
  introduction: string; // rich text
  steps: CaseStudyStep[];
  conclusion: string; // summary after all choices made
}

interface CaseStudyStep {
  id: string;
  narrative: string; // the situation description
  question: string;  // what should you do?
  choices: CaseStudyChoice[];
}

interface CaseStudyChoice {
  id: string;
  text: string;
  consequence: string; // what happens if you choose this
  ethicalScore: number; // 0-100, for feedback (not graded)
  nextStepId?: string;  // branching (optional, default = next step)
  feedback: string;     // educational explanation of why this choice matters
}
```

### 3.4 Case Study Player

**File**: `app/(course)/courses/[courseId]/modules/[moduleId]/topics/[topicId]/_components/case-study-player.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Case Study: The Community Screening Dilemma                │
│                                                              │
│  Step 2 of 5                                                │
│                                                              │
│  You arrive at a rural community clinic in the Volta        │
│  Region. The community health worker tells you they've      │
│  been conducting door-to-door hypertension screenings       │
│  but several community members have expressed distrust...   │
│                                                              │
│  What would you do?                                         │
│                                                              │
│  [A] Continue screening, explaining the medical benefits    │
│  [B] Pause screening and consult with community leaders     │
│  [C] Report the resistance to your supervisor               │
│  [D] Ask community members directly about their concerns   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

After choosing:
```
│  You chose: [B] Pause screening and consult with leaders   │
│                                                              │
│  ✨ Strong ethical choice                                   │
│                                                              │
│  By pausing and consulting community leaders, you           │
│  demonstrated respect for community authority and           │
│  accountability -- a core principle of ethical community    │
│  engagement...                                              │
│                                                              │
│  [Continue to Step 3 →]                                     │
```

Not graded -- purely educational. Shows feedback and ethical reasoning for each choice.

### 3.5 Admin Case Study Editor

JSON-based editor in admin panel for creating/editing scenarios:
- Step-by-step builder
- Rich text for narratives
- Choice editor with consequence and feedback fields
- Preview mode

---

## 4. Certificate Generation

### 4.1 Data Model

```prisma
model Certificate {
  id               String   @id @default(uuid())
  certificateNumber String  @unique // e.g., "GHELP-2026-00042"
  issuedAt         DateTime @default(now())

  userId  String
  user    User   @relation(fields: [userId], references: [id])

  courseId String
  course  Course @relation(fields: [courseId], references: [id])

  pdfUrl String? @db.Text // stored in Vercel Blob or UploadThing

  @@unique([userId, courseId])
  @@index([userId])
}
```

### 4.2 Certificate Template

Use `@react-pdf/renderer` for server-side PDF generation.

```bash
npm install @react-pdf/renderer
```

**File**: `lib/certificate-template.tsx`

Certificate design:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    [Akomapa Logo]                            │
│                                                              │
│           CERTIFICATE OF COMPLETION                         │
│                                                              │
│              This certifies that                            │
│                                                              │
│              BRIAN FLEISCHER                                 │
│                                                              │
│        has successfully completed the course                │
│                                                              │
│        LEADERSHIP, POWER & RESPONSIBILITY                   │
│                                                              │
│        as part of the Akomapa Global Health                 │
│        Education & Leadership Program (GHELP)               │
│                                                              │
│        Pre-Test: 65%  →  Post-Test: 88%                    │
│        Growth: +23%                                         │
│                                                              │
│        Date: June 9, 2026                                   │
│        Certificate ID: GHELP-2026-00042                     │
│                                                              │
│  [Faculty Signature]              [Program Director]        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Certificate Generation Flow

1. Student completes all modules + post-test for a course
2. System auto-generates certificate PDF
3. Stores PDF in UploadThing (or Vercel Blob)
4. Saves Certificate record with URL
5. Shows certificate on grades detail page with download button

**API Route**: `POST /api/courses/[courseId]/certificate` -- generates and returns certificate.

### 4.4 Certificate Verification

**Public route**: `app/verify/[certificateNumber]/page.tsx`

Simple public page (no auth required) that verifies a certificate is legitimate:
```
Certificate GHELP-2026-00042
Issued to: Brian Fleischer
Course: Leadership, Power & Responsibility
Date: June 9, 2026
Status: ✓ Verified
```

---

## 5. UI Polish Pass

### 5.1 Loading Skeletons

Install shadcn Skeleton (if not already): `npx shadcn@latest add skeleton`

Create skeleton variants for:
- `components/skeletons/dashboard-skeleton.tsx` -- dashboard widget placeholders
- `components/skeletons/course-card-skeleton.tsx` -- course card loading
- `components/skeletons/course-detail-skeleton.tsx` -- course detail page
- `components/skeletons/grades-skeleton.tsx` -- grades table loading
- `components/skeletons/community-skeleton.tsx` -- forum post list loading

Use in pages with Suspense boundaries:
```tsx
<Suspense fallback={<DashboardSkeleton />}>
  <DashboardContent />
</Suspense>
```

### 5.2 Empty States

Create empty state components for:
- No enrolled courses: illustration + "Browse courses to get started" CTA
- No grades yet: illustration + "Complete your first quiz to see grades"
- No forum posts: illustration + "Start a discussion" CTA
- No journal entries: illustration + "Write your first reflection" CTA
- No badges earned: illustration + "Complete activities to earn badges"

**File**: `components/empty-state.tsx`

```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}
```

### 5.3 Error Boundaries

**File**: `app/error.tsx` -- global error boundary
**File**: `app/(dashboard)/error.tsx` -- dashboard error boundary

Show friendly error message with retry button. Use the existing Akomapa branding.

### 5.4 Mobile Responsiveness Audit

Key areas to verify and fix:
- Dashboard widgets stack correctly on mobile (1 column)
- Course sidebar becomes drawer on mobile (already exists, verify with new nested structure)
- Quiz taking UI works on small screens
- Community forum cards are readable on mobile
- Grade tables scroll horizontally on mobile
- Journal editor works on mobile

### 5.5 Accessibility

- All interactive elements have focus states
- Color contrast meets WCAG 2.1 AA (verify teal-on-white, gold-on-white)
- Quiz questions have proper ARIA labels
- Screen reader labels on all icon-only buttons
- Keyboard navigation for quiz (tab through options, enter to select)
- Video captions (Mux supports this -- enable in player config)

---

## 6. Settings Page

**File**: `app/(dashboard)/(routes)/settings/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Profile                                                 ││
│  │  Managed by Clerk → [Edit Profile] (opens Clerk modal)  ││
│  ├──────────────────────────────────────────────────────────┤│
│  │  Appearance                                              ││
│  │  Theme: [Light ▾]  (Light / Dark / System)              ││
│  ├──────────────────────────────────────────────────────────┤│
│  │  Privacy                                                 ││
│  │  Default journal visibility: [Private ▾]                ││
│  │  Show my profile in community: [Yes ▾]                  ││
│  ├──────────────────────────────────────────────────────────┤│
│  │  Notifications                                           ││
│  │  Email on badge earned: [✓]                             ││
│  │  Email on forum reply: [✓]                              ││
│  │  Email on faculty comment: [✓]                          ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Data model**: Add `UserSettings` model or JSON column on User.

```prisma
model UserSettings {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])

  theme                    String  @default("light") // light, dark, system
  defaultJournalPrivacy    Boolean @default(true) // true = private
  showProfileInCommunity   Boolean @default(true)
  emailOnBadgeEarned       Boolean @default(true)
  emailOnForumReply        Boolean @default(true)
  emailOnFacultyComment    Boolean @default(true)

  updatedAt DateTime @updatedAt
}
```

---

## 7. Sidebar Enhancement: Add Journal Link

Update sidebar routes to include Journal (after Community):

```typescript
const studentRoutes = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: BookOpen,        label: "Courses",   href: "/courses" },
  { icon: GraduationCap,   label: "Grades",    href: "/grades" },
  { icon: Compass,         label: "Browse",    href: "/search" },
  { icon: Users,           label: "Community", href: "/community" },
  { icon: BookHeart,       label: "Journal",   href: "/journal" },
];
```

---

## 8. Enhanced Admin Analytics

**File**: `app/(admin)/(routes)/analytics/page.tsx`

Add new analytics panels:

- **Program Effectiveness**: Average pre-test vs post-test scores per course (bar chart)
- **Enrollment Trends**: New enrollments over time (line chart)
- **Module Drop-off**: Which modules have lowest completion rates (identify problem areas)
- **Community Engagement**: Posts/comments per week, most active users
- **Quiz Performance**: Average scores per quiz, question-level difficulty analysis
- **Badge Distribution**: Which badges are most/least earned
- **Student Activity**: Active students per week/month

All powered by new server actions under `actions/get-admin-analytics.ts`.

---

## 9. Learning Path Visualization (Bonus)

**File**: `app/(dashboard)/(routes)/learning-path/page.tsx`

Visual roadmap showing the 10-course GHELP journey:

```
  [1. Welcome]──[2. Leadership]──[3. Ethics]──[4. NCDs]
       ✓              ◑              ○           ○
                                                  │
  [8. Student-Led]──[7. Research]──[6. Community]──[5. Sustainability]
       ○                ○              ○              ○
       │
  [9. Interprofessional]──[10. Reflection & Commitment]
       ○                        ○
```

- Completed courses in teal
- In-progress courses in gold with percentage
- Future courses in gray
- Connecting lines show progression
- Clicking a node navigates to the course

Could use a simple CSS grid layout or an SVG visualization.

---

## 10. Verification Checklist

- [ ] Badges are seeded correctly
- [ ] Badges are awarded automatically on qualifying events
- [ ] Badge notifications appear as toasts
- [ ] Badge grid displays on dashboard and profile
- [ ] Learning streak tracks correctly (increment, reset)
- [ ] Journal list page shows entries with filters
- [ ] Journal editor works with rich text and auto-save
- [ ] Guided reflection prompts appear after module completion
- [ ] Case study player renders scenarios and choices
- [ ] Case study feedback shows after each choice
- [ ] Certificate generates as PDF on course completion
- [ ] Certificate downloads correctly
- [ ] Certificate verification page works (public)
- [ ] Loading skeletons display on all data pages
- [ ] Empty states show on all empty lists
- [ ] Error boundaries catch and display errors gracefully
- [ ] Settings page saves preferences
- [ ] Dark mode works when toggled
- [ ] All pages pass mobile responsiveness check
- [ ] Keyboard navigation works on quiz interface
- [ ] Admin analytics show all new panels
- [ ] `npm run build` succeeds
- [ ] All existing features still work (regression check)

---

## 11. Files Created/Modified Summary

### New Files (Phase 5)
- `lib/badge-service.ts`
- `lib/streak-service.ts`
- `lib/certificate-template.tsx`
- `components/badge-display.tsx`
- `components/empty-state.tsx`
- `components/skeletons/*.tsx` (5+ skeleton components)
- `app/(dashboard)/(routes)/journal/page.tsx`
- `app/(dashboard)/(routes)/journal/new/page.tsx`
- `app/(dashboard)/(routes)/journal/[entryId]/page.tsx`
- `app/(dashboard)/(routes)/settings/page.tsx`
- `app/(dashboard)/(routes)/learning-path/page.tsx`
- `app/(course)/.../case-study-player.tsx`
- `app/verify/[certificateNumber]/page.tsx`
- `app/error.tsx`
- `app/(dashboard)/error.tsx`
- `actions/get-admin-analytics.ts`
- API routes for certificates, journal CRUD

### Modified Files
- `prisma/schema.prisma` -- Badge, JournalEntry, CaseStudy, Certificate, UserSettings, LearningStreak models
- `scripts/seed.ts` -- badge definitions
- `app/(dashboard)/_components/sidebar-routes.tsx` -- add Journal link
- `app/(dashboard)/(routes)/(root)/page.tsx` -- add badges and streak to dashboard
- Various API routes -- add badge evaluation calls
- `app/(admin)/(routes)/analytics/page.tsx` -- enhanced analytics panels

### New Dependencies
- `@react-pdf/renderer` -- PDF certificate generation
