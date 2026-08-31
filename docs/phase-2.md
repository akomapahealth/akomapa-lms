# Phase 2: Dashboard Overhaul & Course Structure UI

> **Goal**: Build the rich ScanHub-inspired dashboard and the new Course -> Module -> Topic browsing experience.
> **Prerequisites**: Phase 1 complete (schema, roles, sidebar, routes).

---

## 1. Install Additional shadcn Components

```bash
npx shadcn@latest add tabs avatar tooltip select skeleton accordion scroll-area radio-group
```

---

## 2. Dashboard Overhaul

### Current State
`app/(dashboard)/(routes)/(root)/page.tsx` shows two InfoCards (In Progress / Completed counts) and a flat CoursesList grid.

### Target State
A ScanHub-inspired dashboard with: welcome banner, course selector, progress donut, topic progress, quiz progress, and completion timeline.

### 2.1 Welcome Banner

**File**: `app/(dashboard)/(routes)/(root)/_components/welcome-banner.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome, Brian                                              │
│  Continue your GHELP journey                                 │
│                                                              │
│  [Course status summary: 2 in progress, 1 completed]        │
└─────────────────────────────────────────────────────────────┘
```

- Gradient background: `bg-gradient-to-r from-akomapa-teal to-akomapa-teal-dark`
- White text, user's first name from Clerk `auth()`
- Dismissible (optional, with localStorage persistence)

### 2.2 Course Selector

**File**: `app/(dashboard)/(routes)/(root)/_components/course-selector.tsx`

- shadcn `Select` component listing enrolled courses
- Selected course ID stored in URL search params (`?courseId=xxx`)
- All widgets below filter based on selected course
- Default: first enrolled course or "All Courses" summary view

### 2.3 Progress Donut Chart

**File**: `app/(dashboard)/(routes)/(root)/_components/progress-donut.tsx`

- recharts `PieChart` with `Pie` component
- Three segments:
  - Completed modules (akomapa-teal `#0097b2`)
  - In Progress modules (akomapa-gold `#ebb92b`)
  - Not Started modules (gray `#e5e7eb`)
- Center text: overall percentage complete
- Tooltip showing module counts on hover
- Matches ScanHub's donut chart style

**Data source**: New server action `actions/get-course-progress-breakdown.ts`

```typescript
// Returns for a specific course:
interface CourseProgressBreakdown {
  courseTitle: string;
  totalModules: number;
  completedModules: number;
  inProgressModules: number;
  notStartedModules: number;
  percentComplete: number;
}
```

A module is "completed" when all its topics have `isCompleted: true` in UserProgress.
A module is "in progress" when at least one topic is completed but not all.
A module is "not started" when no topics are completed.

### 2.4 Topic Progress Section

**File**: `app/(dashboard)/(routes)/(root)/_components/topic-progress.tsx`

- Card with header "Topic Progress (N)" and a "Top 10" selector
- List of modules with:
  - Module title
  - Progress percentage (green text, right-aligned)
  - Progress bar (shadcn `Progress` component)
  - "X/Y items completed" subtitle
- Matches ScanHub's "Topic Progress" card

**Data source**: Extend `get-course-progress-breakdown.ts` to include per-module topic counts.

### 2.5 Quiz Progress Section

**File**: `app/(dashboard)/(routes)/(root)/_components/quiz-progress.tsx`

- Card with header "Quiz Progress (N)"
- Filter dropdown: "All" quizzes or by type
- List items:
  - Quiz title (e.g., "1. Pre-Test, Leadership Course")
  - Status: "Not Started" / "Score: 85%" / "Locked"
  - Refresh/retry icon
- Matches ScanHub's "Quiz Progress" card

**Data source**: New server action `actions/get-quiz-progress.ts`

```typescript
interface QuizProgressItem {
  quizId: string;
  title: string;
  type: "PRE_TEST" | "POST_TEST" | "MODULE_QUIZ";
  status: "NOT_STARTED" | "COMPLETED" | "LOCKED";
  bestScore?: number;
  attemptCount: number;
}
```

### 2.6 Time Progress Report

**File**: `app/(dashboard)/(routes)/(root)/_components/time-progress.tsx`

- Card with "Progress for [Course Name]" header
- "Time progress report" subtitle with course period dates
- Weekly/Monthly toggle (shadcn `Select`)
- recharts `LineChart` showing cumulative completion % over time
- Summary stats below: Current Progress, Progress Change, Average Progress, Peak Progress
- Matches ScanHub's "Progress for In Person Course" section

**Data source**: New server action `actions/get-completion-timeline.ts`

```typescript
interface CompletionDataPoint {
  weekLabel: string; // e.g., "Week of Apr 26"
  completionPercent: number;
}

interface CompletionTimeline {
  dataPoints: CompletionDataPoint[];
  currentProgress: number;
  progressChange: number;
  averageProgress: number;
  peakProgress: number;
  coursePeriod: { start: Date; end: Date };
}
```

### 2.7 Updated Dashboard Page

**File**: `app/(dashboard)/(routes)/(root)/page.tsx`

Layout structure (responsive grid):

```
Mobile (1 col):
[Welcome Banner          ]
[Course Selector         ]
[Progress Donut          ]
[Topic Progress          ]
[Quiz Progress           ]
[Time Progress Report    ]

Desktop (3 col grid):
[Welcome Banner                                              ]
[Course Selector                                             ]
[Progress Donut    ] [Topic Progress   ] [Quiz Progress      ]
[Time Progress Report                  ] [Quiz Attempts (opt)]
```

Use Tailwind grid: `grid grid-cols-1 lg:grid-cols-3 gap-4`

---

## 3. Course Pages (Student View)

### 3.1 Enrolled Courses Page

**File**: `app/(dashboard)/(routes)/courses/page.tsx`

- Header: "Courses (N)" with search bar and filter dropdown (All, In Progress, Completed, Not Started)
- Toggle: "Courses" | "Modules" tabs (like ScanHub)
- Course cards in responsive grid (1/2/3 columns)

**Course Card enhancements** (update `components/course-card.tsx` or create new variant):

```
┌─────────────────────────────┐
│  [Status Badge]             │  Badges: "Not Started" (gray),
│  [Course Image/Gradient]    │  "In Progress - X%" (gold/teal),
│                             │  "Completed" (green)
│  Individual Course / Group  │
│  Course Title               │
│                             │
│  X/Y Modules  ·  Z Topics  ·  W Quizzes │
│  Last accessed: May 3, 2026 │
└─────────────────────────────┘
```

**Data source**: New server action `actions/get-enrolled-courses.ts`

### 3.2 Course Detail Page

**File**: `app/(dashboard)/(routes)/courses/[courseId]/page.tsx`

Layout:
```
[Breadcrumb: Courses > Course Title                         ]
[Course Title                                    ] [Status  ]
[X/Y MODULES  ·  Z/W TOPICS  ·  A/B QUIZZES    ] [Badge   ]
[Resume Course] button                                       ]
[Description text                                            ]

Modules
┌─────────────────────────────────────────────────────────────┐
│ [Module Image] Module                                       │
│                Ultrasound Basics          [Expand Arrow ▼]  │
│                5 Topics                                     │
├─────────────────────────────────────────────────────────────┤
│ [Module Image] Module                                       │
│                FAST/E-FAST                [Expand Arrow ▼]  │
│                7 Topics                                     │
└─────────────────────────────────────────────────────────────┘
```

On expand, show topics with completion checkmarks (matches ScanHub's expandable sidebar).

**Data source**: New server action `actions/get-course-detail.ts`

### 3.3 Breadcrumb Component

**File**: `components/breadcrumb.tsx`

Reusable breadcrumb with chevron separators:

```tsx
interface BreadcrumbItem {
  label: string;
  href?: string; // last item has no href (current page)
}

export const Breadcrumb = ({ items }: { items: BreadcrumbItem[] }) => { ... }
```

Style: teal text for links, gray text for current page, ChevronRight separator.

---

## 4. Course Player Overhaul

### 4.1 Nested Sidebar

**File**: `app/(course)/courses/[courseId]/_components/course-sidebar.tsx`

Current: flat list of chapters.
New: two-level nested list (modules → topics).

```
┌──────────────────────────────┐
│ ☰ 13 Modules           3%   │
│                 6/184 Done   │
│ ↻ Expand All                 │
├──────────────────────────────┤
│ ▸ Ultrasound Basics          │
├──────────────────────────────┤
│ ▸ FAST/E-FAST                │
├──────────────────────────────┤
│ ▾ Cardiac Echo               │
│   ✓ Case and Literature (10m)│
│   ○ Case and Literature Quiz │
│   ○ Scanning Technique (20m) │
│   ○ Scanning Technique Quiz  │
│   ○ Pathology Part 1 (11m)   │
│   ...                        │
└──────────────────────────────┘
```

Use shadcn `Accordion` for collapsible module sections.
Topics show: completion icon (✓/○/🔒), title, duration.

### 4.2 Breadcrumb in Course Player

**File**: `app/(course)/courses/[courseId]/_components/course-navbar.tsx`

Add breadcrumb below navbar: `Course Title > Module Title > Topic Title`
Links back to course detail and module.

### 4.3 Topic Navigation

**File**: `app/(course)/courses/[courseId]/modules/[moduleId]/topics/[topicId]/page.tsx`

Add Previous/Next buttons at bottom of topic content:

```
← Previous Topic Title    [Back to Course]    Next Topic Title →
```

Navigation wraps across modules (last topic of Module 1 → first topic of Module 2).

### 4.4 Module Completion

When the last topic in a module is completed:
- Show a success banner: "Module Complete! You've finished [Module Name]"
- Trigger confetti (existing confetti provider)
- Auto-advance to next module's first topic

---

## 5. New Server Actions

### `actions/get-course-progress-breakdown.ts`

```typescript
export async function getCourseProgressBreakdown(
  userId: string,
  courseId: string
): Promise<CourseProgressBreakdown> {
  // 1. Fetch course with modules → topics
  // 2. Fetch user progress for all topics
  // 3. Calculate per-module and overall completion
  // 4. Return breakdown
}
```

### `actions/get-quiz-progress.ts`

```typescript
export async function getQuizProgress(
  userId: string,
  courseId: string
): Promise<QuizProgressItem[]> {
  // 1. Fetch all quizzes for the course
  // 2. Fetch user's best attempt for each quiz
  // 3. Determine lock status (post-test locked if modules incomplete)
  // 4. Return progress items
}
```

### `actions/get-completion-timeline.ts`

```typescript
export async function getCompletionTimeline(
  userId: string,
  courseId: string,
  period: "weekly" | "monthly"
): Promise<CompletionTimeline> {
  // 1. Fetch all UserProgress records for course topics, ordered by updatedAt
  // 2. Group by week/month
  // 3. Calculate cumulative completion % at each point
  // 4. Return data points + summary stats
}
```

### `actions/get-enrolled-courses.ts`

```typescript
export async function getEnrolledCourses(
  userId: string,
  filter?: "all" | "in_progress" | "completed" | "not_started"
): Promise<EnrolledCourse[]> {
  // 1. Fetch enrollments for user
  // 2. For each, calculate module/topic/quiz counts and progress
  // 3. Apply filter
  // 4. Return with status badges
}
```

### `actions/get-course-detail.ts`

```typescript
export async function getCourseDetail(
  userId: string,
  courseId: string
): Promise<CourseDetail> {
  // 1. Fetch course with modules → topics, faculty, quizzes
  // 2. Fetch user progress for all topics
  // 3. Calculate per-module completion
  // 4. Return full detail with progress
}
```

---

## 6. Verification Checklist

- [ ] Dashboard displays welcome banner with user name
- [ ] Course selector dropdown lists enrolled courses
- [ ] Selecting a course updates all dashboard widgets
- [ ] Progress donut chart renders correctly with accurate data
- [ ] Topic progress shows per-module progress bars
- [ ] Quiz progress shows pre/post test status
- [ ] Completion timeline chart renders with weekly/monthly toggle
- [ ] `/courses` page shows enrolled courses with status badges
- [ ] `/courses/[courseId]` shows course detail with expandable modules
- [ ] Course player sidebar shows nested modules → topics
- [ ] Breadcrumbs work throughout course navigation
- [ ] Previous/Next topic navigation works (including cross-module)
- [ ] Module completion triggers celebration
- [ ] All pages responsive on mobile
- [ ] `npm run build` succeeds

---

## 7. Files Created/Modified Summary

### New Files
- `app/(dashboard)/(routes)/(root)/_components/welcome-banner.tsx`
- `app/(dashboard)/(routes)/(root)/_components/course-selector.tsx`
- `app/(dashboard)/(routes)/(root)/_components/progress-donut.tsx`
- `app/(dashboard)/(routes)/(root)/_components/topic-progress.tsx`
- `app/(dashboard)/(routes)/(root)/_components/quiz-progress.tsx`
- `app/(dashboard)/(routes)/(root)/_components/time-progress.tsx`
- `app/(dashboard)/(routes)/courses/page.tsx` -- enrolled courses
- `app/(dashboard)/(routes)/courses/[courseId]/page.tsx` -- course detail
- `components/breadcrumb.tsx`
- `components/status-badge.tsx` -- Not Started / In Progress / Completed badge
- `actions/get-course-progress-breakdown.ts`
- `actions/get-quiz-progress.ts`
- `actions/get-completion-timeline.ts`
- `actions/get-enrolled-courses.ts`
- `actions/get-course-detail.ts`

### Modified Files
- `app/(dashboard)/(routes)/(root)/page.tsx` -- full rewrite with widgets
- `app/(course)/courses/[courseId]/_components/course-sidebar.tsx` -- nested modules
- `app/(course)/courses/[courseId]/_components/course-sidebar-item.tsx` -- topic item
- `app/(course)/courses/[courseId]/_components/course-navbar.tsx` -- breadcrumb
- `components/course-card.tsx` -- status badge variant
